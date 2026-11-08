import { BigQuery } from "@google-cloud/bigquery";
import { requireEnv } from "./env";
import type { Sql } from "./db";

/**
 * M-Lab's "unified" views already apply M-Lab's own validity filters
 * (completed tests, no obvious client errors). Geo fields come from IP
 * geolocation, which is often only city-accurate — we only use them for
 * province / division / subdivision, never for hexagons.
 *
 * The client IP is hashed *inside BigQuery* with a secret salt and the test
 * date, so raw IPs never leave Google and the key can't link a household
 * across days.
 *
 * View names can be overridden (MLAB_DOWNLOAD_VIEW / MLAB_UPLOAD_VIEW) if
 * M-Lab renames them; check https://www.measurementlab.net/data/docs/ .
 */
const DOWNLOAD_VIEW = process.env.MLAB_DOWNLOAD_VIEW ?? "measurement-lab.ndt.unified_downloads";
const UPLOAD_VIEW = process.env.MLAB_UPLOAD_VIEW ?? "measurement-lab.ndt.unified_uploads";

function buildQuery(withIp: boolean) {
  const ip = withIp ? "client.IP" : "CAST(NULL AS STRING)";
  const cols = (dir: string) => `
    SELECT '${dir}' AS direction, date, a.UUID AS uuid, a.TestTime AS ts, a.MeanThroughputMbps AS mbps,
           a.MinRTT AS min_rtt_ms, a.LossRate AS loss_rate, ${ip} AS ip,
           client.Network.ASNumber AS asn, client.Network.ASName AS as_name,
           client.Geo.Latitude AS lat, client.Geo.Longitude AS lon`;
  return `
WITH tests AS (
  ${cols("down")}
  FROM \`${DOWNLOAD_VIEW}\`
  WHERE date BETWEEN @from AND @to AND client.Geo.CountryCode = 'CA'
  UNION ALL
  ${cols("up")}
  FROM \`${UPLOAD_VIEW}\`
  WHERE date BETWEEN @from AND @to AND client.Geo.CountryCode = 'CA'
)
SELECT direction, CAST(date AS STRING) AS day, uuid, CAST(ts AS STRING) AS ts, mbps, min_rtt_ms, loss_rate,
       IF(ip IS NULL, NULL, TO_HEX(SHA256(CONCAT(@salt, '|', ip, '|', CAST(date AS STRING))))) AS client_key,
       asn, as_name, lat, lon
FROM tests
WHERE uuid IS NOT NULL AND mbps IS NOT NULL AND mbps >= 0
`;
}

type BqRow = {
  direction: "down" | "up";
  day: string;
  uuid: string;
  ts: string | null;
  mbps: number;
  min_rtt_ms: number | null;
  loss_rate: number | null;
  client_key: string | null;
  asn: number | null;
  as_name: string | null;
  lat: number | null;
  lon: number | null;
};

function client() {
  return new BigQuery({ projectId: requireEnv("GCP_PROJECT_ID") });
}

/** Fetch [from, to] (inclusive, YYYY-MM-DD) from BigQuery into bb.mlab_tests. */
export async function ingestRange(sql: Sql, from: string, to: string) {
  const bq = client();
  const salt = requireEnv("IP_HASH_SALT");
  const maxGb = Number(process.env.MLAB_MAX_GB_PER_QUERY ?? 60);
  const params = { from: BigQuery.date(from), to: BigQuery.date(to), salt };
  let options = { query: buildQuery(true), location: "US", params };

  // Dry run first: validates the query and refuses anything unexpectedly expensive.
  let dry;
  try {
    [dry] = await bq.createQueryJob({ ...options, dryRun: true });
  } catch (e) {
    // If M-Lab's view doesn't expose the client IP, continue without per-client
    // de-duplication (each test then counts once) rather than failing the import.
    if (!/\bIP\b/.test(String((e as Error).message))) throw e;
    console.warn("  ⚠ client.IP not available in the M-Lab view — importing without per-client de-duplication");
    options = { query: buildQuery(false), location: "US", params };
    [dry] = await bq.createQueryJob({ ...options, dryRun: true });
  }
  const gb = Number(dry.metadata.statistics?.totalBytesProcessed ?? 0) / 1e9;
  console.log(`  ${from} → ${to}: BigQuery will scan ${gb.toFixed(2)} GB`);
  if (gb > maxGb) throw new Error(`Query would scan ${gb.toFixed(1)} GB (> MLAB_MAX_GB_PER_QUERY=${maxGb}). Use a smaller date range.`);

  const asnSeen = new Map<number, { name: string | null; n: number }>();
  let batch: BqRow[] = [];
  let inserted = 0;
  let fetched = 0;

  const flush = async () => {
    if (!batch.length) return;
    const b = batch;
    batch = [];
    const res = await sql`
      insert into bb.mlab_tests (uuid, day, ts, direction, mbps, min_rtt_ms, loss_rate, client_key, asn, lat, lon)
      select * from unnest(
        ${b.map((r) => r.uuid)}::text[], ${b.map((r) => r.day)}::date[], ${b.map((r) => r.ts)}::timestamptz[],
        ${b.map((r) => r.direction)}::text[], ${b.map((r) => r.mbps)}::real[], ${b.map((r) => r.min_rtt_ms)}::real[],
        ${b.map((r) => r.loss_rate)}::real[], ${b.map((r) => r.client_key)}::text[], ${b.map((r) => r.asn)}::int[],
        ${b.map((r) => r.lat)}::real[], ${b.map((r) => r.lon)}::real[])
      on conflict (uuid) do nothing`;
    inserted += res.count;
  };

  const stream = bq.createQueryStream(options);
  for await (const r of stream as AsyncIterable<BqRow>) {
    fetched++;
    if (r.asn != null) {
      const s = asnSeen.get(r.asn) ?? { name: r.as_name, n: 0 };
      s.n++;
      asnSeen.set(r.asn, s);
    }
    batch.push(r);
    if (batch.length >= 5000) await flush();
  }
  await flush();

  if (asnSeen.size) {
    const entries = [...asnSeen.entries()];
    await sql`
      insert into bb.asn_names (asn, as_name, last_seen, tests)
      select * from unnest(${entries.map(([a]) => a)}::int[], ${entries.map(([, v]) => v.name)}::text[],
                           ${entries.map(() => to)}::date[], ${entries.map(([, v]) => v.n)}::bigint[])
      on conflict (asn) do update set as_name = coalesce(excluded.as_name, bb.asn_names.as_name),
        last_seen = greatest(bb.asn_names.last_seen, excluded.last_seen), tests = bb.asn_names.tests + excluded.tests`;
  }
  return { fetched, inserted, scannedGb: Number(gb.toFixed(2)) };
}

/** ISP mapping, region assignment and rollups for a date range. */
export async function processRange(sql: Sql, from: string, to: string) {
  const [{ map_new_asns: newAsns }] = await sql<{ map_new_asns: number }[]>`select bb.map_new_asns()`;
  await sql`
    update bb.mlab_tests t set isp_id = a.isp_id
    from bb.isp_asns a
    where a.asn = t.asn and t.day between ${from} and ${to} and t.isp_id is distinct from a.isp_id`;
  const [{ assign_mlab_regions: assigned }] = await sql<{ assign_mlab_regions: number }[]>`select bb.assign_mlab_regions(${from}, ${to})`;
  const [{ rollup_mlab: rows }] = await sql<{ rollup_mlab: number }[]>`select bb.rollup_mlab(${from}, ${to})`;
  return { newAsns, assigned, rollupRows: rows };
}

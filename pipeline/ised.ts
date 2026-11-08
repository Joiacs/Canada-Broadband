/**
 * Import ISED's National Broadband Data (advertised availability).
 *
 *   pnpm pipeline:ised [--refresh]
 *
 * 1. Hexagon polygons (25 km² grid, populated areas only) → bb.regions level 'hex'
 * 2. Pseudo-household (PHH) points × "current speeds" → exact population with
 *    50/10 Mbps advertised, aggregated to dissemination blocks and hexagons in
 *    Node (the raw 10M points never touch the database), then rolled up to
 *    subdivision / division / province in SQL.
 * 3. Which providers advertise service in each hexagon.
 *
 * Run after `pipeline:boundaries`. Data: Open Government Licence – Canada.
 */
import path from "node:path";
import readline from "node:readline";
import { provinceByAbbr } from "../src/lib/provinces";
import { args, BUILD_DIR, RAW_DIR } from "./lib/env";
import { runJob, type Sql } from "./lib/db";
import { download, ensureDir, readLines, run, stdoutOf, zipEntries } from "./lib/files";
import { parseCsvLine, stripBom } from "./lib/csv";

const ISED = "https://ised-isde.canada.ca/app/scr/sittibc/web/api/openData";

async function lines(zip: string, entry: string) {
  const { stream, done } = stdoutOf("unzip", ["-p", zip, entry]);
  return { rl: readline.createInterface({ input: stream, crlfDelay: Infinity }), done };
}

/** PHH id → bit flags (1 = 50/10 available, 2 = LTE mobile available). */
async function readSpeeds(zip: string) {
  const entry = (await zipEntries(zip)).find((n) => /^PHH_Speeds_Current-[^_]+_Actuelles\.csv$/i.test(n) || /PHH_Speeds_Current.*Actuelles\.csv$/i.test(n));
  if (!entry) throw new Error("Could not find the national 'PHH_Speeds_Current' CSV in NBD_PHH_Speeds.zip");
  console.log(`  reading ${entry}`);
  let flags = new Uint8Array(16_000_000);
  const { rl, done } = await lines(zip, entry);
  let header: string[] | null = null;
  let iId = 0, i5010 = 0, iLte = 0, n = 0;
  for await (const raw of rl) {
    if (!header) {
      header = parseCsvLine(stripBom(raw)).map((h) => h.trim());
      iId = header.indexOf("PHH_ID");
      i5010 = header.indexOf("Combined_50_10_Combine");
      iLte = header.indexOf("Avail_LTE_Mobile_Dispo");
      if (iId < 0 || i5010 < 0) throw new Error(`Unexpected PHH speeds header: ${header.join(",")}`);
      continue;
    }
    const c = raw.split(",");
    const id = Number(c[iId]);
    if (!Number.isFinite(id)) continue;
    if (id >= flags.length) {
      const bigger = new Uint8Array(Math.max(id + 1, flags.length * 2));
      bigger.set(flags);
      flags = bigger;
    }
    flags[id] = (c[i5010] === "1" ? 1 : 0) | (iLte >= 0 && c[iLte] === "1" ? 2 : 0);
    n++;
  }
  await done;
  console.log(`  ${n.toLocaleString()} PHH speed rows`);
  return flags;
}

type Agg = { pop: number; pop5010: number; popLte: number; lat: number; lon: number; w: number };

async function aggregatePhh(zip: string, flags: Uint8Array) {
  const entries = (await zipEntries(zip)).filter((n) => /PHH-[A-Z]{2}\.csv$/i.test(n));
  const byDb = new Map<string, Agg>();
  const byHex = new Map<string, Agg>();
  let n = 0;
  const add = (m: Map<string, Agg>, k: string, pop: number, f: number, lat: number, lon: number) => {
    let a = m.get(k);
    if (!a) m.set(k, (a = { pop: 0, pop5010: 0, popLte: 0, lat: 0, lon: 0, w: 0 }));
    a.pop += pop;
    if (f & 1) a.pop5010 += pop;
    if (f & 2) a.popLte += pop;
    const w = pop > 0 ? pop : 0.001; // unpopulated points still locate the block
    a.lat += lat * w;
    a.lon += lon * w;
    a.w += w;
  };
  for (const entry of entries) {
    const { rl, done } = await lines(zip, entry);
    let header: string[] | null = null;
    let iId = 0, iPop = 0, iDb = 0, iHex = 0, iLat = 0, iLon = 0;
    for await (const raw of rl) {
      if (!header) {
        header = stripBom(raw).split(",").map((h) => h.trim());
        iId = header.indexOf("PHH_ID");
        iPop = header.indexOf("Pop2021");
        iDb = header.indexOf("DBUID_Ididu");
        iHex = header.indexOf("HEXUID_IdUHEX");
        iLat = header.indexOf("Latitude");
        iLon = header.indexOf("Longitude");
        if ([iId, iPop, iDb, iHex, iLat, iLon].some((i) => i < 0)) throw new Error(`Unexpected PHH header in ${entry}`);
        continue;
      }
      const c = raw.split(",");
      const id = Number(c[iId]);
      const pop = Number(c[iPop]) || 0;
      const f = id < flags.length ? flags[id] : 0;
      const lat = Number(c[iLat]);
      const lon = Number(c[iLon]);
      add(byDb, c[iDb], pop, f, lat, lon);
      add(byHex, c[iHex], pop, f, lat, lon);
      n++;
    }
    await done;
    console.log(`  ${entry}: done (${n.toLocaleString()} PHH so far)`);
  }
  return { byDb, byHex };
}

async function loadHexagons(sql: Sql, shpZip: string, csvZip: string) {
  const entry = (await zipEntries(shpZip)).find((n) => /^Data_Hex_Donn.*\.shp$/i.test(n));
  if (!entry) throw new Error("Data_Hex_Donnees.shp not found in Map_Data_Shapefile.zip");
  const out = path.join(ensureDir(path.join(BUILD_DIR, "ised")), "hex.geojsonl");
  await run("ogr2ogr", ["-f", "GeoJSONSeq", "-t_srs", "EPSG:4326", "-lco", "COORDINATE_PRECISION=5", "-select", "HEXuid_HEX,Expr2", out, `/vsizip/${shpZip}/${entry}`]);

  let batch: { id: string; code: string; pr: string; band: string; geom: string }[] = [];
  const flush = async () => {
    if (!batch.length) return;
    await sql`
      with r as (
        select * from unnest(${batch.map((b) => b.id)}::text[], ${batch.map((b) => b.code)}::text[], ${batch.map((b) => b.pr)}::text[],
                             ${batch.map((b) => b.band)}::text[], ${batch.map((b) => b.geom)}::text[]) as t (id, code, pr, band, geojson)
      ), g as (
        select r.*, st_multi(st_collectionextract(st_makevalid(st_setsrid(st_geomfromgeojson(r.geojson), 4326)), 3))::geometry(MultiPolygon, 4326) as geom from r
      ), ins as (
        insert into bb.regions (id, level, code, name_en, name_fr, pr_code, slug, geom, bbox)
        select id, 'hex', code, 'Hexagon ' || code, 'Hexagone ' || code, pr, lower(code), geom,
               array[st_xmin(geom), st_ymin(geom), st_xmax(geom), st_ymax(geom)]
        from g
        on conflict (id) do nothing
      )
      insert into bb.ised_hex (hex_id, avail_50_10_band)
      select id, band from g on conflict (hex_id) do update set avail_50_10_band = excluded.avail_50_10_band`;
    batch = [];
  };
  let n = 0;
  for await (const line of readLines(out)) {
    const f = JSON.parse(line) as { properties: Record<string, string>; geometry: unknown };
    const code = f.properties.HEXuid_HEX;
    const prov = provinceByAbbr.get(code?.slice(0, 2));
    if (!code || !prov) continue;
    batch.push({ id: `hex:${code}`, code, pr: prov.code, band: f.properties.Expr2 ?? "", geom: JSON.stringify(f.geometry) });
    n++;
    if (batch.length >= 500) await flush();
  }
  await flush();
  console.log(`  ${n.toLocaleString()} hexagons`);

  // Providers per hexagon (CSV variant is much smaller than the shapefile).
  const csvEntries = await zipEntries(csvZip);
  const ispEntry = csvEntries.find((n) => /^ISP_Hex_FSI\.csv$/i.test(n));
  if (ispEntry) {
    const { rl, done } = await lines(csvZip, ispEntry);
    let header = true;
    let rows: [string, string, string][] = [];
    const flushP = async () => {
      if (!rows.length) return;
      await sql`
        insert into bb.ised_hex_providers (hex_id, provider, technology)
        select t.h, t.p, t.t from unnest(${rows.map((r) => r[0])}::text[], ${rows.map((r) => r[1])}::text[], ${rows.map((r) => r[2])}::text[]) t (h, p, t)
        join bb.regions r on r.id = t.h
        on conflict do nothing`;
      rows = [];
    };
    for await (const raw of rl) {
      if (header) {
        header = false;
        continue;
      }
      const [hex, name, tech] = parseCsvLine(raw);
      if (!hex || !name) continue;
      // "Xplore - 3583" → "Xplore": drop ISED's internal project numbers
      rows.push([`hex:${hex}`, name.replace(/\s+-\s+\d+$/, "").trim(), tech]);
      if (rows.length >= 5000) await flushP();
    }
    await flushP();
    await done;
  }
}

await runJob("ised", async (sql) => {
  const a = args();
  const force = Boolean(a.refresh);
  const dir = ensureDir(path.join(RAW_DIR, "ised"));
  const shpZip = await download(`${ISED}/Map_Data_Shapefile.zip`, path.join(dir, "Map_Data_Shapefile.zip"), force);
  const csvZip = await download(`${ISED}/Map_Data_CSV.zip`, path.join(dir, "Map_Data_CSV.zip"), force);
  const phhZip = await download(`${ISED}/PHH_2021_CSV.zip`, path.join(dir, "PHH_2021_CSV.zip"), force);
  const speedsZip = await download(`${ISED}/NBD_PHH_Speeds.zip`, path.join(dir, "NBD_PHH_Speeds.zip"), force);

  const [{ n: haveCsd }] = await sql<{ n: number }[]>`select count(*)::int as n from bb.regions where level in ('csd', 'cd')`;
  if (!haveCsd) throw new Error("Load boundaries first: pnpm pipeline:boundaries");

  console.log("1/4 hexagons + providers");
  await sql`truncate bb.ised_hex_providers, bb.ised_hex, bb.region_availability`;
  await sql`delete from bb.regions where level = 'hex'`;
  await loadHexagons(sql, shpZip, csvZip);

  console.log("2/4 pseudo-household availability");
  const flags = await readSpeeds(speedsZip);
  const { byDb, byHex } = await aggregatePhh(phhZip, flags);

  console.log("3/4 uploading aggregates");
  await sql`drop table if exists bb.stage_db_agg`;
  await sql`create unlogged table bb.stage_db_agg (dbuid text primary key, pop real, pop5010 real, lat double precision, lon double precision, csd_id text)`;
  const dbRows = [...byDb.entries()];
  for (let i = 0; i < dbRows.length; i += 10_000) {
    const chunk = dbRows.slice(i, i + 10_000);
    await sql`
      insert into bb.stage_db_agg (dbuid, pop, pop5010, lat, lon)
      select * from unnest(${chunk.map(([k]) => k)}::text[], ${chunk.map(([, v]) => v.pop)}::real[], ${chunk.map(([, v]) => v.pop5010)}::real[],
                           ${chunk.map(([, v]) => v.lat / v.w)}::float8[], ${chunk.map(([, v]) => v.lon / v.w)}::float8[])`;
  }
  const hexRows = [...byHex.entries()];
  for (let i = 0; i < hexRows.length; i += 10_000) {
    const chunk = hexRows.slice(i, i + 10_000);
    await sql`
      update bb.ised_hex h set population = t.pop, pop_50_10 = t.p5, pop_lte = t.pl
      from unnest(${chunk.map(([k]) => `hex:${k}`)}::text[], ${chunk.map(([, v]) => v.pop)}::real[],
                  ${chunk.map(([, v]) => v.pop5010)}::real[], ${chunk.map(([, v]) => v.popLte)}::real[]) as t (id, pop, p5, pl)
      where h.hex_id = t.id`;
  }

  console.log("4/4 rolling up to subdivisions, divisions, provinces");
  await sql`
    update bb.stage_db_agg s set csd_id = p.region_id
    from bb.region_parts p
    where p.level = 'csd' and st_intersects(p.geom, st_setsrid(st_makepoint(s.lon, s.lat), 4326))`;
  await sql`
    insert into bb.region_availability (region_id, population, pop_50_10)
    select r.id, x.pop, x.p5 from (
      select 'pr:' || left(dbuid, 2) as id, sum(pop) as pop, sum(pop5010) as p5 from bb.stage_db_agg group by 1
      union all
      select 'cd:' || left(dbuid, 4), sum(pop), sum(pop5010) from bb.stage_db_agg group by 1
      union all
      select csd_id, sum(pop), sum(pop5010) from bb.stage_db_agg where csd_id is not null group by 1
      union all
      select hex_id, population, pop_50_10 from bb.ised_hex
    ) x join bb.regions r on r.id = x.id
    where x.pop > 0
    on conflict (region_id) do update set population = excluded.population, pop_50_10 = excluded.pop_50_10`;
  await sql`update bb.regions r set population = round(a.population) from bb.region_availability a where a.region_id = r.id`;
  // hexagon → subdivision containing its centre (for breadcrumbs / parent links)
  await sql`
    update bb.regions h set parent_id = p.region_id
    from bb.region_parts p
    where h.level = 'hex' and p.level = 'csd' and st_intersects(p.geom, st_pointonsurface(h.geom))`;
  const [stats] = await sql<{ dbs: number; unassigned: number; hex: number; providers: number }[]>`
    select (select count(*)::int from bb.stage_db_agg) as dbs,
           (select count(*)::int from bb.stage_db_agg where csd_id is null) as unassigned,
           (select count(*)::int from bb.ised_hex) as hex,
           (select count(*)::int from bb.ised_hex_providers) as providers`;
  await sql`drop table bb.stage_db_agg`;
  return stats;
});

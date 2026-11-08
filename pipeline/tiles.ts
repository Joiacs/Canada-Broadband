/**
 * Build public/tiles/boundaries.pmtiles from bb.regions with tippecanoe.
 *
 *   pnpm pipeline:tiles [--out path]
 *
 * One file holds four source-layers (pr, cd, csd, hex). Every feature carries:
 *   rid  region id (MapLibre `promoteId`, used for feature-state joins)
 *   ne / nf  English / French name
 *   ap   % of population with 50/10 advertised (ISED), rounded
 * so the "advertised" view renders with no API call at all.
 *
 * In production upload the file to object storage (Cloudflare R2 / Supabase
 * Storage) and point NEXT_PUBLIC_TILES_URL at it — see README.
 */
import { createWriteStream } from "node:fs";
import { once } from "node:events";
import path from "node:path";
import { args, BUILD_DIR, ROOT } from "./lib/env";
import { runJob } from "./lib/db";
import { ensureDir, run } from "./lib/files";

const ZOOMS: Record<string, [number, number]> = { pr: [0, 11], cd: [2, 11], csd: [4, 11], hex: [5, 11] };

await runJob("tiles", async (sql) => {
  const a = args();
  const out = path.resolve(typeof a.out === "string" ? a.out : path.join(ROOT, "public", "tiles", "boundaries.pmtiles"));
  ensureDir(path.dirname(out));
  const seq = path.join(ensureDir(path.join(BUILD_DIR, "tiles")), "regions.geojsonl");

  const ws = createWriteStream(seq);
  const counts: Record<string, number> = {};
  const cursor = sql<{ id: string; level: string; name_en: string; name_fr: string; ap: number | null; g: string }[]>`
    select r.id, r.level, r.name_en, r.name_fr, round(a.avail_50_10_pct)::int as ap,
           st_asgeojson(r.geom, 5) as g
    from bb.regions r
    left join bb.region_availability a on a.region_id = r.id
    order by r.level, r.id`.cursor(500);
  for await (const rows of cursor) {
    for (const r of rows) {
      const [minzoom, maxzoom] = ZOOMS[r.level];
      const props: Record<string, unknown> = { rid: r.id, ne: r.name_en };
      if (r.name_fr !== r.name_en && r.level !== "hex") props.nf = r.name_fr;
      if (r.ap !== null) props.ap = r.ap;
      const line = JSON.stringify({ type: "Feature", properties: props, geometry: JSON.parse(r.g), tippecanoe: { layer: r.level, minzoom, maxzoom } });
      if (!ws.write(line + "\n")) await once(ws, "drain");
      counts[r.level] = (counts[r.level] ?? 0) + 1;
    }
  }
  ws.end();
  await once(ws, "finish");

  await run("tippecanoe", [
    "-o", out, "--force", "-q",
    "-n", "Ideva Broadband regions",
    "-A", "Statistics Canada; ISED National Broadband Data (Open Government Licence – Canada)",
    "-Z0", "-z11",
    "--detect-shared-borders",
    "--no-tile-size-limit",
    "--no-tiny-polygon-reduction",
    "--simplification=2",
    "--read-parallel",
    seq,
  ]);
  return { ...counts, out };
});

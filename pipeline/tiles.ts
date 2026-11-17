/**
 * Build public/tiles/boundaries.pmtiles with tippecanoe.
 *
 * Province / division / community shapes come from the detailed files written
 * by pipeline:boundaries (build/boundaries/tiles-<level>.geojsonl); the
 * database only holds a simplified copy. Hexagons come from the database.
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
import { createWriteStream, existsSync } from "node:fs";
import { once } from "node:events";
import path from "node:path";
import { args, BUILD_DIR, ROOT } from "./lib/env";
import { runJob } from "./lib/db";
import { ensureDir, readLines, run } from "./lib/files";

const ZOOMS: Record<string, [number, number]> = { pr: [0, 11], cd: [0, 11], csd: [4, 11], hex: [5, 11] };

await runJob("tiles", async (sql) => {
  const a = args();
  const out = path.resolve(typeof a.out === "string" ? a.out : path.join(ROOT, "public", "tiles", "boundaries.pmtiles"));
  ensureDir(path.dirname(out));
  const seq = path.join(ensureDir(path.join(BUILD_DIR, "tiles")), "regions.geojsonl");

  const ws = createWriteStream(seq);
  const counts: Record<string, number> = {};
  type Meta = { id: string; level: string; name_en: string; name_fr: string; ap: number | null };
  const write = async (meta: Meta, geometry: unknown) => {
    const [minzoom, maxzoom] = ZOOMS[meta.level];
    const props: Record<string, unknown> = { rid: meta.id, ne: meta.name_en };
    if (meta.name_fr !== meta.name_en && meta.level !== "hex") props.nf = meta.name_fr;
    if (meta.ap !== null) props.ap = meta.ap;
    const line = JSON.stringify({ type: "Feature", properties: props, geometry, tippecanoe: { layer: meta.level, minzoom, maxzoom } });
    if (!ws.write(line + "\n")) await once(ws, "drain");
    counts[meta.level] = (counts[meta.level] ?? 0) + 1;
  };

  const metaRows = await sql<Meta[]>`
    select r.id, r.level, r.name_en, r.name_fr, round(a.avail_50_10_pct)::int as ap
    from bb.regions r left join bb.region_availability a on a.region_id = r.id`;
  const meta = new Map(metaRows.map((m) => [m.id, m]));

  const fromDb: string[] = ["hex"];
  for (const level of ["pr", "cd", "csd"]) {
    const file = path.join(BUILD_DIR, "boundaries", `tiles-${level}.geojsonl`);
    if (!existsSync(file)) {
      fromDb.push(level);
      continue;
    }
    for await (const line of readLines(file)) {
      const f = JSON.parse(line) as { properties: { rid: string }; geometry: unknown };
      const m = meta.get(f.properties.rid);
      if (m) await write(m, f.geometry);
    }
  }

  const cursor = sql<(Meta & { g: string })[]>`
    select r.id, r.level, r.name_en, r.name_fr, round(a.avail_50_10_pct)::int as ap, st_asgeojson(r.geom, 5) as g
    from bb.regions r left join bb.region_availability a on a.region_id = r.id
    where r.level = any(${fromDb}::text[])
    order by r.level, r.id`.cursor(500);
  for await (const rows of cursor) {
    for (const r of rows) await write(r, JSON.parse(r.g));
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

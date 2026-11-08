/**
 * Load Statistics Canada 2021 boundaries (provinces, census divisions, census
 * subdivisions) into bb.regions.
 *
 *   pnpm pipeline:boundaries                      # StatCan 2021 files (preferred)
 *   pnpm pipeline:boundaries --legacy <dir>       # 2023 prototype GeoJSON (dev only)
 *
 * StatCan blocks some automated downloads. If the download fails, open
 * https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/index2021-eng.cfm?year=21
 * in a browser, choose "Cartographic boundary files", Shapefile, and download
 * Provinces/territories, Census divisions and Census subdivisions into
 * pipeline/data/raw/statcan/ (lpr_000b21a_e.zip, lcd_000b21a_e.zip, lcsd_000b21a_e.zip).
 */
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { PROVINCES, provinceByCode, slugify } from "../src/lib/provinces";
import { args, BUILD_DIR, RAW_DIR } from "./lib/env";
import { runJob, type Sql } from "./lib/db";
import { download, ensureDir, readLines, run, zipEntries } from "./lib/files";

const STATCAN_BASE = "https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/files-fichiers";
const FILES = { pr: "lpr_000b21a_e.zip", cd: "lcd_000b21a_e.zip", csd: "lcsd_000b21a_e.zip" } as const;
type Level = keyof typeof FILES;

type Row = {
  id: string;
  level: Level;
  code: string;
  name_en: string;
  name_fr: string;
  pr_code: string;
  parent_id: string | null;
  slug: string;
  geom: string;
};

const pick = (props: Record<string, unknown>, ...keys: string[]) => {
  const lower = Object.fromEntries(Object.entries(props).map(([k, v]) => [k.toLowerCase(), v]));
  for (const k of keys) {
    const v = lower[k.toLowerCase()];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return undefined;
};

async function toGeoJsonSeq(src: string, out: string, simplifyMeters: number) {
  if (existsSync(out)) rmSync(out);
  await run("ogr2ogr", ["-f", "GeoJSONSeq", "-t_srs", "EPSG:4326", "-simplify", String(simplifyMeters), "-lco", "COORDINATE_PRECISION=5", out, src]);
}

async function statcanSources() {
  const dir = ensureDir(path.join(RAW_DIR, "statcan"));
  const out: Record<Level, string> = { pr: "", cd: "", csd: "" };
  for (const level of Object.keys(FILES) as Level[]) {
    const zip = path.join(dir, FILES[level]);
    await download(`${STATCAN_BASE}/${FILES[level]}`, zip);
    const shp = (await zipEntries(zip)).find((n) => n.toLowerCase().endsWith(".shp"));
    if (!shp) throw new Error(`No .shp found in ${zip}`);
    out[level] = `/vsizip/${zip}/${shp}`;
  }
  return out;
}

function rowFromFeature(level: Level, f: { properties: Record<string, unknown>; geometry: unknown }, legacy: boolean): Row | null {
  const p = f.properties;
  const geom = JSON.stringify(f.geometry);
  if (level === "pr") {
    let code = pick(p, "PRUID");
    if (!code && legacy) {
      const name = (pick(p, "name") ?? "").toLowerCase().replace(/ territory$/, "");
      code = PROVINCES.find((x) => x.en.toLowerCase() === name)?.code;
    }
    const prov = code ? provinceByCode.get(code) : undefined;
    if (!prov) return null;
    return { id: `pr:${prov.code}`, level, code: prov.code, name_en: prov.en, name_fr: prov.fr, pr_code: prov.code, parent_id: null, slug: slugify(prov.en), geom };
  }
  if (level === "cd") {
    const code = pick(p, "CDUID");
    const name = pick(p, "CDNAME");
    if (!code || !name) return null;
    const pr = code.slice(0, 2);
    return { id: `cd:${code}`, level, code, name_en: name, name_fr: name, pr_code: pr, parent_id: `pr:${pr}`, slug: slugify(name), geom };
  }
  const code = pick(p, "CSDUID");
  const name = pick(p, "CSDNAME");
  if (!code || !name) return null;
  return { id: `csd:${code}`, level, code, name_en: name, name_fr: name, pr_code: code.slice(0, 2), parent_id: `cd:${code.slice(0, 4)}`, slug: slugify(name), geom };
}

async function insertRows(sql: Sql, rows: Row[]) {
  if (!rows.length) return;
  await sql`
    insert into bb.regions (id, level, code, name_en, name_fr, pr_code, parent_id, slug, geom, bbox)
    select r.id, r.level, r.code, r.name_en, r.name_fr, r.pr_code,
           (select p.id from bb.regions p where p.id = r.parent_id), r.slug, g.geom,
           array[st_xmin(g.geom), st_ymin(g.geom), st_xmax(g.geom), st_ymax(g.geom)]
    from unnest(
      ${rows.map((r) => r.id)}::text[], ${rows.map((r) => r.level)}::text[], ${rows.map((r) => r.code)}::text[],
      ${rows.map((r) => r.name_en)}::text[], ${rows.map((r) => r.name_fr)}::text[], ${rows.map((r) => r.pr_code)}::text[],
      ${rows.map((r) => r.parent_id)}::text[], ${rows.map((r) => r.slug)}::text[], ${rows.map((r) => r.geom)}::text[]
    ) as r (id, level, code, name_en, name_fr, pr_code, parent_id, slug, geojson)
    cross join lateral (
      select st_multi(st_collectionextract(st_makevalid(st_setsrid(st_geomfromgeojson(r.geojson), 4326)), 3))::geometry(MultiPolygon, 4326) as geom
    ) g
    on conflict (id) do update set
      geom = st_multi(st_union(bb.regions.geom, excluded.geom))::geometry(MultiPolygon, 4326),
      bbox = array[least(bb.regions.bbox[1], excluded.bbox[1]), least(bb.regions.bbox[2], excluded.bbox[2]),
                   greatest(bb.regions.bbox[3], excluded.bbox[3]), greatest(bb.regions.bbox[4], excluded.bbox[4])]`;
}

async function load(sql: Sql, level: Level, file: string, legacy: boolean) {
  let batch: Row[] = [];
  let count = 0;
  for await (const line of readLines(file)) {
    const row = rowFromFeature(level, JSON.parse(line), legacy);
    if (!row) continue;
    batch.push(row);
    if (batch.length >= 100) {
      await insertRows(sql, batch);
      count += batch.length;
      batch = [];
    }
  }
  await insertRows(sql, batch);
  count += batch.length;
  console.log(`  ${level}: ${count} features`);
  return count;
}

await runJob("boundaries", async (sql) => {
  const a = args();
  const legacyDir = typeof a.legacy === "string" ? path.resolve(a.legacy) : null;
  const build = ensureDir(path.join(BUILD_DIR, "boundaries"));

  let sources: Partial<Record<Level, string>>;
  if (legacyDir) {
    console.warn("⚠ Using the 2023 prototype boundaries (dev only — no census subdivisions).");
    sources = {
      pr: path.join(legacyDir, "canada_provinces_territories.geojson"),
      cd: path.join(legacyDir, "canada_census_regions_and_cities.geojson"),
    };
  } else {
    sources = await statcanSources();
  }

  const counts: Record<string, number> = {};
  // Replacing boundaries invalidates everything keyed on region ids.
  await sql`truncate bb.region_availability, bb.ised_hex, bb.ised_hex_providers, bb.region_parts, bb.daily_stats`;
  await sql`update bb.community_tests set pr_id = null, cd_id = null, csd_id = null, hex_id = null`;
  await sql`delete from bb.regions`;
  await sql`update bb.mlab_tests set pr_id = null, cd_id = null, csd_id = null`;

  for (const level of ["pr", "cd", "csd"] as Level[]) {
    const src = sources[level];
    if (!src) continue;
    const out = path.join(build, `${level}.geojsonl`);
    // legacy files are in web mercator metres too, so the same tolerance applies
    await toGeoJsonSeq(src, out, level === "pr" ? 100 : 20);
    counts[level] = await load(sql, level, out, Boolean(legacyDir));
  }

  // Divisions in legacy data have codes that may not match a province row.
  await sql`update bb.regions r set parent_id = null where parent_id is not null and not exists (select 1 from bb.regions p where p.id = r.parent_id)`;
  await sql`select bb.refresh_region_parts()`;
  await sql`analyze bb.regions; analyze bb.region_parts`.simple();
  return counts;
});

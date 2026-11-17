/**
 * Copy the processed geography + statistics from the LOCAL database to a
 * remote one (e.g. the Supabase demo), instead of recomputing heavy steps on
 * a small cloud instance.
 *
 *   pnpm pipeline:publish --target-env .env.demo [--yes]
 *
 * - Source: DATABASE_URL from .env.local (must be localhost).
 * - Target: PIPELINE_DATABASE_URL read from the given env file (never localhost).
 * - Two phases so the free plan never holds old + new data at once (500 MB):
 *     1. clear old geography/statistics (one transaction, committed);
 *     2. copy the new data and re-link submissions (one transaction).
 *   If phase 2 fails the demo is empty until you re-run this command (safe to repeat).
 * - Real speed-test submissions on the target are kept, and re-linked to the
 *   new areas wherever the area still exists. Synthetic "devseed" rows are replaced.
 * - Run `supabase db push` against the target first so its schema matches.
 */
import { readFileSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import postgres from "postgres";
import { args, requireEnv } from "./lib/env";

const a = args();
const envFile = typeof a["target-env"] === "string" ? a["target-env"] : null;
if (!envFile) {
  console.error("Usage: pnpm pipeline:publish --target-env .env.demo [--yes]");
  process.exit(1);
}
const targetUrl = /^PIPELINE_DATABASE_URL=(.+)$/m.exec(readFileSync(envFile, "utf8"))?.[1]?.trim().replace(/^['"]|['"]$/g, "");
if (!targetUrl) {
  console.error(`No PIPELINE_DATABASE_URL in ${envFile}`);
  process.exit(1);
}
const sourceUrl = requireEnv("DATABASE_URL");
const isLocal = (u: string) => ["localhost", "127.0.0.1", "::1"].includes(new URL(u).hostname);
if (!isLocal(sourceUrl)) throw new Error("Source must be the local database");
if (isLocal(targetUrl)) throw new Error("Target must not be the local database");

const targetHost = new URL(targetUrl).hostname;
if (!a.yes) {
  console.log(`This will REPLACE geography and statistics on ${targetHost} with your local data.`);
  console.log("Re-run with --yes to proceed.");
  process.exit(0);
}

// Copy order respects foreign keys (regions parents before children).
const TABLES: { name: string; columns: string; select: string }[] = [
  {
    name: "bb.regions",
    columns: "id, level, code, name_en, name_fr, pr_code, parent_id, slug, population, geom, bbox",
    select: "select id, level, code, name_en, name_fr, pr_code, parent_id, slug, population, geom, bbox from bb.regions order by case level when 'pr' then 0 when 'cd' then 1 when 'csd' then 2 else 3 end, id",
  },
  { name: "bb.region_parts", columns: "region_id, level, geom", select: "select region_id, level, geom from bb.region_parts" },
  { name: "bb.ised_hex", columns: "hex_id, avail_50_10_band, population, pop_50_10, pop_lte", select: "select hex_id, avail_50_10_band, population, pop_50_10, pop_lte from bb.ised_hex" },
  { name: "bb.ised_hex_providers", columns: "hex_id, provider, technology", select: "select hex_id, provider, technology from bb.ised_hex_providers" },
  { name: "bb.region_availability", columns: "region_id, population, pop_50_10", select: "select region_id, population, pop_50_10 from bb.region_availability" },
  {
    // synthetic community tests only; ids are assigned by the target
    name: "bb.community_tests",
    columns:
      "created_at, day, mlab_uuid_down, mlab_uuid_up, down_mbps, up_mbps, latency_ms, location_source, pr_id, cd_id, csd_id, hex_id, isp_id, isp_other, connection_type, plan_down_mbps, plan_up_mbps, monthly_price, wired, locale, client_key, status, detected_isp_id, verified_at",
    select:
      "select created_at, day, mlab_uuid_down, mlab_uuid_up, down_mbps, up_mbps, latency_ms, location_source, pr_id, cd_id, csd_id, hex_id, isp_id, isp_other, connection_type, plan_down_mbps, plan_up_mbps, monthly_price, wired, locale, client_key, status, detected_isp_id, verified_at from bb.community_tests where client_key like 'devseed-%'",
  },
  {
    name: "bb.daily_stats",
    columns: "source, direction, day, region_id, isp_id, n, n_meet, hist, rtt_sum, rtt_n",
    select: "select source, direction, day, region_id, isp_id, n, n_meet, hist, rtt_sum, rtt_n from bb.daily_stats",
  },
];

const src = postgres(sourceUrl, { max: 1, onnotice: () => {} });
const dst = postgres(targetUrl, { max: 1, idle_timeout: 0, onnotice: () => {} });
const t0 = Date.now();

try {
  const FKS = ["pr_id", "cd_id", "csd_id", "hex_id"];
  // ---- phase 1: clear (keeps real submissions; their area links are backed up)
  await dst.begin(async (tx) => {
    await tx.unsafe("set local statement_timeout = 0");
    await tx`
      create table if not exists bb.community_area_backup (
        id bigint primary key, pr_id text, cd_id text, csd_id text, hex_id text)`;
    await tx`
      insert into bb.community_area_backup (id, pr_id, cd_id, csd_id, hex_id)
      select id, pr_id, cd_id, csd_id, hex_id from bb.community_tests
      where client_key not like 'devseed-%' and coalesce(pr_id, cd_id, csd_id, hex_id) is not null
      on conflict (id) do update set
        pr_id = coalesce(excluded.pr_id, bb.community_area_backup.pr_id), cd_id = coalesce(excluded.cd_id, bb.community_area_backup.cd_id),
        csd_id = coalesce(excluded.csd_id, bb.community_area_backup.csd_id), hex_id = coalesce(excluded.hex_id, bb.community_area_backup.hex_id)`;
    await tx`delete from bb.community_tests where client_key like 'devseed-%'`;
    await tx`delete from bb.mlab_tests where uuid like 'devseed-%'`;
    await tx`update bb.community_tests set pr_id = null, cd_id = null, csd_id = null, hex_id = null`;
    await tx`update bb.mlab_tests set pr_id = null, cd_id = null, csd_id = null`;
    // TRUNCATE frees space immediately at commit (DELETE would leave dead rows);
    // community_tests' foreign keys must be dropped for it and are re-added in phase 2
    for (const c of FKS) await tx.unsafe(`alter table bb.community_tests drop constraint if exists community_tests_${c}_fkey`);
    await tx`truncate bb.daily_stats, bb.region_availability, bb.ised_hex_providers, bb.ised_hex, bb.region_parts, bb.regions`;
  });
  console.log("  phase 1: old data cleared");

  // ---- phase 2: copy new data, re-link real submissions, restore constraints
  const out = await dst.begin(async (tx) => {
    await tx.unsafe("set local statement_timeout = 0");
    const counts: Record<string, number> = {};
    for (const t of TABLES) {
      const readable = await src.unsafe(`copy (${t.select}) to stdout`).readable();
      const writable = await tx.unsafe(`copy ${t.name} (${t.columns}) from stdin`).writable();
      await pipeline(readable, writable);
      const [{ n }] = await tx.unsafe<{ n: number }[]>(`select count(*)::int as n from ${t.name}`);
      counts[t.name] = n;
      console.log(`  ${t.name}: ${n.toLocaleString()} rows`);
    }

    // re-link real submissions, then rebuild their statistics
    const restored = await tx`
      update bb.community_tests c set
        pr_id  = (select r.id from bb.regions r where r.id = b.pr_id),
        cd_id  = (select r.id from bb.regions r where r.id = b.cd_id),
        csd_id = (select r.id from bb.regions r where r.id = b.csd_id),
        hex_id = (select r.id from bb.regions r where r.id = b.hex_id)
      from bb.community_area_backup b where b.id = c.id`;
    for (const c of FKS) {
      await tx.unsafe(`alter table bb.community_tests add constraint community_tests_${c}_fkey foreign key (${c}) references bb.regions (id)`);
    }
    const [range] = await tx<{ lo: string | null; hi: string | null }[]>`
      select min(day)::text as lo, max(day)::text as hi from bb.community_tests`;
    if (range.lo && range.hi) await tx`select bb.rollup_community(${range.lo}::date, ${range.hi}::date)`;
    return { ...counts, realSubmissionsRelinked: restored.count };
  });
  await dst.unsafe("vacuum analyze bb.regions; vacuum analyze bb.region_parts; vacuum analyze bb.daily_stats").catch(() => {});
  const [{ size }] = await dst<{ size: string }[]>`select pg_size_pretty(pg_database_size(current_database())) as size`;
  console.log(`✔ published to ${targetHost}`, { ...out, targetDatabaseSize: size, seconds: Math.round((Date.now() - t0) / 1000) });
} catch (err) {
  console.error("✘ publish failed. The failed phase was rolled back; if phase 1 had finished, re-run this command to finish publishing:", err);
  process.exitCode = 1;
} finally {
  await src.end({ timeout: 5 });
  await dst.end({ timeout: 5 });
}

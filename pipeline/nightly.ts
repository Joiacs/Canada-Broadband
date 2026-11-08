/**
 * Nightly job (GitHub Actions, see .github/workflows/nightly.yml):
 *  1. import the last few days of M-Lab tests (M-Lab publishes with a 1–2 day lag;
 *     re-importing overlapping days is idempotent)
 *  2. verify community tests against M-Lab's server-side records
 *  3. rebuild rollups
 *  4. enforce retention limits
 *
 *   pnpm pipeline:nightly [--skip-mlab]
 */
import { addDays, args, isoDay } from "./lib/env";
import { runJob } from "./lib/db";
import { ingestRange, processRange } from "./lib/mlab-ingest";

const a = args();
const today = isoDay(new Date());
const from = addDays(today, -Number(process.env.MLAB_LOOKBACK_DAYS ?? 4));
const to = addDays(today, -1);
const retentionDays = Number(process.env.RAW_RETENTION_DAYS ?? 21);

await runJob("nightly", async (sql) => {
  const out: Record<string, unknown> = { from, to };

  if (!a["skip-mlab"]) {
    out.ingest = await ingestRange(sql, from, to);
    out.process = await processRange(sql, from, to);
  }

  const [{ verify_community_tests: verification }] = await sql<{ verify_community_tests: unknown }[]>`select bb.verify_community_tests()`;
  out.verification = verification;

  // Community rollups for the window in which statuses can still change.
  const [{ rollup_community: communityRows }] = await sql<{ rollup_community: number }[]>`
    select bb.rollup_community(${addDays(today, -10)}, ${today})`;
  out.communityRollupRows = communityRows;

  // Retention: raw M-Lab rows are re-downloadable; rollups are kept forever.
  const del = await sql`delete from bb.mlab_tests where day < ${addDays(today, -retentionDays)}`;
  out.rawDeleted = del.count;
  await sql`delete from bb.rate_limits where window_start < now() - interval '2 days'`;
  await sql`delete from bb.pipeline_runs where started_at < now() - interval '180 days'`;
  return out;
});

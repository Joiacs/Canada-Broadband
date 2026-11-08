/**
 * Backfill / re-import M-Lab NDT tests for Canada.
 *
 *   pnpm pipeline:mlab --from 2023-01-01 --to 2026-11-01 [--chunk 7]
 *
 * Needs GCP_PROJECT_ID (a Google Cloud project for BigQuery billing) and
 * Application Default Credentials (`gcloud auth application-default login`
 * locally, Workload Identity Federation in GitHub Actions).
 */
import { addDays, args } from "./lib/env";
import { runJob } from "./lib/db";
import { ingestRange, processRange } from "./lib/mlab-ingest";

const a = args();
const from = String(a.from ?? "");
const to = String(a.to ?? "");
const chunk = Number(a.chunk ?? 7);
if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
  console.error("Usage: pnpm pipeline:mlab --from YYYY-MM-DD --to YYYY-MM-DD [--chunk 7]");
  process.exit(1);
}

await runJob("mlab-backfill", async (sql) => {
  const totals = { fetched: 0, inserted: 0, scannedGb: 0, rollupRows: 0 };
  for (let start = from; start <= to; start = addDays(start, chunk)) {
    const end = addDays(start, chunk - 1) < to ? addDays(start, chunk - 1) : to;
    const ing = await ingestRange(sql, start, end);
    const proc = await processRange(sql, start, end);
    console.log(`  ${start} → ${end}`, { ...ing, ...proc });
    totals.fetched += ing.fetched;
    totals.inserted += ing.inserted;
    totals.scannedGb += ing.scannedGb;
    totals.rollupRows += proc.rollupRows;
  }
  return { from, to, ...totals };
});

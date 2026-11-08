# Operations

## Nightly job
`.github/workflows/nightly.yml` runs at 09:17 UTC:

1. Re-imports the last `MLAB_LOOKBACK_DAYS` (default 4) of M-Lab tests. M-Lab publishes with a 1–2 day lag, and re-importing is idempotent.
2. Maps new networks (ASNs) to providers, assigns regions, and rebuilds M-Lab rollups for those days.
3. Verifies community tests and rebuilds community rollups for the last 10 days.
4. Deletes raw M-Lab rows older than `RAW_RETENTION_DAYS` (default 21), old rate-limit rows and old run logs.
5. Calls `SITE_URL/api/health`.

Every run is logged:

```sql
select job, started_at, finished_at, ok, detail from bb.pipeline_runs order by started_at desc limit 10;
```

GitHub emails repo admins when a scheduled workflow fails. The map keeps showing the previous data in the meantime.

## Monitoring
- **Uptime:** point a monitor at `/api/health`. It returns 503 if the database is unreachable, and includes `latest` (newest data day) and `last_ok` (last nightly result). Alert if `latest` is more than 4 days old.
- **Errors:** Vercel → Logs (function errors). Adding Sentry later is straightforward if needed.
- **Database:** Supabase → Reports (size, connections). The main growth is `bb.daily_stats`, about 200–300 MB per year.

## Caching
- Data functions use `"use cache"` with an hour's lifetime, and API responses send `s-maxage=3600`, so new data appears within about an hour of the nightly job.
- To force fresh data immediately, redeploy on Vercel (cache entries are keyed by build).
- Tiles are cached for a day in browsers and a week at the edge. When you upload new tiles, purge the R2 custom-domain cache in Cloudflare, or upload under a new filename and update `NEXT_PUBLIC_TILES_URL`.

## Maintaining the provider list
New networks are matched to brands automatically by name (`bb.isps.match_pattern`). Review the busiest unmatched networks every month or two:

```sql
select * from bb.unmapped_asns limit 30;
-- assign one:
insert into bb.isp_asns (asn, isp_id, note) values (12345, (select id from bb.isps where slug = 'bell'), 'manual');
-- add a brand:
insert into bb.isps (slug, name, match_pattern) values ('acme', 'Acme Internet', 'acme');
```

Then re-roll the affected period so per-provider numbers update. Run the backfill workflow for recent months, or:

```sql
update bb.mlab_tests t set isp_id = a.isp_id from bb.isp_asns a where a.asn = t.asn;
select bb.rollup_mlab(current_date - 21, current_date);
```

## Abuse handling
Speed-test submissions are limited to 5 per hour and 10 per day per connection, need a valid Turnstile token, and are verified against M-Lab. To remove a burst of bad submissions:

```sql
update bb.community_tests set status = 'rejected' where created_at > now() - interval '1 day' and <condition>;
select bb.rollup_community(current_date - 10, current_date);
```

## Costs (approximate, monthly)

| Item | Cost |
|---|---|
| Vercel Pro | US$20 |
| Supabase Pro (8 GB included) | US$25 |
| Cloudflare R2 (< 10 GB, no egress fees) + Turnstile | $0 |
| BigQuery (nightly ~4-day window) | ~$0 (normally inside the free monthly 1 TB of queries) |
| Domain | ~$2 |

A large history backfill scans more data. Do it in chunks and watch the dry-run estimate the pipeline prints.

## Troubleshooting

| Symptom | Check |
|---|---|
| Map shows no colours | `/api/meta`: is `latest` null? Run the pipeline. Are `NEXT_PUBLIC_TILES_URL` and the R2 CORS rule correct? Check the browser console for 403s on `.pmtiles` |
| "Census subdivisions" empty | Boundaries were loaded with `--legacy`. Load the StatCan files |
| Speed test fails immediately | Ad blockers sometimes block `locate.measurementlab.net`. M-Lab may be rate-limiting (consider integrator registration) |
| Submissions return `captcha` | Turnstile keys don't match the domain, or the secret is missing in Vercel |
| Nightly job: `client.IP not available` warning | M-Lab changed its view schema. Data still imports, without per-client de-duplication. Check M-Lab's docs and update the query or set `MLAB_DOWNLOAD_VIEW` / `MLAB_UPLOAD_VIEW` |
| Nightly job: "would scan X GB" | Raise `MLAB_MAX_GB_PER_QUERY` only if you expect it; otherwise the date window is too large |

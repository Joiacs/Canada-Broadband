/**
 * Fills the database with *synthetic* (fake) tests so the map has something to
 * draw before real M-Lab data is loaded. For local development and demo sites.
 *
 *   pnpm pipeline:dev-seed [--days 120] [--slim] [--clear] [--allow-remote]
 *
 *   --slim          delete the raw fake tests after building the statistics
 *                   (the map only needs the statistics; saves ~60% of space —
 *                   use on Supabase's free plan)
 *   --allow-remote  required to seed anything other than a local database.
 *                   Only use on a DEMO database: fake numbers would mix with
 *                   real ones on a production site.
 *   --clear         remove all fake data and stop
 *
 * Synthetic rows use ids starting with "devseed-".
 */
import { addDays, args, isoDay } from "./lib/env";
import { pipelineUrl, runJob } from "./lib/db";
import { processRange } from "./lib/mlab-ingest";

const a = args();
const url = new URL(pipelineUrl());
if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname) && !a["allow-remote"]) {
  console.error(`Refusing to seed synthetic data into a non-local database (${url.hostname}). Add --allow-remote only for a demo database.`);
  process.exit(1);
}

const days = Number(a.days ?? 120);
const to = addDays(isoDay(new Date()), -1);
const from = addDays(to, -(days - 1));

await runJob("dev-seed", async (sql) => {
  await sql`delete from bb.mlab_tests where uuid like 'devseed-%'`;
  await sql`delete from bb.community_tests where client_key like 'devseed-%'`;
  await sql`delete from bb.daily_stats`;
  if (a.clear) return { cleared: true };

  // Speeds loosely follow advertised availability so the map looks plausible.
  const res = await sql`
    with regions as (
      select r.id, r.level, st_pointonsurface(r.geom) as pt,
             greatest(1, least(40, coalesce(r.population, 20000) / 25000))::int as per_day,
             coalesce(a.avail_50_10_pct, 60) / 100.0 as av
      from bb.regions r left join bb.region_availability a on a.region_id = r.id
      where r.level = (case when exists (select 1 from bb.regions where level = 'csd') then 'csd' else 'cd' end)
    ), isps as (
      select array_agg(i.id order by i.id) ids, array_agg(a.asn order by i.id) asns
      from bb.isps i join lateral (select asn from bb.isp_asns where isp_id = i.id limit 1) a on true
    ), gen as (
      select g.id, g.pt, g.av, d::date as day, dir, s,
             random() as u1, random() as u2, random() as u3
      from regions g
      cross join generate_series(${from}::date, ${to}::date, interval '1 day') d
      cross join (values ('down'), ('up')) v (dir)
      cross join lateral generate_series(1, g.per_day) s
    )
    insert into bb.mlab_tests (uuid, day, direction, mbps, min_rtt_ms, client_key, asn, lat, lon)
    select 'devseed-' || gen_random_uuid(), day, dir,
           greatest(0.2, exp(ln(case when dir = 'down' then 15 + 260 * power(av, 4) else 3 + 60 * power(av, 4) end)
                + 0.9 * sqrt(-2 * ln(greatest(u1, 1e-9))) * cos(2 * pi() * u2))),
           8 + 60 * (1 - av) + 30 * u3,
           'devseed-' || md5(id || day || s),
           (select asns[1 + floor(u3 * array_length(asns, 1))::int] from isps),
           st_y(pt) + (u2 - 0.5) * 0.001, st_x(pt) + (u1 - 0.5) * 0.001
    from gen`;

  // A sprinkle of community tests in populated hexagons.
  await sql`
    insert into bb.community_tests (day, down_mbps, up_mbps, latency_ms, location_source, pr_id, cd_id, csd_id, hex_id,
                                    isp_id, connection_type, client_key, status)
    select ${to}::date - (random() * 20)::int,
           greatest(0.5, exp(ln(20 + 300 * power(coalesce(h.pop_50_10 / nullif(h.population, 0), 0.5), 3)) + 0.8 * (random() - 0.5) * 3)),
           greatest(0.2, exp(ln(5 + 50 * power(coalesce(h.pop_50_10 / nullif(h.population, 0), 0.5), 3)) + 0.8 * (random() - 0.5) * 3)),
           10 + random() * 60, 'gps', 'pr:' || r.pr_code,
           (select p.region_id from bb.region_parts p where p.level = 'cd' and st_intersects(p.geom, st_pointonsurface(r.geom)) limit 1),
           r.parent_id, r.id,
           (select id from bb.isps order by random() limit 1),
           (array['fibre','cable','dsl','fixed_wireless','satellite_leo'])[1 + floor(random() * 5)::int],
           'devseed-' || md5(random()::text), 'verified'
    from bb.ised_hex h join bb.regions r on r.id = h.hex_id
    where h.population > 500
    order by random() limit 1500`;

  const proc = await processRange(sql, from, to);
  const [{ rollup_community: community }] = await sql<{ rollup_community: number }[]>`select bb.rollup_community(${addDays(to, -30)}, ${to})`;

  if (a.slim) {
    // statistics are already built; the raw fake rows aren't needed any more
    await sql`delete from bb.mlab_tests where uuid like 'devseed-%'`;
    await sql`vacuum (full, analyze) bb.mlab_tests`;
  }
  const [{ size }] = await sql<{ size: string }[]>`select pg_size_pretty(pg_database_size(current_database())) as size`;
  return { from, to, tests: res.count, ...proc, communityRollupRows: community, slim: Boolean(a.slim), databaseSize: size };
});

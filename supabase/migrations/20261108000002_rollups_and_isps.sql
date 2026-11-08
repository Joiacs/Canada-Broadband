set search_path = bb, public;

-------------------------------------------------------------------------------
-- Subdivided polygons make point-in-polygon lookups fast on complex coastlines.
-------------------------------------------------------------------------------
create table bb.region_parts (
  region_id  text not null references bb.regions (id) on delete cascade,
  level      text not null,
  geom       geometry (Polygon, 4326) not null
);
create index region_parts_geom_idx on bb.region_parts using gist (geom);
create index region_parts_level_idx on bb.region_parts (level);

create or replace function bb.refresh_region_parts() returns void language sql as $$
  truncate bb.region_parts;
  insert into bb.region_parts (region_id, level, geom)
  select id, level, (st_dump(st_subdivide(geom, 256))).geom
  from bb.regions where level in ('pr', 'cd', 'csd');
$$;

create or replace function bb.region_at(lon double precision, lat double precision, lvl text)
returns text language sql stable parallel safe as $$
  select region_id from bb.region_parts
  where level = lvl and st_intersects(geom, st_setsrid(st_makepoint(lon, lat), 4326))
  limit 1
$$;

create or replace function bb.hex_at(lon double precision, lat double precision)
returns text language sql stable parallel safe as $$
  select id from bb.regions
  where level = 'hex' and st_intersects(geom, st_setsrid(st_makepoint(lon, lat), 4326))
  limit 1
$$;

-- Assign province / division / subdivision to raw M-Lab rows in a date range.
create or replace function bb.assign_mlab_regions(d_from date, d_to date) returns integer
language plpgsql as $$
declare n integer;
begin
  update bb.mlab_tests t set
    pr_id  = (select p.region_id from bb.region_parts p where p.level = 'pr'  and st_intersects(p.geom, st_setsrid(st_makepoint(t.lon, t.lat), 4326)) limit 1),
    cd_id  = (select p.region_id from bb.region_parts p where p.level = 'cd'  and st_intersects(p.geom, st_setsrid(st_makepoint(t.lon, t.lat), 4326)) limit 1),
    csd_id = (select p.region_id from bb.region_parts p where p.level = 'csd' and st_intersects(p.geom, st_setsrid(st_makepoint(t.lon, t.lat), 4326)) limit 1)
  where t.day between d_from and d_to and t.pr_id is null and t.lat is not null and t.lon is not null;
  get diagnostics n = row_count;
  return n;
end $$;

-------------------------------------------------------------------------------
-- Rollups
-------------------------------------------------------------------------------
create or replace function bb.target_mbps(direction text) returns double precision
language sql immutable parallel safe as $$
  select case direction when 'down' then 50 else 10 end::double precision
$$;

create index community_tests_uuid_up_idx on bb.community_tests (mlab_uuid_up) where mlab_uuid_up is not null;

create or replace function bb.rollup_mlab(d_from date, d_to date) returns integer
language plpgsql as $$
declare n integer;
begin
  delete from bb.daily_stats where source = 'mlab' and day between d_from and d_to;

  with excluded as (
    -- tests that came from our own speed-test page are counted (with better
    -- location data) under source = 'community', so skip them here
    select mlab_uuid_down as uuid from bb.community_tests where mlab_uuid_down is not null
    union
    select mlab_uuid_up from bb.community_tests where mlab_uuid_up is not null
  ),
  per_client as (
    select t.day, t.direction, coalesce(t.client_key, t.uuid) as ck,
           coalesce(t.isp_id, -1) as isp_id, t.pr_id, t.cd_id, t.csd_id,
           percentile_cont(0.5) within group (order by t.mbps) as mbps,
           min(t.min_rtt_ms) as rtt
    from bb.mlab_tests t
    where t.day between d_from and d_to
      and t.pr_id is not null
      and t.uuid not in (select uuid from excluded)
    group by 1, 2, 3, 4, 5, 6, 7
  ),
  expanded as (
    select pc.day, pc.direction, pc.isp_id, pc.mbps, pc.rtt, r.region_id, r.lvl
    from per_client pc
    cross join lateral (values (pc.pr_id, 'pr'), (pc.cd_id, 'cd'), (pc.csd_id, 'csd')) as r (region_id, lvl)
    where r.region_id is not null
  )
  insert into bb.daily_stats (source, direction, day, region_id, isp_id, n, n_meet, hist, rtt_sum, rtt_n)
  select 'mlab', direction, day, region_id,
         case when grouping(isp_id) = 1 then 0 else isp_id end,
         count(*),
         count(*) filter (where mbps >= bb.target_mbps(direction)),
         bb.hist_agg(mbps),
         coalesce(sum(rtt), 0),
         count(rtt)
  from expanded
  group by grouping sets ((direction, day, region_id, lvl), (direction, day, region_id, lvl, isp_id))
  -- per-ISP rows only for province & division (keeps the table small)
  having grouping(isp_id) = 1 or (lvl in ('pr', 'cd') and isp_id > 0);

  get diagnostics n = row_count;
  return n;
end $$;

create or replace function bb.rollup_community(d_from date, d_to date) returns integer
language plpgsql as $$
declare n integer;
begin
  delete from bb.daily_stats where source = 'community' and day between d_from and d_to;

  with eligible as (
    select c.*
    from bb.community_tests c
    where c.day between d_from and d_to
      and (c.status = 'verified' or (c.status = 'pending' and c.created_at > now() - interval '7 days'))
  ),
  unpivoted as (
    select day, client_key, coalesce(detected_isp_id, isp_id, -1) as isp_id,
           pr_id, cd_id, csd_id, hex_id, d.direction, d.mbps, latency_ms
    from eligible
    cross join lateral (values ('down', down_mbps), ('up', up_mbps)) as d (direction, mbps)
  ),
  per_client as (
    select day, direction, client_key, isp_id, pr_id, cd_id, csd_id, hex_id,
           percentile_cont(0.5) within group (order by mbps) as mbps,
           min(latency_ms) as rtt
    from unpivoted
    group by 1, 2, 3, 4, 5, 6, 7, 8
  ),
  expanded as (
    select pc.day, pc.direction, pc.isp_id, pc.mbps, pc.rtt, r.region_id, r.lvl
    from per_client pc
    cross join lateral (values (pc.pr_id, 'pr'), (pc.cd_id, 'cd'), (pc.csd_id, 'csd'), (pc.hex_id, 'hex')) as r (region_id, lvl)
    where r.region_id is not null
  )
  insert into bb.daily_stats (source, direction, day, region_id, isp_id, n, n_meet, hist, rtt_sum, rtt_n)
  select 'community', direction, day, region_id,
         case when grouping(isp_id) = 1 then 0 else isp_id end,
         count(*),
         count(*) filter (where mbps >= bb.target_mbps(direction)),
         bb.hist_agg(mbps),
         coalesce(sum(rtt), 0),
         count(rtt)
  from expanded
  group by grouping sets ((direction, day, region_id, lvl), (direction, day, region_id, lvl, isp_id))
  having grouping(isp_id) = 1 or (lvl in ('pr', 'cd') and isp_id > 0);

  get diagnostics n = row_count;
  return n;
end $$;

-------------------------------------------------------------------------------
-- Community test verification against M-Lab's server-side records.
-- A submitted test carries the M-Lab UUID of its download/upload. Once M-Lab
-- publishes that test (usually 1–2 days later) we compare the numbers.
-------------------------------------------------------------------------------
create or replace function bb.verify_community_tests() returns jsonb
language plpgsql as $$
declare v integer; r integer; u integer;
begin
  -- verified: download within 30% of M-Lab's server-side measurement
  with m as (
    select c.id, t.mbps as server_mbps, t.isp_id, c.down_mbps
    from bb.community_tests c
    join bb.mlab_tests t on t.uuid = c.mlab_uuid_down
    where c.status = 'pending'
  )
  update bb.community_tests c set
    status = case when abs(m.server_mbps - m.down_mbps) <= greatest(0.3 * m.server_mbps, 1) then 'verified' else 'rejected' end,
    detected_isp_id = m.isp_id,
    verified_at = now()
  from m where c.id = m.id;
  get diagnostics v = row_count;

  select count(*) into r from bb.community_tests where status = 'rejected' and verified_at > now() - interval '1 minute';

  -- unverifiable: never showed up in M-Lab's Canadian data after 7 days
  update bb.community_tests set status = 'unverifiable', verified_at = now()
  where status = 'pending' and created_at < now() - interval '7 days';
  get diagnostics u = row_count;

  return jsonb_build_object('checked', v, 'rejected', r, 'unverifiable', u);
end $$;

-------------------------------------------------------------------------------
-- ISP brands. ASNs are mapped automatically during ingest by matching M-Lab's
-- AS name against `match_pattern`; a few well-known ASNs are pinned below.
-------------------------------------------------------------------------------
alter table bb.isps add column match_pattern text;

insert into bb.isps (slug, name, match_pattern) values
  ('bell',        'Bell',                 '(^|[^a-z])bell([^a-z]|$)|bell aliant|bell mts|^mts inc|aliant'),
  ('rogers',      'Rogers (incl. Shaw)',  'rogers|^shaw|shaw communications|fido'),
  ('telus',       'TELUS',                'telus'),
  ('videotron',   'Vidéotron',            'vid[eé]otron|fizz'),
  ('freedom',     'Freedom',              'freedom mobile'),
  ('cogeco',      'Cogeco',               'cogeco'),
  ('eastlink',    'Eastlink',             'eastlink|bragg'),
  ('sasktel',     'SaskTel',              'sasktel|saskatchewan telecom'),
  ('xplore',      'Xplore',               'xplore|xplornet'),
  ('starlink',    'Starlink',             'space exploration|spacex|starlink'),
  ('teksavvy',    'TekSavvy',             'teksavvy'),
  ('distributel', 'Distributel',          'distributel'),
  ('beanfield',   'Beanfield',            'beanfield'),
  ('tbaytel',     'Tbaytel',              'tbaytel|tbay tel'),
  ('novus',       'Novus',                'novus'),
  ('execulink',   'Execulink',            'execulink'),
  ('ccap',        'CCAP / other cable co-ops', null);

update bb.isps set listed = false where slug = 'ccap';

insert into bb.isp_asns (asn, isp_id, note)
select v.asn, i.id, v.note
from (values
  (577,   'bell',      'Bell Canada'),
  (7122,  'bell',      'Bell MTS (formerly MTS)'),
  (812,   'rogers',    'Rogers Communications Canada'),
  (6327,  'rogers',    'Shaw Communications (Rogers since 2023)'),
  (852,   'telus',     'TELUS Communications'),
  (5769,  'videotron', 'Videotron Telecom'),
  (7992,  'cogeco',    'Cogeco Connexion'),
  (11260, 'eastlink',  'Eastlink'),
  (803,   'sasktel',   'SaskTel'),
  (5645,  'teksavvy',  'TekSavvy Solutions'),
  (14593, 'starlink',  'Space Exploration Technologies (Starlink)')
) as v (asn, slug, note)
join bb.isps i on i.slug = v.slug;

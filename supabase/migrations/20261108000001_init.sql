-- Ideva Broadband — initial schema
-- Applied locally with `supabase db reset` and to production with `supabase db push`.

create extension if not exists postgis;
create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- All application tables live in their own schema so the Supabase Data API
-- (which exposes `public`) never exposes them. The app connects directly with
-- a server-side connection string.
create schema if not exists bb;
set search_path = bb, public;

-------------------------------------------------------------------------------
-- Geography
-------------------------------------------------------------------------------
-- id format: '<level>:<code>' e.g. 'pr:35', 'cd:3520', 'csd:3520005', 'hex:ON49481118'
create table bb.regions (
  id           text primary key,
  level        text not null check (level in ('pr', 'cd', 'csd', 'hex')),
  code         text not null,
  name_en      text not null,
  name_fr      text not null,
  pr_code      text not null,               -- 2-digit StatCan province code
  parent_id    text references bb.regions (id) on delete set null,
  slug         text not null,
  population   integer,                     -- 2021 census / ISED PHH estimate
  geom         geometry (MultiPolygon, 4326) not null,
  bbox         double precision[] not null,  -- [minLon, minLat, maxLon, maxLat]
  search_text  text generated always as (lower(name_en || ' ' || name_fr)) stored
);
create index regions_geom_idx on bb.regions using gist (geom);
create index regions_level_idx on bb.regions (level);
create index regions_parent_idx on bb.regions (parent_id);
create index regions_search_idx on bb.regions using gin (search_text gin_trgm_ops);

-- Point → region lookup for a given level (smallest match wins for safety).
create or replace function bb.region_at(lon double precision, lat double precision, lvl text)
returns text language sql stable parallel safe as $$
  select id from bb.regions
  where level = lvl and st_intersects(geom, st_setsrid(st_makepoint(lon, lat), 4326))
  order by st_area(geom) asc
  limit 1
$$;

-------------------------------------------------------------------------------
-- Internet service providers
-------------------------------------------------------------------------------
create table bb.isps (
  id        serial primary key,
  slug      text not null unique,
  name      text not null,
  -- shown in the ISP filter / speed-test survey
  listed    boolean not null default true
);

-- Autonomous System Number → ISP brand. Many ASNs can belong to one brand
-- (e.g. Shaw's ASNs now count toward Rogers).
create table bb.isp_asns (
  asn     integer primary key,
  isp_id  integer not null references bb.isps (id) on delete cascade,
  note    text
);

-------------------------------------------------------------------------------
-- Raw M-Lab NDT tests (Canada only). Kept for a limited retention window;
-- the rollup table below is permanent.
-------------------------------------------------------------------------------
create table bb.mlab_tests (
  uuid        text primary key,
  day         date not null,
  ts          timestamptz,
  direction   text not null check (direction in ('down', 'up')),
  mbps        real not null,
  min_rtt_ms  real,
  loss_rate   real,
  client_key  text,           -- salted hash of client IP (never the IP itself)
  asn         integer,
  isp_id      integer references bb.isps (id),
  lat         real,
  lon         real,
  pr_id       text,
  cd_id       text,
  csd_id      text
);
create index mlab_tests_day_idx on bb.mlab_tests (day);
create index mlab_tests_unassigned_idx on bb.mlab_tests (day) where pr_id is null;

-------------------------------------------------------------------------------
-- Community tests submitted from our own speed-test page.
-- We never store precise coordinates or IP addresses.
-------------------------------------------------------------------------------
create table bb.community_tests (
  id               bigint generated always as identity primary key,
  created_at       timestamptz not null default now(),
  day              date not null default (now() at time zone 'America/Toronto')::date,
  mlab_uuid_down   text,
  mlab_uuid_up     text,
  down_mbps        real not null check (down_mbps >= 0 and down_mbps < 100000),
  up_mbps          real not null check (up_mbps >= 0 and up_mbps < 100000),
  latency_ms       real check (latency_ms >= 0 and latency_ms < 100000),
  -- where (coarse only)
  location_source  text not null check (location_source in ('gps', 'search')),
  pr_id            text references bb.regions (id),
  cd_id            text references bb.regions (id),
  csd_id           text references bb.regions (id),
  hex_id           text references bb.regions (id),
  -- optional survey
  isp_id           integer references bb.isps (id),
  isp_other        text check (char_length(isp_other) <= 80),
  connection_type  text check (connection_type in ('fibre', 'cable', 'dsl', 'fixed_wireless', 'satellite_leo', 'satellite_geo', 'mobile', 'other', 'unknown')),
  plan_down_mbps   real check (plan_down_mbps >= 0 and plan_down_mbps < 100000),
  plan_up_mbps     real check (plan_up_mbps >= 0 and plan_up_mbps < 100000),
  monthly_price    real check (monthly_price >= 0 and monthly_price < 10000),
  wired            boolean,
  locale           text not null default 'en' check (locale in ('en', 'fr')),
  -- anti-abuse / verification
  client_key       text not null,  -- salted, rotating hash of IP (dedupe & rate limit)
  status           text not null default 'pending' check (status in ('pending', 'verified', 'unverifiable', 'rejected')),
  detected_isp_id  integer references bb.isps (id),
  verified_at      timestamptz
);
create index community_tests_day_idx on bb.community_tests (day);
create index community_tests_status_idx on bb.community_tests (status) where status = 'pending';
create index community_tests_client_idx on bb.community_tests (client_key, created_at);
create unique index community_tests_uuid_down_idx on bb.community_tests (mlab_uuid_down) where mlab_uuid_down is not null;

-------------------------------------------------------------------------------
-- Speed histograms
-- Bin edges (Mbps). 10 and 50 are exact edges so "meets target" is exact.
-------------------------------------------------------------------------------
create or replace function bb.hist_edges() returns double precision[]
language sql immutable parallel safe as $$
  select array[0,1,2,3,5,7,10,15,20,25,30,40,50,60,75,100,150,200,250,300,400,500,750,1000,1500,2000,3000,5000]::double precision[]
$$;

create or replace function bb.hist_bin(mbps double precision) returns integer
language sql immutable parallel safe as $$
  select greatest(1, width_bucket(mbps, bb.hist_edges()))
$$;

create or replace function bb.hist_accum(state integer[], mbps double precision)
returns integer[] language plpgsql immutable parallel safe as $$
declare b integer;
begin
  if mbps is null then return state; end if;
  b := bb.hist_bin(mbps);
  state[b] := state[b] + 1;
  return state;
end $$;

create or replace function bb.hist_add(a integer[], b integer[])
returns integer[] language plpgsql immutable parallel safe as $$
declare i integer;
begin
  if a is null then return b; end if;
  if b is null then return a; end if;
  for i in 1 .. array_length(a, 1) loop
    a[i] := a[i] + coalesce(b[i], 0);
  end loop;
  return a;
end $$;

create aggregate bb.hist_agg (double precision) (
  sfunc = bb.hist_accum,
  stype = integer[],
  initcond = '{0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0}',
  combinefunc = bb.hist_add,
  parallel = safe
);

create aggregate bb.hist_sum (integer[]) (
  sfunc = bb.hist_add,
  stype = integer[],
  combinefunc = bb.hist_add,
  parallel = safe
);

-------------------------------------------------------------------------------
-- Daily rollups — what the map reads.
-- isp_id = 0 means "all ISPs". One row per (client, day) is counted, using the
-- median of that client's tests that day, so a single household running 100
-- tests counts once.
-------------------------------------------------------------------------------
create table bb.daily_stats (
  source     text not null check (source in ('mlab', 'community')),
  direction  text not null check (direction in ('down', 'up')),
  day        date not null,
  region_id  text not null,
  isp_id     integer not null default 0,
  n          integer not null,
  n_meet     integer not null,          -- >= 50 down / >= 10 up
  hist       integer[] not null,
  rtt_sum    double precision not null default 0,
  rtt_n      integer not null default 0,
  primary key (source, direction, day, region_id, isp_id)
);
create index daily_stats_query_idx on bb.daily_stats (source, direction, isp_id, day);
create index daily_stats_region_idx on bb.daily_stats (region_id, day);

-------------------------------------------------------------------------------
-- ISED National Broadband Data (advertised availability)
-------------------------------------------------------------------------------
-- Per-hexagon availability computed exactly from ISED pseudo-households (PHH):
-- population living at PHH points where 50/10 is advertised.
create table bb.ised_hex (
  hex_id           text primary key references bb.regions (id) on delete cascade,
  avail_50_10_band text,               -- ISED's published band: '0', '>0% - 25%', ... '>75% - 100%'
  population       real not null default 0,
  pop_50_10        real not null default 0,
  pop_lte          real not null default 0
);

create table bb.ised_hex_providers (
  hex_id      text not null references bb.regions (id) on delete cascade,
  provider    text not null,
  technology  text not null,
  primary key (hex_id, provider, technology)
);

-- Share of the population with 50/10 advertised, for every region level
-- (computed from PHH points, so it is exact rather than hexagon-weighted).
create table bb.region_availability (
  region_id        text primary key references bb.regions (id) on delete cascade,
  population       real not null,
  pop_50_10        real not null,
  avail_50_10_pct  real generated always as (case when population > 0 then 100 * pop_50_10 / population end) stored
);

-------------------------------------------------------------------------------
-- Pipeline bookkeeping & rate limiting
-------------------------------------------------------------------------------
create table bb.pipeline_runs (
  id          bigint generated always as identity primary key,
  job         text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean,
  detail      jsonb
);

create table bb.rate_limits (
  key         text not null,
  window_start timestamptz not null,
  hits        integer not null default 0,
  primary key (key, window_start)
);

-- Lock everything down: nothing in schema bb is reachable through the
-- Supabase Data API roles.
revoke all on schema bb from anon, authenticated;

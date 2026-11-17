-- Point → area lookups only need the finest level: every census subdivision
-- (community) lies in exactly one division and province, so store subdivided
-- copies of communities only (pr/cd only when no communities are loaded, e.g.
-- the prototype boundaries). Saves ~2/3 of bb.region_parts.

create or replace function bb.refresh_region_parts() returns void language sql as $$
  truncate bb.region_parts;
  insert into bb.region_parts (region_id, level, geom)
  select id, level, (st_dump(st_subdivide(geom, 256))).geom
  from bb.regions
  where level = 'csd'
     or (level in ('pr', 'cd') and not exists (select 1 from bb.regions where level = 'csd'));
$$;

-- Area of a given level containing a point (lvl = 'pr' | 'cd' | 'csd').
create or replace function bb.region_at(lon double precision, lat double precision, lvl text)
returns text language sql stable parallel safe as $$
  with hit as (
    select p.region_id, p.level
    from bb.region_parts p
    where (p.level = lvl or p.level = 'csd')
      and st_intersects(p.geom, st_setsrid(st_makepoint(lon, lat), 4326))
    order by (p.level = lvl) desc
    limit 1
  )
  select case
    when hit.level = lvl then hit.region_id
    when lvl = 'cd' then (select r.parent_id from bb.regions r where r.id = hit.region_id)
    when lvl = 'pr' then (select 'pr:' || r.pr_code from bb.regions r where r.id = hit.region_id)
  end
  from hit
$$;

create or replace function bb.assign_mlab_regions(d_from date, d_to date) returns integer
language plpgsql as $$
declare n integer;
begin
  -- community first, then its division and province
  update bb.mlab_tests t set csd_id = (
      select p.region_id from bb.region_parts p
      where p.level = 'csd' and st_intersects(p.geom, st_setsrid(st_makepoint(t.lon, t.lat), 4326)) limit 1)
  where t.day between d_from and d_to and t.pr_id is null and t.lat is not null and t.lon is not null;

  update bb.mlab_tests t set cd_id = r.parent_id, pr_id = 'pr:' || r.pr_code
  from bb.regions r
  where r.id = t.csd_id and t.day between d_from and d_to and t.pr_id is null;

  -- without community shapes (prototype boundaries): look up division / province directly
  update bb.mlab_tests t set
    pr_id = bb.region_at(t.lon, t.lat, 'pr'),
    cd_id = bb.region_at(t.lon, t.lat, 'cd')
  where t.day between d_from and d_to and t.pr_id is null and t.csd_id is null
    and t.lat is not null and t.lon is not null
    and exists (select 1 from bb.region_parts where level <> 'csd');

  select count(*) into n from bb.mlab_tests where day between d_from and d_to and pr_id is not null;
  return n;
end $$;

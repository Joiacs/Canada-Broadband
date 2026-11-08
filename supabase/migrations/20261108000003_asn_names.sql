-- AS names seen in M-Lab data, so unmapped networks can be reviewed and added
-- to bb.isp_asns (see README → "Maintaining the ISP list").
create table bb.asn_names (
  asn        integer primary key,
  as_name    text,
  last_seen  date not null,
  tests      bigint not null default 0
);

create or replace function bb.map_new_asns() returns integer
language plpgsql as $$
declare n integer;
begin
  insert into bb.isp_asns (asn, isp_id, note)
  select distinct on (s.asn) s.asn, i.id, 'auto: ' || s.as_name
  from bb.asn_names s
  join bb.isps i on i.match_pattern is not null and s.as_name ~* i.match_pattern
  where not exists (select 1 from bb.isp_asns a where a.asn = s.asn)
  order by s.asn, i.id;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace view bb.unmapped_asns as
select s.asn, s.as_name, s.tests, s.last_seen
from bb.asn_names s
where not exists (select 1 from bb.isp_asns a where a.asn = s.asn)
order by s.tests desc;

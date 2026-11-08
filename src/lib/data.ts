import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "./db";
import { summarize, type Direction, type Summary } from "./hist";
import { effectiveQuery, sourcesFor, type Level, type StatsQuery } from "./params";

type AggRow = { n: number; n_meet: number; hist: number[] | null; rtt_sum: number; rtt_n: number };

function addAgg(a: AggRow | undefined, b: AggRow): AggRow {
  if (!a) return { ...b, hist: b.hist ? [...b.hist] : null };
  const hist = a.hist && b.hist ? a.hist.map((v, i) => v + (b.hist![i] ?? 0)) : (a.hist ?? b.hist);
  return { n: a.n + b.n, n_meet: a.n_meet + b.n_meet, hist, rtt_sum: a.rtt_sum + b.rtt_sum, rtt_n: a.rtt_n + b.rtt_n };
}

const levelPrefix = (level: Level) => `${level}:%`;

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------
export type Meta = {
  latest: { mlab: string | null; community: string | null; any: string | null };
  isps: { id: number; slug: string; name: string }[];
};

export async function getMeta(): Promise<Meta> {
  "use cache";
  cacheLife("hours");
  cacheTag("meta");
  const sql = db();
  const [latest] = await sql<{ mlab: string | null; community: string | null }[]>`
    select (select max(day)::text from bb.daily_stats where source = 'mlab') as mlab,
           (select max(day)::text from bb.daily_stats where source = 'community') as community`;
  const isps = await sql<{ id: number; slug: string; name: string }[]>`
    select id, slug, name from bb.isps where listed order by name`;
  const any = [latest.mlab, latest.community].filter(Boolean).sort().pop() ?? null;
  return { latest: { ...latest, any }, isps: [...isps] };
}

// ---------------------------------------------------------------------------
// Map statistics: one compact row per region for the requested level.
// [n, median, p25, p75, pctMeet, rtt]
// ---------------------------------------------------------------------------
export type CompactStat = [number, number | null, number | null, number | null, number | null, number | null];

export async function getMapStats(query: StatsQuery): Promise<Record<string, CompactStat>> {
  "use cache";
  cacheLife("hours");
  cacheTag("stats");
  const q = effectiveQuery(query);
  const rows = await db()<(AggRow & { region_id: string })[]>`
    select region_id, sum(n)::int as n, sum(n_meet)::int as n_meet, bb.hist_sum(hist) as hist,
           sum(rtt_sum)::float8 as rtt_sum, sum(rtt_n)::int as rtt_n
    from bb.daily_stats
    where source = any(${sourcesFor(q.source)}::text[]) and direction = ${q.direction}
      and isp_id = ${q.isp} and day between ${q.from}::date and ${q.to}::date
      and region_id like ${levelPrefix(q.level)}
    group by region_id`;
  const out: Record<string, CompactStat> = {};
  for (const r of rows) {
    const s = summarize(r);
    out[r.region_id] = [s.n, s.median, s.p25, s.p75, s.pctMeet, s.rtt];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------
export type RegionInfo = {
  id: string;
  level: Level;
  code: string;
  nameEn: string;
  nameFr: string;
  slug: string;
  prCode: string;
  population: number | null;
  bbox: [number, number, number, number];
  advertisedPct: number | null;
  isedBand: string | null;
  parents: { id: string; level: Level; nameEn: string; nameFr: string; slug: string }[];
};

export async function getRegion(id: string): Promise<RegionInfo | null> {
  "use cache";
  cacheLife("days");
  cacheTag("regions");
  const sql = db();
  const [r] = await sql<
    { id: string; level: Level; code: string; name_en: string; name_fr: string; slug: string; pr_code: string; population: number | null; bbox: number[]; parent_id: string | null; ap: number | null; band: string | null }[]
  >`
    select r.id, r.level, r.code, r.name_en, r.name_fr, r.slug, r.pr_code, r.population, r.bbox, r.parent_id,
           a.avail_50_10_pct as ap, h.avail_50_10_band as band
    from bb.regions r
    left join bb.region_availability a on a.region_id = r.id
    left join bb.ised_hex h on h.hex_id = r.id
    where r.id = ${id}`;
  if (!r) return null;
  const parents = await sql<{ id: string; level: Level; name_en: string; name_fr: string; slug: string }[]>`
    with recursive up as (
      select id, level, name_en, name_fr, slug, parent_id, 1 as depth from bb.regions where id = ${r.parent_id ?? ""}
      union all
      select p.id, p.level, p.name_en, p.name_fr, p.slug, p.parent_id, up.depth + 1
      from bb.regions p join up on p.id = up.parent_id where up.depth < 4
    )
    select id, level, name_en, name_fr, slug from up order by depth desc`;
  return {
    id: r.id,
    level: r.level,
    code: r.code,
    nameEn: r.name_en,
    nameFr: r.name_fr,
    slug: r.slug,
    prCode: r.pr_code,
    population: r.population,
    bbox: r.bbox as RegionInfo["bbox"],
    advertisedPct: r.ap === null ? null : Math.round(r.ap * 10) / 10,
    isedBand: r.band,
    parents: parents.map((p) => ({ id: p.id, level: p.level, nameEn: p.name_en, nameFr: p.name_fr, slug: p.slug })),
  };
}

export type RegionStats = {
  /** combined over the selected sources */
  down: Summary & { hist: number[] | null };
  up: Summary & { hist: number[] | null };
  bySource: Record<"mlab" | "community", { down: Summary; up: Summary }>;
};

const emptyAgg: AggRow = { n: 0, n_meet: 0, hist: null, rtt_sum: 0, rtt_n: 0 };

export async function getRegionStats(id: string, query: Omit<StatsQuery, "level" | "direction">): Promise<RegionStats> {
  "use cache";
  cacheLife("hours");
  cacheTag("stats");
  const level = id.split(":")[0] as Level;
  const q = effectiveQuery({ ...query, level, direction: "down" });
  const rows = await db()<(AggRow & { source: "mlab" | "community"; direction: Direction })[]>`
    select source, direction, sum(n)::int as n, sum(n_meet)::int as n_meet, bb.hist_sum(hist) as hist,
           sum(rtt_sum)::float8 as rtt_sum, sum(rtt_n)::int as rtt_n
    from bb.daily_stats
    where region_id = ${id} and isp_id = ${q.isp} and day between ${q.from}::date and ${q.to}::date
      and source = any(${sourcesFor(q.source)}::text[])
    group by source, direction`;
  const combined: Record<Direction, AggRow | undefined> = { down: undefined, up: undefined };
  const per: Record<string, AggRow> = {};
  for (const r of rows) {
    combined[r.direction] = addAgg(combined[r.direction], r);
    per[`${r.source}:${r.direction}`] = r;
  }
  const s = (a: AggRow | undefined) => ({ ...summarize(a ?? emptyAgg), hist: a?.hist ?? null });
  return {
    down: s(combined.down),
    up: s(combined.up),
    bySource: {
      mlab: { down: summarize(per["mlab:down"] ?? emptyAgg), up: summarize(per["mlab:up"] ?? emptyAgg) },
      community: { down: summarize(per["community:down"] ?? emptyAgg), up: summarize(per["community:up"] ?? emptyAgg) },
    },
  };
}

export type TrendPoint = { month: string; down: number | null; up: number | null; nDown: number; pctMeet: number | null };

export async function getRegionTrend(id: string, source: StatsQuery["source"], to: string): Promise<TrendPoint[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("stats");
  const src = id.startsWith("hex:") ? ["community"] : sourcesFor(source);
  const rows = await db()<(AggRow & { month: string; direction: Direction })[]>`
    select to_char(date_trunc('month', day), 'YYYY-MM') as month, direction,
           sum(n)::int as n, sum(n_meet)::int as n_meet, bb.hist_sum(hist) as hist,
           sum(rtt_sum)::float8 as rtt_sum, sum(rtt_n)::int as rtt_n
    from bb.daily_stats
    where region_id = ${id} and isp_id = 0 and source = any(${src}::text[])
      and day > ${to}::date - interval '24 months' and day <= ${to}::date
    group by 1, 2 order by 1`;
  const byMonth = new Map<string, TrendPoint>();
  for (const r of rows) {
    const s = summarize(r);
    const p = byMonth.get(r.month) ?? { month: r.month, down: null, up: null, nDown: 0, pctMeet: null };
    if (r.direction === "down") {
      p.down = s.n >= 5 ? s.median : null;
      p.nDown = s.n;
      p.pctMeet = s.n >= 5 ? s.pctMeet : null;
    } else p.up = s.n >= 5 ? s.median : null;
    byMonth.set(r.month, p);
  }
  return [...byMonth.values()];
}

export type IspRow = { ispId: number; name: string; down: Summary; up: Summary };

export async function getRegionIsps(id: string, query: Omit<StatsQuery, "level" | "direction" | "isp">): Promise<IspRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("stats");
  if (!(id.startsWith("pr:") || id.startsWith("cd:"))) return [];
  const rows = await db()<(AggRow & { isp_id: number; name: string; direction: Direction })[]>`
    select d.isp_id, i.name, d.direction, sum(d.n)::int as n, sum(d.n_meet)::int as n_meet, bb.hist_sum(d.hist) as hist,
           sum(d.rtt_sum)::float8 as rtt_sum, sum(d.rtt_n)::int as rtt_n
    from bb.daily_stats d join bb.isps i on i.id = d.isp_id
    where d.region_id = ${id} and d.isp_id > 0 and d.day between ${query.from}::date and ${query.to}::date
      and d.source = any(${sourcesFor(query.source)}::text[])
    group by 1, 2, 3`;
  const map = new Map<number, IspRow>();
  for (const r of rows) {
    const row = map.get(r.isp_id) ?? { ispId: r.isp_id, name: r.name, down: summarize(emptyAgg), up: summarize(emptyAgg) };
    row[r.direction] = summarize(r);
    map.set(r.isp_id, row);
  }
  return [...map.values()].filter((r) => r.down.n >= 10).sort((a, b) => b.down.n - a.down.n);
}

export type AdvertisedProvider = { name: string; technologies: string[]; share: number };

/** Providers ISED lists as offering service, by share of the area's hexagons. */
export async function getAdvertisedProviders(id: string): Promise<AdvertisedProvider[]> {
  "use cache";
  cacheLife("days");
  cacheTag("ised");
  if (id.startsWith("pr:")) return [];
  const rows = await db()<{ provider: string; techs: string[]; hexes: number; total: number }[]>`
    with hx as (
      select id from bb.regions
      where level = 'hex' and (
        id = ${id} or parent_id = ${id}
        or parent_id in (select c.id from bb.regions c where c.parent_id = ${id} and c.level = 'csd')
      )
    ), total as (select count(*)::int as n from hx)
    select p.provider, array_agg(distinct p.technology order by p.technology) as techs,
           count(distinct p.hex_id)::int as hexes, (select n from total) as total
    from bb.ised_hex_providers p join hx on hx.id = p.hex_id
    group by p.provider
    order by hexes desc, p.provider
    limit 25`;
  return rows.map((r) => ({ name: r.provider, technologies: r.techs, share: r.total ? Math.round((100 * r.hexes) / r.total) : 0 }));
}

export type CommunitySummary = { n: number; connectionTypes: { type: string; n: number }[]; planRatio: number | null };

export async function getCommunitySummary(id: string, from: string, to: string): Promise<CommunitySummary> {
  "use cache";
  cacheLife("hours");
  cacheTag("stats");
  const sql = db();
  const col = id.split(":")[0];
  const where =
    col === "pr" ? sql`pr_id = ${id}` : col === "cd" ? sql`cd_id = ${id}` : col === "csd" ? sql`csd_id = ${id}` : sql`hex_id = ${id}`;
  const types = await sql<{ type: string; n: number }[]>`
    select coalesce(connection_type, 'unknown') as type, count(*)::int as n
    from bb.community_tests
    where ${where} and status in ('verified', 'pending') and day between ${from}::date and ${to}::date
    group by 1 order by 2 desc`;
  const [ratio] = await sql<{ r: number | null }[]>`
    select percentile_cont(0.5) within group (order by least(down_mbps / plan_down_mbps, 2))::float8 as r
    from bb.community_tests
    where ${where} and status in ('verified', 'pending') and plan_down_mbps > 0
      and day between ${from}::date and ${to}::date`;
  const n = types.reduce((s, t) => s + t.n, 0);
  return { n, connectionTypes: [...types], planRatio: n >= 5 && ratio?.r != null ? Math.round(ratio.r * 100) : null };
}

export type RegionListItem = { id: string; level: Level; nameEn: string; nameFr: string; slug: string; prCode: string; bbox: number[] };

export async function searchRegions(q: string): Promise<RegionListItem[]> {
  "use cache";
  cacheLife("days");
  cacheTag("regions");
  const term = q.trim().toLowerCase().slice(0, 60);
  if (term.length < 2) return [];
  const rows = await db()<{ id: string; level: Level; name_en: string; name_fr: string; slug: string; pr_code: string; bbox: number[] }[]>`
    select id, level, name_en, name_fr, slug, pr_code, bbox
    from bb.regions
    where level <> 'hex' and unaccent(search_text) like '%' || unaccent(${term}) || '%'
    order by (unaccent(search_text) like unaccent(${term}) || '%') desc,
             case level when 'pr' then 0 when 'csd' then 1 else 2 end,
             population desc nulls last
    limit 8`;
  return rows.map((r) => ({ id: r.id, level: r.level, nameEn: r.name_en, nameFr: r.name_fr, slug: r.slug, prCode: r.pr_code, bbox: r.bbox }));
}

export async function getChildren(id: string): Promise<RegionListItem[]> {
  "use cache";
  cacheLife("days");
  cacheTag("regions");
  const rows = await db()<{ id: string; level: Level; name_en: string; name_fr: string; slug: string; pr_code: string; bbox: number[] }[]>`
    select id, level, name_en, name_fr, slug, pr_code, bbox from bb.regions
    where parent_id = ${id} and level <> 'hex' order by name_en`;
  return rows.map((r) => ({ id: r.id, level: r.level, nameEn: r.name_en, nameFr: r.name_fr, slug: r.slug, prCode: r.pr_code, bbox: r.bbox }));
}

/** All non-hexagon regions (for the sitemap and static params). */
export async function listRegions(): Promise<{ id: string; slug: string; level: Level }[]> {
  "use cache";
  cacheLife("days");
  cacheTag("regions");
  const rows = await db()<{ id: string; slug: string; level: Level }[]>`
    select id, slug, level from bb.regions where level <> 'hex' order by level, id`;
  return [...rows];
}

/** Names for a set of region ids at one level, for CSV export and the table view. */
export async function getRegionNames(level: Level): Promise<Record<string, { en: string; fr: string; pr: string; ap: number | null }>> {
  "use cache";
  cacheLife("days");
  cacheTag("regions");
  const rows = await db()<{ id: string; name_en: string; name_fr: string; pr_code: string; ap: number | null }[]>`
    select r.id, r.name_en, r.name_fr, r.pr_code, round(a.avail_50_10_pct::numeric, 1)::float8 as ap
    from bb.regions r left join bb.region_availability a on a.region_id = r.id
    where r.level = ${level}`;
  return Object.fromEntries(rows.map((r) => [r.id, { en: r.name_en, fr: r.name_fr, pr: r.pr_code, ap: r.ap }]));
}

/** Default period: the 90 days ending on the most recent day with data. */
export function defaultRange(latest: string | null, days = 90): { from: string; to: string } {
  const end = latest ? new Date(`${latest}T00:00:00Z`) : new Date(Date.now() - 86_400_000);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

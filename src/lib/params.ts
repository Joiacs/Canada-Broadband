import { z } from "zod";

export const LEVELS = ["pr", "cd", "csd", "hex"] as const;
export type Level = (typeof LEVELS)[number];
export const SOURCES = ["all", "mlab", "community"] as const;
export type Source = (typeof SOURCES)[number];
export const METRICS = ["median", "pctMeet", "advertised", "gap"] as const;
export type Metric = (typeof METRICS)[number];
export const PERIODS = ["30d", "90d", "365d", "custom"] as const;
export type Period = (typeof PERIODS)[number];

/** Minimum people (client-days) before an area is coloured; below 30 is shown lighter. */
export const MIN_N = 10;
export const LOW_N = 30;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Query parameters shared by /api/stats, /api/regions/:id and /api/export. */
export const statsQuery = z
  .object({
    level: z.enum(LEVELS).default("pr"),
    direction: z.enum(["down", "up"]).default("down"),
    source: z.enum(SOURCES).default("all"),
    isp: z.coerce.number().int().min(0).max(100000).default(0),
    from: day,
    to: day,
  })
  .refine((q) => q.from <= q.to, { message: "from must be before to" })
  .refine((q) => (Date.parse(q.to) - Date.parse(q.from)) / 86_400_000 <= 1100, { message: "range too long (max ~3 years)" });

export type StatsQuery = z.infer<typeof statsQuery>;

export function sourcesFor(source: Source): string[] {
  return source === "all" ? ["mlab", "community"] : [source];
}

/** M-Lab rows are never rolled up to hexagons, and ISP rows only exist for pr/cd. */
export function effectiveQuery(q: StatsQuery): StatsQuery {
  return {
    ...q,
    isp: q.level === "pr" || q.level === "cd" ? q.isp : 0,
    source: q.level === "hex" ? "community" : q.source,
  };
}

export function parseSearchParams<T extends z.ZodType>(schema: T, sp: URLSearchParams) {
  return schema.safeParse(Object.fromEntries(sp.entries()));
}

export const regionIdSchema = z.string().regex(/^(pr|cd|csd|hex):[A-Za-z0-9]{1,16}$/);

import { z } from "zod";
import { getAdvertisedProviders, getCommunitySummary, getRegion, getRegionIsps, getRegionStats, getRegionTrend } from "@/lib/data";
import { badRequest, json, serverError } from "@/lib/http";
import { regionIdSchema, SOURCES } from "@/lib/params";

const query = z.object({
  source: z.enum(SOURCES).default("all"),
  isp: z.coerce.number().int().min(0).default(0),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** GET /api/regions/cd:3520?source=all&isp=0&from=…&to=… → everything the side panel needs. */
export async function GET(request: Request, ctx: RouteContext<"/api/regions/[id]">) {
  const { id: raw } = await ctx.params;
  const id = decodeURIComponent(raw);
  if (!regionIdSchema.safeParse(id).success) return badRequest("invalid_region");
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return badRequest("invalid_query", parsed.error.issues);
  const q = parsed.data;
  try {
    const region = await getRegion(id);
    if (!region) return json({ error: "not_found" }, { status: 404 });
    const [stats, trend, isps, providers, community] = await Promise.all([
      getRegionStats(id, q),
      getRegionTrend(id, q.source, q.to),
      getRegionIsps(id, { source: q.source, from: q.from, to: q.to }),
      getAdvertisedProviders(id),
      getCommunitySummary(id, q.from, q.to),
    ]);
    return json({ region, stats, trend, isps, providers, community }, { cache: true });
  } catch (err) {
    return serverError(err);
  }
}

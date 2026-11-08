import { getMapStats } from "@/lib/data";
import { badRequest, json, serverError } from "@/lib/http";
import { MIN_N, parseSearchParams, statsQuery } from "@/lib/params";

/**
 * GET /api/stats?level=cd&direction=down&source=all&isp=0&from=YYYY-MM-DD&to=YYYY-MM-DD
 * → { minN, regions: { "cd:3520": [n, median, p25, p75, pctMeet, rttMs], … } }
 */
export async function GET(request: Request) {
  const parsed = parseSearchParams(statsQuery, new URL(request.url).searchParams);
  if (!parsed.success) return badRequest("invalid_query", parsed.error.issues);
  try {
    const regions = await getMapStats(parsed.data);
    return json({ minN: MIN_N, regions }, { cache: true });
  } catch (err) {
    return serverError(err);
  }
}

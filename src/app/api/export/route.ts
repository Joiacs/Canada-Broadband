import { getMapStats, getRegionNames } from "@/lib/data";
import { provinceByCode } from "@/lib/provinces";
import { CDN_CACHE } from "@/lib/http";
import { parseSearchParams, statsQuery } from "@/lib/params";

const csvCell = (v: unknown) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // also neutralise spreadsheet formula injection
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/**
 * GET /api/export?level=cd&direction=down&source=all&isp=0&from=…&to=…
 * CSV of aggregate statistics. Licence: CC BY 4.0 (see /data).
 */
export async function GET(request: Request) {
  const parsed = parseSearchParams(statsQuery, new URL(request.url).searchParams);
  if (!parsed.success) return new Response("invalid query", { status: 400 });
  const q = parsed.data;
  try {
    const [stats, names] = await Promise.all([getMapStats(q), getRegionNames(q.level)]);
    const header = ["region_id", "level", "name_en", "name_fr", "province", "direction", "from", "to", "source", "isp_id", "people_tested", "median_mbps", "p25_mbps", "p75_mbps", "pct_meeting_target", "mean_min_rtt_ms", "advertised_50_10_pct"];
    const lines = [header.join(",")];
    for (const [id, n] of Object.entries(names)) {
      const s = stats[id];
      lines.push(
        [id, q.level, n.en, n.fr, provinceByCode.get(n.pr)?.abbr ?? n.pr, q.direction, q.from, q.to, q.source, q.isp, s?.[0] ?? 0, s?.[1], s?.[2], s?.[3], s?.[4], s?.[5], n.ap]
          .map(csvCell)
          .join(","),
      );
    }
    return new Response(lines.join("\n") + "\n", {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="ideva-broadband-${q.level}-${q.direction}-${q.from}-${q.to}.csv"`,
        "cache-control": CDN_CACHE,
      },
    });
  } catch (err) {
    console.error(err);
    return new Response("internal error", { status: 500 });
  }
}

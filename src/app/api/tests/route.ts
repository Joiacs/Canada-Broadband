import { after } from "next/server";
import { db } from "@/lib/db";
import { getRegionStats } from "@/lib/data";
import { histRank } from "@/lib/hist";
import { json, serverError } from "@/lib/http";
import { clientIp, dailyClientKey, rateLimit, torontoDay, verifyTurnstile } from "@/lib/security";
import { submissionSchema } from "@/lib/submission";

const MAX_PER_DAY = 10;
const MAX_PER_HOUR_BURST = 5;

/**
 * POST /api/tests — add a speed-test result from /speed-test to the map.
 * Stores speeds, coarse areas and optional survey answers. Never stores the
 * IP address or precise coordinates.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid", details: parsed.error.issues }, { status: 400 });
  const s = parsed.data;
  const ip = clientIp(request.headers);

  try {
    if (!(await verifyTurnstile(s.turnstileToken, ip))) return json({ error: "captcha" }, { status: 403 });
    if (!(await rateLimit(ip, "submit-hour", MAX_PER_HOUR_BURST, 3600)) || !(await rateLimit(ip, "submit-day", MAX_PER_DAY, 86400))) {
      return json({ error: "rate_limited" }, { status: 429 });
    }

    const sql = db();
    // Resolve areas. GPS coordinates stop here — they are never written anywhere.
    let areas: { pr_id: string | null; cd_id: string | null; csd_id: string | null; hex_id: string | null };
    if (s.location.type === "gps") {
      const { lat, lon } = s.location;
      [areas] = await sql<typeof areas[]>`
        select bb.region_at(${lon}, ${lat}, 'pr') as pr_id, bb.region_at(${lon}, ${lat}, 'cd') as cd_id,
               bb.region_at(${lon}, ${lat}, 'csd') as csd_id, bb.hex_at(${lon}, ${lat}) as hex_id`;
    } else {
      const id = s.location.regionId;
      [areas] = await sql<typeof areas[]>`
        with recursive chain as (
          select id, level, parent_id from bb.regions where id = ${id}
          union all
          select r.id, r.level, r.parent_id from bb.regions r join chain c on r.id = c.parent_id
        )
        select max(id) filter (where level = 'pr') as pr_id, max(id) filter (where level = 'cd') as cd_id,
               max(id) filter (where level = 'csd') as csd_id, null::text as hex_id
        from chain`;
    }
    if (!areas?.pr_id) return json({ error: "outside_canada" }, { status: 422 });

    const day = torontoDay();
    const survey = s.survey;
    let id: number;
    try {
      [{ id }] = await sql<{ id: number }[]>`
        insert into bb.community_tests (
          day, mlab_uuid_down, mlab_uuid_up, down_mbps, up_mbps, latency_ms, location_source,
          pr_id, cd_id, csd_id, hex_id, isp_id, isp_other, connection_type, plan_down_mbps, plan_up_mbps,
          monthly_price, wired, locale, client_key
        ) values (
          ${day}::date, ${s.uuidDown ?? null}, ${s.uuidUp ?? null}, ${s.downMbps}, ${s.upMbps}, ${s.latencyMs ?? null}, ${s.location.type},
          ${areas.pr_id}, ${areas.cd_id}, ${areas.csd_id}, ${areas.hex_id},
          (select id from bb.isps where id = ${survey.ispId ?? null}::int), ${survey.ispOther || null}, ${survey.connectionType ?? null},
          ${survey.planDownMbps ?? null}, ${survey.planUpMbps ?? null}, ${survey.monthlyPrice ?? null}, ${survey.wired ?? null},
          ${s.locale}, ${dailyClientKey(ip, day)}
        ) returning id`;
    } catch (e) {
      if ((e as { code?: string }).code === "23505") return json({ error: "duplicate" }, { status: 409 });
      throw e;
    }

    // Refresh today's community rollup after responding.
    after(async () => {
      await sql`select bb.rollup_community(${day}::date, ${day}::date)`.catch((err) => console.error("rollup failed", err));
    });

    // How does this compare with recent tests nearby? (smallest area with enough data)
    const to = day;
    const fromD = new Date(`${day}T00:00:00Z`);
    fromD.setUTCDate(fromD.getUTCDate() - 89);
    const from = fromD.toISOString().slice(0, 10);
    let rank: { regionId: string; pct: number } | null = null;
    for (const regionId of [areas.csd_id, areas.cd_id, areas.pr_id]) {
      if (!regionId) continue;
      const st = await getRegionStats(regionId, { source: "all", isp: 0, from, to });
      if (st.down.n >= 30 && st.down.hist) {
        const r = histRank(st.down.hist, s.downMbps);
        if (r !== null) rank = { regionId, pct: Math.round(r * 100) };
        break;
      }
    }
    const regionIds = [areas.csd_id, areas.cd_id, areas.pr_id].filter(Boolean) as string[];
    const names = await sql<{ id: string; name_en: string; name_fr: string }[]>`
      select id, name_en, name_fr from bb.regions where id = any(${regionIds}::text[])`;
    const byId = Object.fromEntries(names.map((n) => [n.id, s.locale === "fr" ? n.name_fr : n.name_en]));
    const placeId = rank?.regionId ?? regionIds[0];

    return json({ id, area: { ...areas, name: byId[placeId] ?? null, regionId: placeId }, rank: rank?.pct ?? null }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}

import { connection } from "next/server";
import { db } from "@/lib/db";

/** GET /api/health — uptime checks: database reachable and data freshness. */
export async function GET() {
  await connection();
  try {
    const [r] = await db()<{ latest: string | null; last_run: string | null; last_ok: boolean | null }[]>`
      select (select max(day)::text from bb.daily_stats) as latest,
             (select max(started_at)::text from bb.pipeline_runs where job = 'nightly') as last_run,
             (select ok from bb.pipeline_runs where job = 'nightly' order by started_at desc limit 1) as last_ok`;
    return Response.json({ ok: true, ...r }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

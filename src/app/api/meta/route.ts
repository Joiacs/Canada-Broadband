import { connection } from "next/server";
import { defaultRange, getMeta } from "@/lib/data";
import { json, serverError } from "@/lib/http";

/** GET /api/meta → data freshness, default period and the provider list. */
export async function GET() {
  // request-time (still cached by "use cache" + CDN) so builds never need the database
  await connection();
  try {
    const meta = await getMeta();
    return json({ ...meta, defaultRange: defaultRange(meta.latest.any) }, { cache: true });
  } catch (err) {
    return serverError(err);
  }
}

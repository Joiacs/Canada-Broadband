import { searchRegions } from "@/lib/data";
import { json, serverError } from "@/lib/http";

/** GET /api/regions/search?q=thunder → up to 8 matching provinces, divisions and communities. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    return json({ results: await searchRegions(q) }, { cache: true });
  } catch (err) {
    return serverError(err);
  }
}

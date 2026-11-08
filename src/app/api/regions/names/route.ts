import { z } from "zod";
import { getRegionNames } from "@/lib/data";
import { badRequest, json, serverError } from "@/lib/http";
import { LEVELS } from "@/lib/params";

/** GET /api/regions/names?level=cd → { "cd:3520": { en, fr, pr, ap } } (not available for hexagons). */
export async function GET(request: Request) {
  const level = z.enum(LEVELS).exclude(["hex"]).safeParse(new URL(request.url).searchParams.get("level"));
  if (!level.success) return badRequest("invalid_level");
  try {
    return json({ names: await getRegionNames(level.data) }, { cache: true });
  } catch (err) {
    return serverError(err);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, translateSegment, type Locale } from "./i18n/config";

const COOKIE = "NEXT_LOCALE";

function preferredLocale(req: NextRequest): Locale {
  const cookie = req.cookies.get(COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  const accept = req.headers.get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase();
    if (tag.startsWith("fr")) return "fr";
    if (tag.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}

/**
 * - "/" and other locale-less paths → redirect to /en or /fr
 * - "/fr/test-de-vitesse" → rewrite to the app folder "/fr/speed-test"
 * - "/fr/speed-test" → redirect to the French URL (one canonical URL per page)
 */
export function proxy(req: NextRequest) {
  const url = req.nextUrl.clone();
  const parts = url.pathname.split("/").filter(Boolean);
  const first = parts[0];

  if (!isLocale(first)) {
    url.pathname = `/${preferredLocale(req)}${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.redirect(url);
  }

  let res: NextResponse;
  const seg = parts[1];
  const other: Locale = first === "fr" ? "en" : "fr";
  const canonical = seg ? translateSegment(seg, first, "en") : seg;
  const foreign = seg ? translateSegment(seg, other, first) : seg;

  if (seg && first === "fr" && canonical !== seg) {
    url.pathname = "/" + ["fr", canonical, ...parts.slice(2)].join("/");
    res = NextResponse.rewrite(url);
  } else if (seg && foreign !== seg) {
    // a slug from the other language, e.g. /fr/speed-test or /en/a-propos
    url.pathname = "/" + [first, foreign, ...parts.slice(2)].join("/");
    return NextResponse.redirect(url, 308);
  } else {
    res = NextResponse.next();
  }
  if (req.cookies.get(COOKIE)?.value !== first) {
    res.cookies.set(COOKIE, first, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return res;
}

export const config = {
  // Skip API routes, Next internals and any file with an extension (tiles, workers, icons…)
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};

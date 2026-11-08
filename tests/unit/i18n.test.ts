import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { localePath, switchLocalePath, translateSegment } from "@/i18n/config";
import en from "@/i18n/messages/en";
import fr from "@/i18n/messages/fr";
import { proxy } from "@/proxy";

function keys(o: object, prefix = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
}

describe("locale paths", () => {
  it("builds localized URLs", () => {
    expect(localePath("en", "speedTest")).toBe("/en/speed-test");
    expect(localePath("fr", "speedTest")).toBe("/fr/test-de-vitesse");
    expect(localePath("fr", "home")).toBe("/fr");
    expect(localePath("fr", "region", "csd-3520005-toronto")).toBe("/fr/region/csd-3520005-toronto");
  });

  it("switches language keeping the page", () => {
    expect(switchLocalePath("/en/speed-test", "fr")).toBe("/fr/test-de-vitesse");
    expect(switchLocalePath("/fr/a-propos", "en")).toBe("/en/about");
    expect(switchLocalePath("/en", "fr")).toBe("/fr");
    expect(switchLocalePath("/en/region/pr-35-ontario", "fr")).toBe("/fr/region/pr-35-ontario");
    expect(translateSegment("unknown", "en", "fr")).toBe("unknown");
  });

  it("French and English dictionaries have identical keys", () => {
    expect(keys(fr).sort()).toEqual(keys(en).sort());
  });
});

describe("proxy", () => {
  const run = (url: string, headers: Record<string, string> = {}) => proxy(new NextRequest(new URL(url, "http://localhost"), { headers }));

  it("redirects to the browser's language", () => {
    const res = run("/", { "accept-language": "fr-CA,fr;q=0.9,en;q=0.5" });
    expect(res.headers.get("location")).toBe("http://localhost/fr");
    expect(run("/").headers.get("location")).toBe("http://localhost/en");
  });

  it("rewrites French slugs onto the app's folders", () => {
    const res = run("/fr/test-de-vitesse");
    expect(res.headers.get("x-middleware-rewrite")).toBe("http://localhost/fr/speed-test");
  });

  it("redirects foreign-language slugs to the canonical one", () => {
    expect(run("/fr/speed-test").headers.get("location")).toBe("http://localhost/fr/test-de-vitesse");
    expect(run("/en/a-propos").headers.get("location")).toBe("http://localhost/en/about");
  });
});

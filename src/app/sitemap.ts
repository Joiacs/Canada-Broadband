import type { MetadataRoute } from "next";
import { LOCALES, localePath, type PageKey } from "@/i18n/config";
import { hasDatabase } from "@/lib/db";
import { listRegions } from "@/lib/data";
import { regionHref } from "@/lib/region-links";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const PAGES: PageKey[] = ["home", "speedTest", "methodology", "data", "about", "privacy"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  for (const page of PAGES) {
    entries.push({
      url: SITE + localePath("en", page),
      changeFrequency: page === "home" ? "daily" : "monthly",
      priority: page === "home" ? 1 : 0.6,
      alternates: { languages: Object.fromEntries(LOCALES.map((l) => [`${l}-CA`, SITE + localePath(l, page)])) },
    });
  }
  // Region pages need the database; skipped for builds without one (e.g. CI).
  if (hasDatabase()) {
    const regions = await listRegions().catch(() => []);
    for (const r of regions) {
      entries.push({
        url: SITE + regionHref("en", r),
        changeFrequency: "weekly",
        priority: r.level === "pr" ? 0.8 : r.level === "cd" ? 0.6 : 0.5,
        alternates: { languages: Object.fromEntries(LOCALES.map((l) => [`${l}-CA`, SITE + regionHref(l, r)])) },
      });
    }
  }
  return entries;
}

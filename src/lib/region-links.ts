import { localePath, type Locale } from "@/i18n/config";

export function regionName(r: { nameEn: string; nameFr: string }, locale: Locale) {
  return locale === "fr" ? r.nameFr : r.nameEn;
}

/** Public URL of a region page, e.g. /en/region/csd-3520005-toronto */
export function regionHref(locale: Locale, r: { id: string; slug: string }) {
  return localePath(locale, "region", `${r.id.replace(":", "-")}-${r.slug}`);
}

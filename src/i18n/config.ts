export const LOCALES = ["en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(v: string | undefined | null): v is Locale {
  return v === "en" || v === "fr";
}

/**
 * Pages whose URL segment is translated. The app's folders use the English
 * name; src/proxy.ts rewrites the French URL onto it.
 */
export const PAGES = {
  home: { en: "", fr: "" },
  speedTest: { en: "speed-test", fr: "test-de-vitesse" },
  methodology: { en: "methodology", fr: "methodologie" },
  about: { en: "about", fr: "a-propos" },
  privacy: { en: "privacy", fr: "confidentialite" },
  data: { en: "data", fr: "donnees" },
  region: { en: "region", fr: "region" },
} as const;
export type PageKey = keyof typeof PAGES;

/** "/fr/test-de-vitesse" for ("fr", "speedTest"); extra path segments appended. */
export function localePath(locale: Locale, page: PageKey, ...rest: string[]) {
  const seg = PAGES[page][locale];
  return "/" + [locale, seg, ...rest].filter(Boolean).join("/");
}

/** Translate the first segment after the locale between languages. */
export function translateSegment(segment: string, from: Locale, to: Locale): string {
  for (const p of Object.values(PAGES)) {
    if (p[from] === segment) return p[to];
  }
  return segment;
}

/** Map a pathname in one locale to the equivalent pathname in another. */
export function switchLocalePath(pathname: string, to: Locale): string {
  const parts = pathname.split("/").filter(Boolean);
  const from = isLocale(parts[0]) ? parts[0] : DEFAULT_LOCALE;
  if (isLocale(parts[0])) parts.shift();
  if (parts[0]) parts[0] = translateSegment(parts[0], from, to);
  return "/" + [to, ...parts].join("/");
}

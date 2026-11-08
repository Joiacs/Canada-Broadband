import en, { type Messages } from "./messages/en";
import fr from "./messages/fr";
import type { Locale } from "./config";

const DICTS: Record<Locale, Messages> = { en, fr };

export function getDictionary(locale: Locale): Messages {
  return DICTS[locale];
}

/** Replace {placeholders} in a message. */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in values ? String(values[k]) : `{${k}}`));
}

export function formatNumber(locale: Locale, n: number, digits = 0): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n);
}

/** Speeds: 1 decimal under 10 Mbps, whole numbers above. */
export function formatMbps(locale: Locale, n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return formatNumber(locale, n, n < 10 ? 1 : 0);
}

export function formatDate(locale: Locale, isoDay: string): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${isoDay}T00:00:00Z`));
}

export type { Messages };

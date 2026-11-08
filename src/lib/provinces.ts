/** Statistics Canada province / territory codes, used across app and pipeline. */
export const PROVINCES = [
  { code: "10", abbr: "NL", en: "Newfoundland and Labrador", fr: "Terre-Neuve-et-Labrador" },
  { code: "11", abbr: "PE", en: "Prince Edward Island", fr: "Île-du-Prince-Édouard" },
  { code: "12", abbr: "NS", en: "Nova Scotia", fr: "Nouvelle-Écosse" },
  { code: "13", abbr: "NB", en: "New Brunswick", fr: "Nouveau-Brunswick" },
  { code: "24", abbr: "QC", en: "Quebec", fr: "Québec" },
  { code: "35", abbr: "ON", en: "Ontario", fr: "Ontario" },
  { code: "46", abbr: "MB", en: "Manitoba", fr: "Manitoba" },
  { code: "47", abbr: "SK", en: "Saskatchewan", fr: "Saskatchewan" },
  { code: "48", abbr: "AB", en: "Alberta", fr: "Alberta" },
  { code: "59", abbr: "BC", en: "British Columbia", fr: "Colombie-Britannique" },
  { code: "60", abbr: "YT", en: "Yukon", fr: "Yukon" },
  { code: "61", abbr: "NT", en: "Northwest Territories", fr: "Territoires du Nord-Ouest" },
  { code: "62", abbr: "NU", en: "Nunavut", fr: "Nunavut" },
] as const;

export type ProvinceCode = (typeof PROVINCES)[number]["code"];

export const provinceByCode = new Map<string, (typeof PROVINCES)[number]>(PROVINCES.map((p) => [p.code, p]));
export const provinceByAbbr = new Map<string, (typeof PROVINCES)[number]>(PROVINCES.map((p) => [p.abbr, p]));

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

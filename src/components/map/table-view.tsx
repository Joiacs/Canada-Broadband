"use client";

import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/i18n/config";
import { formatMbps, formatNumber, type Messages } from "@/i18n/dictionary";
import type { CompactStat } from "@/lib/data";
import { MIN_N, type Level } from "@/lib/params";
import { provinceByCode } from "@/lib/provinces";

type Names = Record<string, { en: string; fr: string; pr: string; ap: number | null }>;
type SortKey = "name" | "n" | "median" | "pm" | "ap";

/** Accessible alternative to the map: every region at the current level as a sortable table. */
export default function TableView({ level, stats, t, locale, onSelect }: { level: Level; stats: Record<string, CompactStat> | null; t: Messages; locale: Locale; onSelect: (id: string) => void }) {
  const [names, setNames] = useState<{ level: Level; names: Names } | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "median", dir: -1 });

  useEffect(() => {
    if (level === "hex") return;
    const ctrl = new AbortController();
    fetch(`/api/regions/names?level=${level}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j: { names: Names }) => setNames({ level, names: j.names }))
      .catch(() => {});
    return () => ctrl.abort();
  }, [level]);

  const rows = useMemo(() => {
    if (!names || names.level !== level) return [];
    const list = Object.entries(names.names).map(([id, n]) => {
      const s = stats?.[id];
      const ok = (s?.[0] ?? 0) >= MIN_N;
      return { id, name: locale === "fr" ? n.fr : n.en, pr: provinceByCode.get(n.pr)?.abbr ?? "", n: s?.[0] ?? 0, median: ok ? (s?.[1] ?? null) : null, pm: ok ? (s?.[4] ?? null) : null, ap: n.ap };
    });
    const k = sort.key;
    return list.sort((a, b) => {
      const av = a[k], bv = b[k];
      if (av === null) return 1;
      if (bv === null) return -1;
      return (typeof av === "string" ? av.localeCompare(bv as string, locale) : (av as number) - (bv as number)) * sort.dir;
    });
  }, [names, level, stats, sort, locale]);

  const th = (key: SortKey, label: string, right = false) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={`sticky top-0 bg-surface px-3 py-2 font-medium ${right ? "text-right" : "text-left"}`}>
      <button type="button" className="hover:text-text" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1 }))}>
        {label}
        {sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );

  if (level === "hex") return <p className="p-6 text-sm text-muted">{t.map.hexNotice}</p>;

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{t.map.tableCaption}</caption>
        <thead className="text-xs text-muted">
          <tr className="border-b border-border">
            {th("name", t.map.name)}
            {th("n", t.units.people, true)}
            {th("median", `${t.common.median} (${t.units.mbps})`, true)}
            {th("pm", "50/10 %", true)}
            {th("ap", t.map.metrics.advertised, true)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border hover:bg-surface-2">
              <td className="px-3 py-1.5">
                <button type="button" className="text-left hover:underline" onClick={() => onSelect(r.id)}>
                  {r.name}
                </button>
                {level !== "pr" && <span className="ml-1.5 text-xs text-muted">{r.pr}</span>}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums text-muted">{formatNumber(locale, r.n)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{formatMbps(locale, r.median)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{r.pm === null ? "—" : `${formatNumber(locale, r.pm)}%`}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{r.ap === null ? "—" : `${formatNumber(locale, r.ap)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

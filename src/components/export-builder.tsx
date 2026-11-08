"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionary";

const inputCls = "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text";

/** Small form that builds an /api/export URL. */
export default function ExportBuilder({ locale, latest }: { locale: Locale; latest: string }) {
  const t = getDictionary(locale);
  const end = latest;
  const startDefault = new Date(`${end}T00:00:00Z`);
  startDefault.setUTCDate(startDefault.getUTCDate() - 89);
  const [level, setLevel] = useState("cd");
  const [direction, setDirection] = useState("down");
  const [source, setSource] = useState("all");
  const [from, setFrom] = useState(startDefault.toISOString().slice(0, 10));
  const [to, setTo] = useState(end);
  const href = useMemo(() => `/api/export?${new URLSearchParams({ level, direction, source, isp: "0", from, to })}`, [level, direction, source, from, to]);
  return (
    <div className="not-prose grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-3">
      <label className="text-xs text-muted">
        {t.map.level}
        <select className={inputCls} value={level} onChange={(e) => setLevel(e.target.value)}>
          {(["pr", "cd", "csd"] as const).map((l) => (
            <option key={l} value={l}>
              {t.levels[l]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-muted">
        {t.map.direction}
        <select className={inputCls} value={direction} onChange={(e) => setDirection(e.target.value)}>
          <option value="down">{t.common.download}</option>
          <option value="up">{t.common.upload}</option>
        </select>
      </label>
      <label className="text-xs text-muted">
        {t.map.source}
        <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value)}>
          {(["all", "mlab", "community"] as const).map((s) => (
            <option key={s} value={s}>
              {t.map.sources[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-muted">
        {t.map.from}
        <input type="date" className={inputCls} value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
      </label>
      <label className="text-xs text-muted">
        {t.map.to}
        <input type="date" className={inputCls} value={to} min={from} max={end} onChange={(e) => e.target.value && setTo(e.target.value)} />
      </label>
      <div className="flex items-end">
        <a href={href} download className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-contrast no-underline">
          <Download className="size-4" aria-hidden /> CSV
        </a>
      </div>
    </div>
  );
}

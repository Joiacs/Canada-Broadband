"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionary";
import Select from "@/components/ui/select";

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-text shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

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
      <Select label={t.map.level} value={level} onChange={setLevel} options={(["pr", "cd", "csd"] as const).map((l) => ({ value: l, label: t.levels[l] }))} />
      <Select
        label={t.map.direction}
        value={direction}
        onChange={setDirection}
        options={[
          { value: "down", label: t.common.download },
          { value: "up", label: t.common.upload },
        ]}
      />
      <Select label={t.map.source} value={source} onChange={setSource} options={(["all", "mlab", "community"] as const).map((s) => ({ value: s, label: t.map.sources[s] }))} />
      <label className="text-xs text-muted">
        {t.map.from}
        <input type="date" className={inputCls} value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
      </label>
      <label className="text-xs text-muted">
        {t.map.to}
        <input type="date" className={inputCls} value={to} min={from} max={end} onChange={(e) => e.target.value && setTo(e.target.value)} />
      </label>
      <div className="flex items-end">
        <a href={href} download className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-contrast no-underline hover:opacity-90">
          <Download className="size-4" aria-hidden /> {t.map.downloadCsv}
        </a>
      </div>
    </div>
  );
}

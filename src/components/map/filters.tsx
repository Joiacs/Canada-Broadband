"use client";

import { Download } from "lucide-react";
import type { Messages } from "@/i18n/dictionary";
import { fmt, formatDate } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/config";
import { LEVELS, METRICS, PERIODS, SOURCES } from "@/lib/params";
import Select from "@/components/ui/select";
import type { MapState } from "./use-map-state";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-text shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-50";
const labelCls = "mb-1 block text-xs font-medium text-muted";

export default function Filters({
  state,
  update,
  t,
  locale,
  isps,
  latest,
  range,
  exportHref,
}: {
  state: MapState;
  update: (p: Partial<MapState>) => void;
  t: Messages;
  locale: Locale;
  isps: { id: number; name: string }[];
  latest: string | null;
  range: { from: string; to: string };
  exportHref: string;
}) {
  const ispAllowed = state.l === "pr" || state.l === "cd";
  const measured = state.m !== "advertised";
  return (
    <div className="space-y-3">
      <Select label={t.map.metric} value={state.m} onChange={(m) => update({ m })} options={METRICS.map((m) => ({ value: m, label: t.map.metrics[m] }))} />

      {state.m !== "advertised" && (
        <fieldset>
          <legend className={labelCls}>{t.map.direction}</legend>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-2 p-0.5" role="radiogroup">
            {(["down", "up"] as const).map((d) => (
              <label
                key={d}
                className={`cursor-pointer rounded-md px-2 py-1 text-center text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/40 ${state.d === d ? "bg-surface font-medium text-text shadow-sm" : "text-muted hover:text-text"}`}
              >
                <input type="radio" name="direction" className="sr-only" checked={state.d === d} onChange={() => update({ d })} />
                {d === "down" ? t.common.download : t.common.upload}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <Select label={t.map.level} value={state.l} onChange={(l) => update({ l, r: undefined, c: undefined })} options={LEVELS.map((l) => ({ value: l, label: t.levels[l] }))} />
        {state.l === "hex" && <p className="mt-1 text-xs leading-snug text-muted">{t.map.hexNotice}</p>}
      </div>

      {measured && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Select
              label={t.map.source}
              value={state.l === "hex" ? "community" : state.s}
              disabled={state.l === "hex"}
              onChange={(s) => update({ s })}
              options={SOURCES.map((s) => ({ value: s, label: t.map.sources[s] }))}
            />
            <Select
              label={t.map.isp}
              value={ispAllowed ? state.isp : 0}
              disabled={!ispAllowed}
              onChange={(isp) => update({ isp })}
              options={[{ value: 0, label: t.map.allIsps }, ...isps.map((i) => ({ value: i.id, label: i.name }))]}
            />
          </div>
          {!ispAllowed && state.isp > 0 && <p className="text-xs text-muted">{t.map.ispNotAvailable}</p>}

          <div>
            <Select
              label={t.map.period}
              value={state.p}
              onChange={(p) => update(p === "custom" ? { p, from: range.from, to: range.to } : { p })}
              options={PERIODS.map((p) => ({ value: p, label: t.map.periods[p] }))}
            />
            {state.p === "custom" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-xs text-muted">
                  {t.map.from}
                  <input type="date" className={inputCls} value={state.from ?? range.from} max={state.to ?? latest ?? undefined} min="2019-01-01" onChange={(e) => e.target.value && update({ from: e.target.value })} />
                </label>
                <label className="text-xs text-muted">
                  {t.map.to}
                  <input type="date" className={inputCls} value={state.to ?? range.to} min={state.from} max={latest ?? undefined} onChange={(e) => e.target.value && update({ to: e.target.value })} />
                </label>
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted">
        {latest && <span>{fmt(t.map.dataThrough, { date: formatDate(locale, latest) })}</span>}
        {state.l !== "hex" && (
          <a href={exportHref} className="inline-flex items-center gap-1 rounded px-1.5 py-1 hover:bg-surface-2 hover:text-text" download>
            <Download className="size-3.5" aria-hidden /> CSV
          </a>
        )}
      </div>
    </div>
  );
}

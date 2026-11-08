"use client";

import { Download } from "lucide-react";
import type { Messages } from "@/i18n/dictionary";
import { fmt, formatDate } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/config";
import { LEVELS, METRICS, PERIODS, SOURCES } from "@/lib/params";
import type { MapState } from "./use-map-state";

const selectCls =
  "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text shadow-sm focus:border-brand focus:outline-none disabled:opacity-50";
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
      <div>
        <label htmlFor="f-metric" className={labelCls}>
          {t.map.metric}
        </label>
        <select id="f-metric" className={selectCls} value={state.m} onChange={(e) => update({ m: e.target.value as MapState["m"] })}>
          {METRICS.map((m) => (
            <option key={m} value={m}>
              {t.map.metrics[m]}
            </option>
          ))}
        </select>
      </div>

      {state.m !== "advertised" && (
        <fieldset>
          <legend className={labelCls}>{t.map.direction}</legend>
          <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-surface-2 p-0.5" role="radiogroup">
            {(["down", "up"] as const).map((d) => (
              <label key={d} className={`cursor-pointer rounded px-2 py-1 text-center text-sm ${state.d === d ? "bg-surface font-medium text-text shadow-sm" : "text-muted"}`}>
                <input type="radio" name="direction" className="sr-only" checked={state.d === d} onChange={() => update({ d })} />
                {d === "down" ? t.common.download : t.common.upload}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <label htmlFor="f-level" className={labelCls}>
          {t.map.level}
        </label>
        <select id="f-level" className={selectCls} value={state.l} onChange={(e) => update({ l: e.target.value as MapState["l"], r: undefined, c: undefined })}>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {t.levels[l]}
            </option>
          ))}
        </select>
        {state.l === "hex" && <p className="mt-1 text-xs leading-snug text-muted">{t.map.hexNotice}</p>}
      </div>

      {measured && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="f-source" className={labelCls}>
                {t.map.source}
              </label>
              <select id="f-source" className={selectCls} value={state.l === "hex" ? "community" : state.s} disabled={state.l === "hex"} onChange={(e) => update({ s: e.target.value as MapState["s"] })}>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {t.map.sources[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="f-isp" className={labelCls}>
                {t.map.isp}
              </label>
              <select id="f-isp" className={selectCls} value={ispAllowed ? state.isp : 0} disabled={!ispAllowed} onChange={(e) => update({ isp: Number(e.target.value) })}>
                <option value={0}>{t.map.allIsps}</option>
                {isps.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {!ispAllowed && state.isp > 0 && <p className="text-xs text-muted">{t.map.ispNotAvailable}</p>}

          <div>
            <label htmlFor="f-period" className={labelCls}>
              {t.map.period}
            </label>
            <select
              id="f-period"
              className={selectCls}
              value={state.p}
              onChange={(e) => {
                const p = e.target.value as MapState["p"];
                update(p === "custom" ? { p, from: range.from, to: range.to } : { p });
              }}
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {t.map.periods[p]}
                </option>
              ))}
            </select>
            {state.p === "custom" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-xs text-muted">
                  {t.map.from}
                  <input type="date" className={selectCls} value={state.from ?? range.from} max={state.to ?? latest ?? undefined} min="2019-01-01" onChange={(e) => e.target.value && update({ from: e.target.value })} />
                </label>
                <label className="text-xs text-muted">
                  {t.map.to}
                  <input type="date" className={selectCls} value={state.to ?? range.to} min={state.from} max={latest ?? undefined} onChange={(e) => e.target.value && update({ to: e.target.value })} />
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

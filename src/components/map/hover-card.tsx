"use client";

import type { Locale } from "@/i18n/config";
import { fmt, formatMbps, formatNumber, type Messages } from "@/i18n/dictionary";
import type { CompactStat } from "@/lib/data";
import { LOW_N, MIN_N } from "@/lib/params";
import type { HoverInfo } from "./map-view";

export default function HoverCard({ hover, stat, t, locale, direction }: { hover: HoverInfo; stat: CompactStat | undefined; t: Messages; locale: Locale; direction: "down" | "up" }) {
  const n = stat?.[0] ?? 0;
  const enough = n >= MIN_N;
  return (
    <div
      className="pointer-events-none absolute z-20 w-60 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-sm shadow-card"
      style={{ left: hover.x, top: hover.y + 16 }}
      role="tooltip"
    >
      <p className="font-semibold leading-tight">{hover.name}</p>
      <dl className="mt-2 space-y-1 text-xs">
        {enough ? (
          <>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">
                {t.common.median} {direction === "down" ? t.common.download.toLowerCase() : t.common.upload.toLowerCase()}
              </dt>
              <dd className="font-semibold tabular-nums">
                {formatMbps(locale, stat?.[1])} {t.units.mbps}
              </dd>
            </div>
            {stat?.[4] !== null && stat?.[4] !== undefined && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted">{t.map.metrics.pctMeet}</dt>
                <dd className="font-semibold tabular-nums">{formatNumber(locale, stat[4])}%</dd>
              </div>
            )}
          </>
        ) : (
          <p className="text-muted">{t.map.legendNoData}</p>
        )}
        {hover.ap !== null && (
          <div className="flex justify-between gap-2">
            <dt className="text-muted">{t.map.metrics.advertised}</dt>
            <dd className="font-semibold tabular-nums">{hover.ap}%</dd>
          </div>
        )}
        <p className="pt-1 text-muted">
          {fmt(t.map.people, { n: formatNumber(locale, n) })}
          {enough && n < LOW_N ? ` · ${t.map.lowSample}` : ""}
        </p>
      </dl>
    </div>
  );
}

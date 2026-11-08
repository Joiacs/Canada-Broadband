"use client";

import type { Messages } from "@/i18n/dictionary";
import type { Direction } from "@/lib/hist";
import type { Metric } from "@/lib/params";
import { scaleFor } from "./scales";

export default function Legend({ metric, direction, t }: { metric: Metric; direction: Direction; t: Messages }) {
  const scale = scaleFor(metric, direction);
  const unit = scale.unit === "mbps" ? t.units.mbps : scale.unit === "pct" ? "%" : "pts";
  const title =
    metric === "median" ? `${t.map.metrics.median} — ${direction === "down" ? t.common.download : t.common.upload}` : t.map.metrics[metric];
  const labels = ["<" + scale.breaks[0], ...scale.breaks.map((b, i) => (i + 1 < scale.breaks.length ? `${b}–${scale.breaks[i + 1]}` : `${b}+`))];
  return (
    <div className="w-full max-w-xs rounded-lg border border-border bg-surface/95 p-3 text-xs shadow-card backdrop-blur">
      <p className="mb-2 font-medium text-text">
        {title} <span className="font-normal text-muted">({unit})</span>
      </p>
      <div className="flex" role="list">
        {scale.colors.map((c, i) => (
          <div key={c} className="flex-1" role="listitem" aria-label={`${labels[i]} ${unit}`}>
            <div className={`h-3 ${i === 0 ? "rounded-l" : ""} ${i === scale.colors.length - 1 ? "rounded-r" : ""}`} style={{ background: c }} />
            <div className="relative mt-1 text-center text-[10px] leading-tight text-muted">
              {scale.targetIndex === i && <span className="absolute -top-5 left-0 h-4 w-0.5 bg-text" aria-hidden />}
              {i === 0 ? "" : scale.breaks[i - 1]}
            </div>
          </div>
        ))}
      </div>
      {scale.targetIndex !== undefined && (
        <p className="mt-1 text-[11px] text-muted">
          ▏{t.map.legendTarget}: {direction === "down" ? 50 : 10} {t.units.mbps}
        </p>
      )}
      {metric === "gap" && (
        <div className="mt-1 flex justify-between text-[11px] text-muted">
          <span>← {t.map.gapLegendLow}</span>
          <span>{t.map.gapLegendHigh} →</span>
        </div>
      )}
      <div className="mt-2 flex flex-col gap-1 text-[11px] text-muted">
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-5 rounded-sm bg-nodata opacity-40" /> {t.map.legendNoData}
        </span>
        {metric !== "advertised" && (
          <span className="flex items-center gap-2">
            <span className="inline-block h-3 w-5 rounded-sm opacity-50" style={{ background: scale.colors[4] }} /> {t.map.legendLowSample}
          </span>
        )}
      </div>
    </div>
  );
}

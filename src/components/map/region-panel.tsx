"use client";

import Link from "next/link";
import { ArrowUpRight, GitCompareArrows, Maximize2, X } from "lucide-react";
import { useEffect, useState } from "react";
import Histogram from "@/components/charts/histogram";
import TrendChart from "@/components/charts/trend-chart";
import type { Locale } from "@/i18n/config";
import { regionHref, regionName } from "@/lib/region-links";
import { fmt, formatMbps, formatNumber, type Messages } from "@/i18n/dictionary";
import type { AdvertisedProvider, CommunitySummary, IspRow, RegionInfo, RegionStats, TrendPoint } from "@/lib/data";
import { LOW_N, MIN_N } from "@/lib/params";

export type RegionDetail = { region: RegionInfo; stats: RegionStats; trend: TrendPoint[]; isps: IspRow[]; providers: AdvertisedProvider[]; community: CommunitySummary };

export function useRegionDetail(id: string | null | undefined, query: string) {
  const [data, setData] = useState<{ key: string; detail: RegionDetail | null; error: boolean } | null>(null);
  const key = id ? `${id}?${query}` : "";
  useEffect(() => {
    if (!id) return;
    const ctrl = new AbortController();
    fetch(`/api/regions/${encodeURIComponent(id)}?${query}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((detail: RegionDetail) => setData({ key, detail, error: false }))
      .catch((e) => {
        if (!ctrl.signal.aborted) setData({ key, detail: null, error: Boolean(e) });
      });
    return () => ctrl.abort();
  }, [id, query, key]);
  if (!id || data?.key !== key) return { detail: null, loading: Boolean(id), error: false };
  return { detail: data.detail, loading: false, error: data.error };
}


function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "warn" }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/60 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold tabular-nums ${tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : ""}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

export function KeyStats({ detail, t, locale }: { detail: RegionDetail; t: Messages; locale: Locale }) {
  const { stats, region } = detail;
  const down = stats.down;
  const up = stats.up;
  const enough = down.n >= MIN_N;
  const gap = region.advertisedPct !== null && down.pctMeet !== null && enough ? Math.round(region.advertisedPct - down.pctMeet) : null;
  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat
        label={t.panel.medianDown}
        value={enough ? `${formatMbps(locale, down.median)} ${t.units.mbps}` : "—"}
        sub={enough && down.p25 !== null ? fmt(t.panel.typicalRange, { lo: formatMbps(locale, down.p25), hi: formatMbps(locale, down.p75) }) : undefined}
        tone={enough ? ((down.median ?? 0) >= 50 ? "good" : "warn") : undefined}
      />
      <Stat
        label={t.panel.medianUp}
        value={up.n >= MIN_N ? `${formatMbps(locale, up.median)} ${t.units.mbps}` : "—"}
        sub={up.n >= MIN_N && up.p25 !== null ? fmt(t.panel.typicalRange, { lo: formatMbps(locale, up.p25), hi: formatMbps(locale, up.p75) }) : undefined}
        tone={up.n >= MIN_N ? ((up.median ?? 0) >= 10 ? "good" : "warn") : undefined}
      />
      <Stat label={t.panel.meetingTarget} value={enough && down.pctMeet !== null ? `${formatNumber(locale, down.pctMeet)}%` : "—"} sub={fmt(t.map.people, { n: formatNumber(locale, down.n) })} />
      <Stat label={t.panel.advertised} value={region.advertisedPct !== null ? `${formatNumber(locale, region.advertisedPct)}%` : "—"} sub={t.panel.advertisedSource} />
      {gap !== null && (
        <div className="col-span-2 rounded-lg border border-border p-3 text-sm">
          <p className="text-xs text-muted">{t.panel.gap}</p>
          <p className="mt-0.5">
            <span className={`text-lg font-semibold tabular-nums ${gap > 15 ? "text-warn" : ""}`}>{gap > 0 ? `+${gap}` : gap} pts</span>
          </p>
        </div>
      )}
      {enough && down.n < LOW_N && <p className="col-span-2 text-xs text-warn">{t.map.lowSample}</p>}
    </div>
  );
}

export default function RegionPanel({
  id,
  query,
  t,
  locale,
  onClose,
  onCompare,
  onZoom,
  compareMode,
  compareId,
  onCancelCompare,
}: {
  id: string;
  query: string;
  t: Messages;
  locale: Locale;
  onClose: () => void;
  onCompare: () => void;
  onZoom: (bbox: number[]) => void;
  compareMode: boolean;
  compareId: string | null;
  onCancelCompare: () => void;
}) {
  const { detail, loading, error } = useRegionDetail(id, query);
  const compare = useRegionDetail(compareId, query);
  const [tab, setTab] = useState<"overview" | "providers" | "trend">("overview");

  return (
    <aside
      aria-label={detail ? regionName(detail.region, locale) : t.common.loading}
      className="pointer-events-auto flex max-h-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-card"
    >
      <div className="flex items-start gap-2 border-b border-border p-4">
        <div className="min-w-0 flex-1">
          {detail ? (
            <>
              <p className="text-xs text-muted">
                {t.levelSingular[detail.region.level]}
                {detail.region.parents.length > 0 && ` · ${detail.region.parents.map((p) => regionName(p, locale)).join(" › ")}`}
              </p>
              <h2 className="mt-0.5 truncate text-lg font-semibold leading-tight">{regionName(detail.region, locale)}</h2>
              {detail.region.population ? (
                <p className="text-xs text-muted">
                  {t.panel.population}: {formatNumber(locale, detail.region.population)}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted">{error ? t.common.error : t.common.loading}</p>
          )}
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text" aria-label={t.common.close}>
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {detail && (
        <>
          <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2">
            <button type="button" onClick={() => onZoom(detail.region.bbox)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-2">
              <Maximize2 className="size-3.5" aria-hidden /> {t.map.zoomTo}
            </button>
            {detail.region.level !== "hex" && (
              <button
                type="button"
                onClick={compareMode || compareId ? onCancelCompare : onCompare}
                aria-pressed={compareMode || Boolean(compareId)}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-surface-2 ${compareMode || compareId ? "border-brand text-brand" : "border-border"}`}
              >
                <GitCompareArrows className="size-3.5" aria-hidden /> {compareMode || compareId ? t.map.cancelCompare : t.map.compare}
              </button>
            )}
            {detail.region.level !== "hex" && (
              <Link href={regionHref(locale, detail.region)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-2">
                <ArrowUpRight className="size-3.5" aria-hidden /> {t.map.openPage}
              </Link>
            )}
          </div>
          {compareMode && !compareId && <p className="border-b border-border bg-surface-2 px-4 py-2 text-xs">{t.map.compareWith}</p>}

          <div className="flex-1 overflow-y-auto">
            {compareId ? (
              <div className="grid grid-cols-2 gap-3 p-4">
                {[detail, compare.detail].map((d, i) => (
                  <div key={i} className="min-w-0 space-y-2">
                    <p className="truncate text-sm font-semibold">{d ? regionName(d.region, locale) : t.common.loading}</p>
                    {d && <CompareColumn detail={d} t={t} locale={locale} />}
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div role="tablist" className="flex gap-1 px-4 pt-3">
                  {(["overview", "providers", "trend"] as const).map((k) => (
                    <button
                      key={k}
                      role="tab"
                      type="button"
                      aria-selected={tab === k}
                      onClick={() => setTab(k)}
                      className={`rounded-md px-2.5 py-1 text-sm ${tab === k ? "bg-surface-2 font-medium" : "text-muted hover:text-text"}`}
                    >
                      {t.panel[k]}
                    </button>
                  ))}
                </div>
                <div role="tabpanel" className="space-y-4 p-4">
                  {tab === "overview" && (
                    <>
                      <KeyStats detail={detail} t={t} locale={locale} />
                      {detail.stats.down.hist && detail.stats.down.n >= MIN_N && (
                        <Histogram hist={detail.stats.down.hist} target={50} title={`${t.panel.distribution} — ${t.common.download}`} locale={locale} unit={t.units.mbps} />
                      )}
                      {detail.community.n > 0 && (
                        <div className="rounded-lg border border-border p-3 text-sm">
                          <p className="text-xs font-medium text-muted">
                            {t.panel.community} ({formatNumber(locale, detail.community.n)})
                          </p>
                          <ul className="mt-2 space-y-1">
                            {detail.community.connectionTypes.slice(0, 5).map((c) => (
                              <li key={c.type} className="flex justify-between gap-2 text-xs">
                                <span>{t.tech[c.type as keyof Messages["tech"]] ?? c.type}</span>
                                <span className="tabular-nums text-muted">{Math.round((100 * c.n) / detail.community.n)}%</span>
                              </li>
                            ))}
                          </ul>
                          {detail.community.planRatio !== null && (
                            <p className="mt-2 text-xs">
                              {t.panel.planRatio}: <span className="font-semibold">{detail.community.planRatio}%</span>
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {tab === "providers" && (
                    <>
                      {detail.isps.length > 0 && (
                        <div>
                          <h3 className="mb-2 text-xs font-medium text-muted">{t.panel.byIsp}</h3>
                          <table className="w-full text-sm">
                            <thead className="text-left text-xs text-muted">
                              <tr>
                                <th scope="col" className="pb-1 font-normal">{t.map.isp}</th>
                                <th scope="col" className="pb-1 text-right font-normal">↓ {t.units.mbps}</th>
                                <th scope="col" className="pb-1 text-right font-normal">↑ {t.units.mbps}</th>
                                <th scope="col" className="pb-1 text-right font-normal">50/10</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detail.isps.map((r) => (
                                <tr key={r.ispId} className="border-t border-border">
                                  <td className="py-1.5">{r.name}</td>
                                  <td className="py-1.5 text-right tabular-nums">{formatMbps(locale, r.down.median)}</td>
                                  <td className="py-1.5 text-right tabular-nums">{r.up.n >= MIN_N ? formatMbps(locale, r.up.median) : "—"}</td>
                                  <td className="py-1.5 text-right tabular-nums">{r.down.pctMeet !== null ? `${formatNumber(locale, r.down.pctMeet)}%` : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div>
                        <h3 className="mb-2 text-xs font-medium text-muted">{t.panel.advertisedProviders}</h3>
                        {detail.providers.length ? (
                          <ul className="space-y-1.5">
                            {detail.providers.map((p) => (
                              <li key={p.name} className="flex items-start justify-between gap-3 text-sm">
                                <span>
                                  {p.name}
                                  <span className="block text-xs text-muted">{p.technologies.join(", ")}</span>
                                </span>
                                <span className="shrink-0 text-xs tabular-nums text-muted">{p.share}%</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted">{t.panel.noProviders}</p>
                        )}
                        <p className="mt-2 text-[11px] text-muted">{t.panel.advertisedSource}</p>
                      </div>
                    </>
                  )}
                  {tab === "trend" && (
                    <TrendChart
                      points={detail.trend}
                      title={t.panel.trendTitle}
                      labels={{ down: t.common.download, up: t.common.upload, target: t.common.targetValue }}
                      locale={locale}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
      {loading && !detail && <div className="h-40 animate-pulse bg-surface-2/50" />}
    </aside>
  );
}

function CompareColumn({ detail, t, locale }: { detail: RegionDetail; t: Messages; locale: Locale }) {
  const { stats, region } = detail;
  const rows: [string, string][] = [
    [t.panel.medianDown, stats.down.n >= MIN_N ? `${formatMbps(locale, stats.down.median)} ${t.units.mbps}` : "—"],
    [t.panel.medianUp, stats.up.n >= MIN_N ? `${formatMbps(locale, stats.up.median)} ${t.units.mbps}` : "—"],
    [t.panel.meetingTarget, stats.down.n >= MIN_N && stats.down.pctMeet !== null ? `${formatNumber(locale, stats.down.pctMeet)}%` : "—"],
    [t.panel.advertised, region.advertisedPct !== null ? `${formatNumber(locale, region.advertisedPct)}%` : "—"],
    [t.common.latency, stats.down.rtt !== null ? `${stats.down.rtt} ${t.units.ms}` : "—"],
    [t.units.people, formatNumber(locale, stats.down.n)],
  ];
  return (
    <dl className="space-y-2">
      {rows.map(([k, v]) => (
        <div key={k} className="rounded-md bg-surface-2/60 p-2">
          <dt className="text-[11px] text-muted">{k}</dt>
          <dd className="text-sm font-semibold tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

"use client";

import dynamic from "next/dynamic";
import { List, Map as MapIcon, SlidersHorizontal, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "@/components/theme-toggle";
import RegionSearch, { type SearchResult } from "@/components/region-search";
import type { Locale } from "@/i18n/config";
import { fmt, type Messages } from "@/i18n/dictionary";
import type { CompactStat } from "@/lib/data";
import type { HoverInfo } from "./map-view";
import Filters from "./filters";
import HoverCard from "./hover-card";
import Legend from "./legend";
import RegionPanel from "./region-panel";
import TableView from "./table-view";
import { periodRange, useMapState } from "./use-map-state";

const MapView = dynamic(() => import("./map-view"), { ssr: false, loading: () => <div className="absolute inset-0 animate-pulse bg-surface-2" /> });

type Meta = { latest: { any: string | null }; isps: { id: number; slug: string; name: string }[] };

const MIN_ZOOM_FOR: Record<string, number> = { pr: 0, cd: 2, csd: 4, hex: 5 };

export default function MapApp({ locale, t }: { locale: Locale; t: Messages }) {
  const [state, update] = useMapState();
  const theme = useTheme();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [statsResult, setStatsResult] = useState<{ key: string; regions: Record<string, CompactStat> } | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [fitTo, setFitTo] = useState<{ bbox: number[]; key: number } | null>(null);
  const [zoomTo, setZoomTo] = useState<{ zoom: number; key: number } | null>(null);
  const [zoom, setZoom] = useState(3);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => setMeta({ latest: { any: null }, isps: [] }));
  }, []);

  const range = useMemo(() => periodRange(state, meta?.latest.any ?? null), [state, meta]);
  const query = useMemo(() => {
    const q = new URLSearchParams({ level: state.l, direction: state.d, source: state.s, isp: String(state.isp), from: range.from, to: range.to });
    return q.toString();
  }, [state.l, state.d, state.s, state.isp, range]);

  useEffect(() => {
    if (!meta) return;
    const ctrl = new AbortController();
    fetch(`/api/stats?${query}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j: { regions: Record<string, CompactStat> }) => setStatsResult({ key: query, regions: j.regions }))
      .catch(() => {});
    return () => ctrl.abort();
  }, [query, meta]);
  const stats = statsResult?.key === query ? statsResult.regions : null;
  const loadingStats = Boolean(meta) && !stats;

  const detailQuery = useMemo(() => new URLSearchParams({ source: state.s, isp: String(state.isp), from: range.from, to: range.to }).toString(), [state.s, state.isp, range]);

  const onSelect = useCallback(
    (rid: string | null) => {
      if (!rid) {
        if (!compareMode) update({ r: undefined, c: undefined });
        return;
      }
      if (compareMode && state.r && rid !== state.r) {
        update({ c: rid });
        setCompareMode(false);
      } else update({ r: rid, c: undefined });
    },
    [compareMode, state.r, update],
  );

  const pickSearch = (r: SearchResult) => {
    const level = r.level === "hex" ? "csd" : r.level;
    update({ l: level, r: r.id, c: undefined, v: "map" });
    setFitTo({ bbox: r.bbox, key: Date.now() });
    setFiltersOpen(false);
  };

  const highlighted = [state.r, state.c].filter(Boolean) as string[];
  // Hexagons and communities only exist in the tiles from a certain zoom.
  const needsZoom = zoom < MIN_ZOOM_FOR[state.l] - 0.01;
  const exportHref = `/api/export?${query}`;
  const levelLabel = t.levels[state.l];

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] min-h-[520px] w-full overflow-hidden">
      <h1 className="sr-only">{t.map.title}</h1>
      <MapView
        theme={theme}
        locale={locale}
        level={state.l}
        metric={state.m}
        direction={state.m === "advertised" ? "down" : state.d}
        stats={stats}
        highlighted={highlighted}
        fitTo={fitTo}
        zoomTo={zoomTo}
        onHover={setHover}
        onSelect={onSelect}
        onZoom={setZoom}
        label={`${t.map.title} — ${levelLabel}`}
      />

      {/* Controls */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col gap-2 md:right-auto md:w-80">
        <div className="pointer-events-auto rounded-xl border border-border bg-surface/95 p-3 shadow-card backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <RegionSearch t={t} locale={locale} onPick={pickSearch} />
            </div>
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-md border border-border md:hidden"
              aria-expanded={filtersOpen}
              aria-controls="map-filters"
              aria-label={t.map.filters}
              onClick={() => setFiltersOpen((o) => !o)}
            >
              <SlidersHorizontal className="size-4" aria-hidden />
            </button>
          </div>
          <div id="map-filters" className={`${filtersOpen ? "block" : "hidden"} mt-3 md:block`}>
            <h2 className="sr-only">{t.map.filters}</h2>
            <Filters state={state} update={update} t={t} locale={locale} isps={meta?.isps ?? []} latest={meta?.latest.any ?? null} range={range} exportHref={exportHref} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-md border border-border bg-surface-2 p-0.5 text-sm" role="group" aria-label={`${t.map.mapView} / ${t.map.table}`}>
            {(["map", "table"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={state.v === v}
                onClick={() => update({ v })}
                className={`flex items-center justify-center gap-1.5 rounded px-2 py-1 ${state.v === v ? "bg-surface font-medium shadow-sm" : "text-muted"}`}
              >
                {v === "map" ? <MapIcon className="size-3.5" aria-hidden /> : <List className="size-3.5" aria-hidden />}
                {v === "map" ? t.map.mapView : t.map.table}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      {state.v === "map" && (
        <div className="absolute bottom-8 left-3 z-10 hidden w-72 md:block">
          <Legend metric={state.m} direction={state.d} t={t} />
        </div>
      )}

      {/* Status chips */}
      <div className="pointer-events-none absolute bottom-20 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 md:bottom-auto md:top-3" aria-live="polite">
        {loadingStats && <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs shadow-card">{t.common.loading}</span>}
        {needsZoom && state.v === "map" && (
          <button
            type="button"
            onClick={() => setZoomTo({ zoom: MIN_ZOOM_FOR[state.l] + 0.5, key: Date.now() })}
            className="pointer-events-auto inline-flex max-w-[90vw] items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs shadow-card hover:bg-surface-2"
          >
            <ZoomIn className="size-3.5 shrink-0" aria-hidden />
            {fmt(t.map.zoomFallback, { level: levelLabel })}
          </button>
        )}
      </div>

      {hover && state.v === "map" && <HoverCard hover={hover} stat={stats?.[hover.rid]} t={t} locale={locale} direction={state.d} />}

      {/* Table view */}
      {state.v === "table" && (
        <div className="absolute inset-0 z-[5] bg-surface pt-[1px] md:left-[21rem]">
          <TableView level={state.l} stats={stats} t={t} locale={locale} onSelect={(id) => update({ r: id, c: undefined })} />
        </div>
      )}

      {/* Region details */}
      {state.r && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex max-h-[62%] flex-col md:inset-x-auto md:bottom-3 md:right-3 md:top-3 md:max-h-none md:w-[390px]">
          <RegionPanel
            key={state.r}
            id={state.r}
            query={detailQuery}
            t={t}
            locale={locale}
            onClose={() => {
              update({ r: undefined, c: undefined });
              setCompareMode(false);
            }}
            onCompare={() => setCompareMode(true)}
            onCancelCompare={() => {
              setCompareMode(false);
              update({ c: undefined });
            }}
            onZoom={(bbox) => setFitTo({ bbox, key: Date.now() })}
            compareMode={compareMode}
            compareId={state.c ?? null}
          />
        </div>
      )}

      {/* Mobile legend toggle lives under the filters on small screens */}
      {state.v === "map" && !state.r && (
        <details className="absolute bottom-12 left-3 z-10 md:hidden">
          <summary className="cursor-pointer list-none rounded-full border border-border bg-surface px-3 py-1.5 text-xs shadow-card">{t.map.legend}</summary>
          <div className="absolute bottom-full mb-2 w-72">
            <Legend metric={state.m} direction={state.d} t={t} />
          </div>
        </details>
      )}
    </div>
  );
}

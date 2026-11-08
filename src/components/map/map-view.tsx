"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { AttributionControl, Map as MlMap, NavigationControl, addProtocol, setWorkerUrl, type ExpressionSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { CompactStat } from "@/lib/data";
import type { Direction } from "@/lib/hist";
import { LEVELS, LOW_N, MIN_N, type Level, type Metric } from "@/lib/params";
import type { Locale } from "@/i18n/config";
import { scaleFor, stepExpression } from "./scales";

let registered = false;
function registerOnce() {
  if (registered) return;
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
  const protocol = new Protocol();
  addProtocol("pmtiles", protocol.tile);
  registered = true;
}

const BASEMAPS = {
  light: process.env.NEXT_PUBLIC_BASEMAP_LIGHT || "https://tiles.openfreemap.org/styles/positron",
  dark: process.env.NEXT_PUBLIC_BASEMAP_DARK || "https://tiles.openfreemap.org/styles/dark",
};
const NODATA = { light: "#9aa3b2", dark: "#3a4456" };
const CANADA: [[number, number], [number, number]] = [[-141, 41.7], [-52.6, 70]];
const SOURCE = "regions";

export type HoverInfo = { rid: string; name: string; ap: number | null; x: number; y: number };

type Props = {
  theme: "light" | "dark";
  locale: Locale;
  level: Level;
  metric: Metric;
  direction: Direction;
  stats: Record<string, CompactStat> | null;
  highlighted: string[];
  fitTo: { bbox: number[]; key: number } | null;
  zoomTo: { zoom: number; key: number } | null;
  onHover: (h: HoverInfo | null) => void;
  onSelect: (rid: string | null) => void;
  onZoom: (z: number) => void;
  label: string;
};

function tilesUrl() {
  const base = process.env.NEXT_PUBLIC_TILES_URL || "/tiles";
  const abs = base.startsWith("http") ? base : `${window.location.origin}${base}`;
  return `pmtiles://${abs.replace(/\/$/, "")}/boundaries.pmtiles`;
}

function colorExpression(metric: Metric, direction: Direction, theme: "light" | "dark"): ExpressionSpecification {
  const scale = scaleFor(metric, direction);
  const n = ["coalesce", ["feature-state", "n"], 0];
  const hasMeasured = [">=", n, MIN_N];
  const hasAdvertised = ["has", "ap"];
  let value: unknown;
  let has: unknown;
  if (metric === "median") [value, has] = [["feature-state", "med"], ["all", hasMeasured, ["!=", ["feature-state", "med"], null]]];
  else if (metric === "pctMeet") [value, has] = [["feature-state", "pm"], ["all", hasMeasured, ["!=", ["feature-state", "pm"], null]]];
  else if (metric === "advertised") [value, has] = [["get", "ap"], hasAdvertised];
  else [value, has] = [["-", ["get", "ap"], ["feature-state", "pm"]], ["all", hasAdvertised, hasMeasured, ["!=", ["feature-state", "pm"], null]]];
  return ["case", has, stepExpression(["to-number", value], scale), NODATA[theme]] as unknown as ExpressionSpecification;
}

function opacityExpression(metric: Metric, theme: "light" | "dark"): ExpressionSpecification {
  const n = ["coalesce", ["feature-state", "n"], 0];
  const hover = ["boolean", ["feature-state", "hover"], false];
  const full = theme === "dark" ? 0.68 : 0.8;
  if (metric === "advertised") return ["case", hover, 0.95, ["has", "ap"], full, 0.18] as unknown as ExpressionSpecification;
  return ["case", hover, 0.95, ["<", n, MIN_N], 0.18, ["<", n, LOW_N], full * 0.5, full] as unknown as ExpressionSpecification;
}

export default function MapView(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const propsRef = useRef(props);
  useLayoutEffect(() => {
    propsRef.current = props;
  });
  const hovered = useRef<{ id: string; layer: Level } | null>(null);
  const styleReady = useRef(false);

  // --- create the map once -------------------------------------------------
  useEffect(() => {
    if (!container.current) return;
    registerOnce();
    const p = propsRef.current;
    const map = new MlMap({
      container: container.current,
      style: BASEMAPS[p.theme],
      bounds: CANADA,
      // leave room for the filter panel on wide screens
      fitBoundsOptions: { padding: window.innerWidth >= 768 ? { top: 24, bottom: 24, left: 340, right: 24 } : 16 },
      minZoom: 1.5,
      maxZoom: 13,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      locale: p.locale === "fr" ? { "NavigationControl.ZoomIn": "Zoomer", "NavigationControl.ZoomOut": "Dézoomer" } : undefined,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new AttributionControl({ compact: true, customAttribution: "Statistics Canada · ISED · M-Lab" }), "bottom-left");
    map.getCanvas().setAttribute("aria-label", p.label);
    mapRef.current = map;

    const onStyleLoad = () => {
      addOverlay(map);
      styleReady.current = true;
      try {
        map.setProjection({ type: "globe" });
      } catch {
        /* older GPUs: stay on mercator */
      }
      applyLevel(map);
      applyPaint(map);
      applyStats(map);
      applyHighlight(map);
    };
    map.on("style.load", onStyleLoad);

    map.on("mousemove", (e) => {
      const level = propsRef.current.level;
      const f = map.getLayer(`fill-${level}`) ? map.queryRenderedFeatures(e.point, { layers: [`fill-${level}`] })[0] : undefined;
      const rid = f?.properties?.rid as string | undefined;
      if (hovered.current && (hovered.current.id !== rid || hovered.current.layer !== level)) {
        map.setFeatureState({ source: SOURCE, sourceLayer: hovered.current.layer, id: hovered.current.id }, { hover: false });
        hovered.current = null;
      }
      if (!f || !rid) {
        map.getCanvas().style.cursor = "";
        propsRef.current.onHover(null);
        return;
      }
      map.getCanvas().style.cursor = "pointer";
      if (!hovered.current) {
        hovered.current = { id: rid, layer: level };
        map.setFeatureState({ source: SOURCE, sourceLayer: level, id: rid }, { hover: true });
      }
      const name = (propsRef.current.locale === "fr" ? f.properties.nf : undefined) ?? f.properties.ne ?? rid;
      const ap = typeof f.properties.ap === "number" ? f.properties.ap : null;
      propsRef.current.onHover({ rid, name: String(name), ap, x: e.point.x, y: e.point.y });
    });
    map.on("mouseout", () => {
      if (hovered.current) {
        map.setFeatureState({ source: SOURCE, sourceLayer: hovered.current.layer, id: hovered.current.id }, { hover: false });
        hovered.current = null;
      }
      propsRef.current.onHover(null);
    });
    map.on("click", (e) => {
      const level = propsRef.current.level;
      const f = map.getLayer(`fill-${level}`) ? map.queryRenderedFeatures(e.point, { layers: [`fill-${level}`] })[0] : undefined;
      propsRef.current.onSelect((f?.properties?.rid as string | undefined) ?? null);
    });
    map.on("zoomend", () => propsRef.current.onZoom(map.getZoom()));
    propsRef.current.onZoom(map.getZoom());

    return () => {
      map.remove();
      mapRef.current = null;
      styleReady.current = false;
    };
  }, []);

  // --- helpers that read the latest props --------------------------------
  function addOverlay(map: MlMap) {
    if (map.getSource(SOURCE)) return;
    const theme = propsRef.current.theme;
    map.addSource(SOURCE, {
      type: "vector",
      url: tilesUrl(),
      promoteId: { pr: "rid", cd: "rid", csd: "rid", hex: "rid" },
    });
    // draw under the basemap's labels so place names stay readable
    const firstSymbol = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
    const line = theme === "dark" ? "rgba(255,255,255,0.28)" : "rgba(17,24,39,0.28)";
    for (const L of LEVELS) {
      map.addLayer(
        { id: `fill-${L}`, type: "fill", source: SOURCE, "source-layer": L, layout: { visibility: "none" }, paint: { "fill-color": NODATA[theme], "fill-opacity": 0.6 } },
        firstSymbol,
      );
      map.addLayer(
        {
          id: `line-${L}`,
          type: "line",
          source: SOURCE,
          "source-layer": L,
          layout: { visibility: "none" },
          paint: { "line-color": line, "line-width": L === "hex" ? 0.25 : L === "csd" ? 0.4 : 0.7 },
        },
        firstSymbol,
      );
    }
    map.addLayer(
      { id: "pr-outline", type: "line", source: SOURCE, "source-layer": "pr", paint: { "line-color": theme === "dark" ? "rgba(255,255,255,0.55)" : "rgba(17,24,39,0.55)", "line-width": 1.2 } },
      firstSymbol,
    );
    for (const L of LEVELS) {
      map.addLayer({
        id: `hl-${L}`,
        type: "line",
        source: SOURCE,
        "source-layer": L,
        filter: ["in", ["get", "rid"], ["literal", []]],
        paint: { "line-color": theme === "dark" ? "#c4b5fd" : "#5b34e6", "line-width": 3 },
      });
    }
  }

  function applyLevel(map: MlMap) {
    if (!styleReady.current) return;
    for (const L of LEVELS) {
      const vis = L === propsRef.current.level ? "visible" : "none";
      map.setLayoutProperty(`fill-${L}`, "visibility", vis);
      map.setLayoutProperty(`line-${L}`, "visibility", vis);
      map.setLayoutProperty(`hl-${L}`, "visibility", vis);
    }
  }

  function applyPaint(map: MlMap) {
    if (!styleReady.current) return;
    const { metric, direction, theme } = propsRef.current;
    for (const L of LEVELS) {
      map.setPaintProperty(`fill-${L}`, "fill-color", colorExpression(metric, direction, theme));
      map.setPaintProperty(`fill-${L}`, "fill-opacity", opacityExpression(metric, theme));
    }
  }

  function applyStats(map: MlMap) {
    if (!styleReady.current) return;
    const { stats, level } = propsRef.current;
    for (const L of LEVELS) map.removeFeatureState({ source: SOURCE, sourceLayer: L });
    hovered.current = null;
    if (!stats) return;
    for (const [rid, s] of Object.entries(stats)) {
      map.setFeatureState({ source: SOURCE, sourceLayer: level, id: rid }, { n: s[0], med: s[1], pm: s[4] });
    }
  }

  function applyHighlight(map: MlMap) {
    if (!styleReady.current) return;
    for (const L of LEVELS) map.setFilter(`hl-${L}`, ["in", ["get", "rid"], ["literal", propsRef.current.highlighted]]);
  }

  // --- react to prop changes ------------------------------------------------
  const { theme, level, metric, direction, stats, highlighted, fitTo, zoomTo } = props;

  const lastTheme = useRef(props.theme);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || lastTheme.current === theme) return;
    lastTheme.current = theme;
    styleReady.current = false;
    // full reload so "style.load" fires and our layers are re-added
    map.setStyle(BASEMAPS[theme], { diff: false });
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) {
      applyLevel(map);
      applyStats(map);
    }
  }, [level, stats]);

  useEffect(() => {
    const map = mapRef.current;
    if (map) applyPaint(map);
  }, [metric, direction]);

  const highlightKey = highlighted.join("|");
  useEffect(() => {
    const map = mapRef.current;
    if (map) applyHighlight(map);
  }, [highlightKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitTo) return;
    const [x1, y1, x2, y2] = fitTo.bbox;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.fitBounds([[x1, y1], [x2, y2]], { padding: { top: 60, bottom: 60, left: 60, right: 60 }, maxZoom: 10, duration: reduce ? 0 : 900 });
  }, [fitTo]);

  useEffect(() => {
    if (zoomTo) mapRef.current?.easeTo({ zoom: zoomTo.zoom });
  }, [zoomTo]);

  // MapLibre's CSS forces position:relative on the map element, so size it via a wrapper.
  return (
    <div className="absolute inset-0" role="region" aria-label={props.label}>
      <div ref={container} className="h-full w-full" />
    </div>
  );
}

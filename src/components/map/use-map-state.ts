"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { LEVELS, METRICS, PERIODS, SOURCES } from "@/lib/params";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const schema = z.object({
  m: z.enum(METRICS).catch("median"),
  d: z.enum(["down", "up"]).catch("down"),
  l: z.enum(LEVELS).catch("cd"),
  s: z.enum(SOURCES).catch("all"),
  isp: z.coerce.number().int().min(0).catch(0),
  p: z.enum(PERIODS).catch("90d"),
  from: day.optional().catch(undefined),
  to: day.optional().catch(undefined),
  r: z.string().max(24).optional().catch(undefined),
  c: z.string().max(24).optional().catch(undefined),
  v: z.enum(["map", "table"]).catch("map"),
});

export type MapState = z.infer<typeof schema>;
const DEFAULTS = schema.parse({});

function toQuery(s: MapState): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(s)) {
    if (v === undefined || v === null) continue;
    if (DEFAULTS[k as keyof MapState] === v) continue;
    if ((k === "from" || k === "to") && s.p !== "custom") continue;
    q.set(k, String(v));
  }
  const str = q.toString();
  return str ? `?${str}` : "";
}

/**
 * Map filters live in the URL (shareable links, back/forward friendly) but are
 * updated with history.replaceState so changing a filter never re-renders the
 * page on the server.
 */
export function useMapState() {
  const params = useSearchParams();
  const [state, setState] = useState<MapState>(() => schema.parse(Object.fromEntries(params?.entries() ?? [])));
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const url = `${window.location.pathname}${toQuery(state)}`;
    window.history.replaceState(window.history.state, "", url);
  }, [state]);

  const update = useCallback((patch: Partial<MapState>) => setState((s) => ({ ...s, ...patch })), []);
  return [state, update] as const;
}

export function periodRange(state: MapState, latest: string | null): { from: string; to: string } {
  if (state.p === "custom" && state.from && state.to) return { from: state.from, to: state.to };
  const days = state.p === "30d" ? 30 : state.p === "365d" ? 365 : 90;
  const end = latest ? new Date(`${latest}T00:00:00Z`) : new Date(Date.now() - 86_400_000);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

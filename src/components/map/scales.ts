import type { Direction } from "@/lib/hist";
import type { Metric } from "@/lib/params";

/**
 * Colour scales. Sequential: ColorBrewer YlGnBu (colour-blind safe, readable
 * on light and dark basemaps). Diverging (gap): ColorBrewer PuOr.
 */
export const SEQ = ["#ffffcc", "#c7e9b4", "#7fcdbb", "#41b6c4", "#1d91c0", "#225ea8", "#0c2c84"] as const;
export const DIV = ["#542788", "#998ec3", "#d8daeb", "#f7f7f7", "#fee0b6", "#f1a340", "#b35806"] as const;

export type Scale = {
  /** lower bound of each class after the first (length = colors.length - 1) */
  breaks: number[];
  colors: readonly string[];
  /** index of the first class at/above the CRTC target, for the legend marker */
  targetIndex?: number;
  unit: "mbps" | "pct" | "pts";
};

export function scaleFor(metric: Metric, direction: Direction): Scale {
  switch (metric) {
    case "median":
      return direction === "down"
        ? { breaks: [10, 25, 50, 100, 250, 500], colors: SEQ, targetIndex: 3, unit: "mbps" }
        : { breaks: [2, 5, 10, 20, 50, 100], colors: SEQ, targetIndex: 3, unit: "mbps" };
    case "pctMeet":
    case "advertised":
      return { breaks: [10, 25, 50, 70, 85, 95], colors: SEQ, unit: "pct" };
    case "gap":
      // advertised % minus measured % meeting the target (percentage points);
      // the middle class (−3…3) is neutral, oranges = advertised exceeds measured
      return { breaks: [-25, -10, -3, 3, 15, 35], colors: DIV, unit: "pts" };
  }
}

export function colorFor(scale: Scale, v: number | null | undefined): string | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  let i = 0;
  while (i < scale.breaks.length && v >= scale.breaks[i]) i++;
  return scale.colors[i];
}

/** MapLibre `step` expression over an input expression. */
export function stepExpression(input: unknown, scale: Scale): unknown[] {
  const expr: unknown[] = ["step", input, scale.colors[0]];
  scale.breaks.forEach((b, i) => expr.push(b, scale.colors[i + 1]));
  return expr;
}

/** Text colour that stays readable on a given scale colour. */
export function inkFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111827" : "#ffffff";
}

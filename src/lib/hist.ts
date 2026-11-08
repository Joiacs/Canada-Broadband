/**
 * Speed histograms. Must stay in sync with bb.hist_edges() in
 * supabase/migrations/20261108000001_init.sql.
 */
export const HIST_EDGES = [0, 1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000] as const;
/** Upper bound used only for interpolating inside the last (open-ended) bin. */
const LAST_UPPER = 10000;

export const TARGET_MBPS = { down: 50, up: 10 } as const;
export type Direction = keyof typeof TARGET_MBPS;

function binBounds(i: number): [number, number] {
  return [HIST_EDGES[i], i + 1 < HIST_EDGES.length ? HIST_EDGES[i + 1] : LAST_UPPER];
}

export function histTotal(hist: readonly number[]): number {
  let n = 0;
  for (const c of hist) n += c;
  return n;
}

/**
 * Approximate the p-quantile (0..1) of a histogram. Within a bin the value is
 * interpolated on a log scale (speeds are roughly log-normal), linearly for
 * the first bin which starts at 0.
 */
export function histQuantile(hist: readonly number[], p: number): number | null {
  const n = histTotal(hist);
  if (n === 0) return null;
  const target = Math.min(Math.max(p, 0), 1) * n;
  let cum = 0;
  for (let i = 0; i < hist.length; i++) {
    const c = hist[i];
    if (c === 0) continue;
    if (cum + c >= target) {
      const frac = (target - cum) / c;
      const [lo, hi] = binBounds(i);
      return lo <= 0 ? lo + (hi - lo) * frac : lo * Math.pow(hi / lo, frac);
    }
    cum += c;
  }
  return binBounds(hist.length - 1)[0];
}

/** Share (0..1) of tests in the histogram that are slower than `mbps`. */
export function histRank(hist: readonly number[], mbps: number): number | null {
  const n = histTotal(hist);
  if (n === 0) return null;
  let below = 0;
  for (let i = 0; i < hist.length; i++) {
    const [lo, hi] = binBounds(i);
    if (mbps >= hi) below += hist[i];
    else if (mbps > lo) {
      const frac = lo <= 0 ? (mbps - lo) / (hi - lo) : Math.log(mbps / lo) / Math.log(hi / lo);
      below += hist[i] * frac;
      break;
    } else break;
  }
  return below / n;
}

export type Summary = {
  n: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
  /** share of people (client-days) meeting the CRTC target, 0..100 */
  pctMeet: number | null;
  rtt: number | null;
};

export function summarize(row: { n: number; n_meet: number; hist: number[] | null; rtt_sum: number; rtt_n: number }): Summary {
  const hist = row.hist ?? [];
  const r = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
  return {
    n: row.n,
    median: r(histQuantile(hist, 0.5)),
    p25: r(histQuantile(hist, 0.25)),
    p75: r(histQuantile(hist, 0.75)),
    pctMeet: row.n ? Math.round((1000 * row.n_meet) / row.n) / 10 : null,
    rtt: row.rtt_n ? Math.round(row.rtt_sum / row.rtt_n) : null,
  };
}

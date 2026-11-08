import { describe, expect, it } from "vitest";
import { HIST_EDGES, histQuantile, histRank, histTotal, summarize } from "@/lib/hist";

/** Build a histogram the same way bb.hist_bin() does in SQL. */
function histOf(values: number[]) {
  const h = new Array(HIST_EDGES.length).fill(0);
  for (const v of values) {
    let i = 0;
    while (i + 1 < HIST_EDGES.length && v >= HIST_EDGES[i + 1]) i++;
    h[i]++;
  }
  return h;
}

describe("histogram statistics", () => {
  it("has 10 and 50 Mbps as exact bin edges (targets)", () => {
    expect(HIST_EDGES).toContain(10);
    expect(HIST_EDGES).toContain(50);
  });

  it("returns null for empty histograms", () => {
    const empty = new Array(HIST_EDGES.length).fill(0);
    expect(histQuantile(empty, 0.5)).toBeNull();
    expect(histRank(empty, 10)).toBeNull();
  });

  it("estimates the median of log-normal-ish data within ~15%", () => {
    // deterministic pseudo-random log-normal sample, true median = 100
    const values: number[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 5000; i++) {
      const z = Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd());
      values.push(Math.exp(Math.log(100) + 0.8 * z));
    }
    const sorted = [...values].sort((a, b) => a - b);
    const trueMedian = sorted[2500];
    const est = histQuantile(histOf(values), 0.5)!;
    expect(Math.abs(est - trueMedian) / trueMedian).toBeLessThan(0.15);
  });

  it("quantiles are monotonic", () => {
    const h = histOf([1, 4, 8, 12, 30, 55, 80, 120, 300, 900]);
    const q = [0.1, 0.25, 0.5, 0.75, 0.9].map((p) => histQuantile(h, p)!);
    for (let i = 1; i < q.length; i++) expect(q[i]).toBeGreaterThanOrEqual(q[i - 1]);
  });

  it("rank is the share of tests below a speed", () => {
    const h = histOf([5, 5, 20, 20, 60, 60, 60, 200]);
    expect(histTotal(h)).toBe(8);
    expect(histRank(h, 50)).toBeCloseTo(4 / 8, 5); // exactly on an edge
    expect(histRank(h, 10000)).toBe(1);
    expect(histRank(h, 0)).toBe(0);
  });

  it("summarize computes share meeting the target from n_meet", () => {
    const s = summarize({ n: 200, n_meet: 50, hist: histOf(new Array(200).fill(30)), rtt_sum: 4000, rtt_n: 200 });
    expect(s.pctMeet).toBe(25);
    expect(s.rtt).toBe(20);
    expect(s.median).toBeGreaterThanOrEqual(30);
    expect(s.median).toBeLessThan(40);
  });
});

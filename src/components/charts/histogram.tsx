import { HIST_EDGES } from "@/lib/hist";

const BUCKETS = [0, 5, 10, 25, 50, 100, 250, 500, 1000];

function bucketize(hist: number[]): number[] {
  const out = new Array(BUCKETS.length).fill(0);
  hist.forEach((c, i) => {
    const lo = HIST_EDGES[i];
    let b = 0;
    while (b + 1 < BUCKETS.length && lo >= BUCKETS[b + 1]) b++;
    out[b] += c;
  });
  return out;
}

/** Full range, for the screen-reader table. */
function label(i: number) {
  return i === BUCKETS.length - 1 ? `${BUCKETS[i]}+` : `${BUCKETS[i]}–${BUCKETS[i + 1]}`;
}

/** Compact axis label: the bucket's lower bound ("1000+" for the last). */
function tick(i: number) {
  return i === BUCKETS.length - 1 ? `${BUCKETS[i]}+` : i === 0 ? `<${BUCKETS[1]}` : String(BUCKETS[i]);
}

/** Bar chart of the share of people in each speed range; bars at/above the target are highlighted. */
export default function Histogram({ hist, target, title, unit }: { hist: number[]; target: number; title: string; locale?: string; unit: string }) {
  const counts = bucketize(hist);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const pct = counts.map((c) => (100 * c) / total);
  const max = Math.max(...pct, 1);
  const W = 320, H = 120, pad = 18, bw = (W - 8) / counts.length;
  return (
    <figure className="w-full">
      <figcaption className="mb-1 text-xs font-medium text-muted">
        {title} ({unit})
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H + pad}`} className="w-full" role="img" aria-hidden>
        {pct.map((p, i) => {
          const h = (p / max) * (H - 14);
          const meets = BUCKETS[i] >= target;
          return (
            <g key={i}>
              <rect x={4 + i * bw + 2} y={H - h} width={bw - 4} height={Math.max(h, p > 0 ? 1.5 : 0)} rx={2} fill={meets ? "var(--brand)" : "var(--nodata)"} opacity={meets ? 0.9 : 0.75} />
              {p >= 1 && (
                <text x={4 + i * bw + bw / 2} y={H - h - 3} textAnchor="middle" fontSize="9" fill="var(--muted)">
                  {Math.round(p)}%
                </text>
              )}
              <text x={4 + i * bw + bw / 2} y={H + 12} textAnchor="middle" fontSize="8.5" fill="var(--muted)">
                {tick(i)}
              </text>
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {pct.map((p, i) => (
            <tr key={i}>
              <th scope="row">
                {label(i)} {unit}
              </th>
              <td>{p.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

type Point = { month: string; down: number | null; up: number | null };

/** Monthly medians, download and upload, on a log scale with the 50/10 targets dashed. */
export default function TrendChart({ points, title, labels, locale }: { points: Point[]; title: string; labels: { down: string; up: string; target: string }; locale: string }) {
  const valid = points.filter((p) => p.down !== null || p.up !== null);
  if (valid.length < 2) return null;
  const W = 320, H = 140, L = 30, R = 6, T = 8, B = 18;
  const vals = valid.flatMap((p) => [p.down, p.up]).filter((v): v is number => v !== null && v > 0);
  const lo = Math.max(0.5, Math.min(5, ...vals) * 0.8);
  const hi = Math.max(100, ...vals) * 1.1;
  const y = (v: number) => Math.round((T + (H - T - B) * (1 - (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)))) * 100) / 100;
  const x = (i: number) => L + ((W - L - R) * i) / Math.max(points.length - 1, 1);
  const path = (key: "down" | "up") =>
    points
      .map((p, i) => (p[key] ? `${i === 0 || !points[i - 1][key] ? "M" : "L"}${x(i).toFixed(1)},${y(p[key]!).toFixed(1)}` : ""))
      .join(" ");
  const ticks = [1, 10, 100, 1000].filter((t) => t >= lo && t <= hi);
  const monthFmt = new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", { month: "short", year: "numeric", timeZone: "UTC" });
  const labelIdx = points.length <= 6 ? points.map((_, i) => i) : [0, Math.floor(points.length / 2), points.length - 1];
  return (
    <figure className="w-full">
      <figcaption className="mb-1 flex items-center gap-3 text-xs font-medium text-muted">
        <span>{title}</span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 bg-brand" /> {labels.down}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 bg-brand-2" /> {labels.up}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={0.6} />
            <text x={L - 4} y={y(t) + 3} textAnchor="end" fontSize="8.5" fill="var(--muted)">
              {t >= 1000 ? "1G" : t}
            </text>
          </g>
        ))}
        {[50, 10].filter((t) => t >= lo && t <= hi).map((t) => (
          <line key={`t${t}`} x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 50 ? "var(--brand)" : "var(--brand-2)"} strokeDasharray="3 3" strokeWidth={0.8} opacity={0.6} />
        ))}
        <path d={path("down")} fill="none" stroke="var(--brand)" strokeWidth={2} />
        <path d={path("up")} fill="none" stroke="var(--brand-2)" strokeWidth={2} />
        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 4} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize="8.5" fill="var(--muted)">
            {monthFmt.format(new Date(`${points[i].month}-01T00:00:00Z`))}
          </text>
        ))}
      </svg>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">{labels.down}</th>
            <th scope="col">{labels.up}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.month}>
              <th scope="row">{p.month}</th>
              <td>{p.down ?? "—"}</td>
              <td>{p.up ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sr-only">{labels.target}</p>
    </figure>
  );
}

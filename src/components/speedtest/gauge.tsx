/** Semicircular speed gauge on a log scale (1 → 1000+ Mbps). */
export default function Gauge({ value, label, unit, active }: { value: number | null; label: string; unit: string; active: boolean }) {
  const max = 1000;
  const frac = value && value > 0 ? Math.min(1, Math.log10(1 + value) / Math.log10(1 + max)) : 0;
  const R = 80, cx = 100, cy = 96;
  const arc = (f: number) => {
    const a = Math.PI * (1 - f);
    // rounded: Math.cos/sin differ in the last digits between Node and browsers (hydration)
    return [Math.round((cx + R * Math.cos(a)) * 100) / 100, Math.round((cy - R * Math.sin(a)) * 100) / 100];
  };
  const [ex, ey] = arc(frac);
  const ticks = [1, 10, 50, 100, 1000];
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 116" className="w-full max-w-[260px]" aria-hidden>
        <defs>
          <linearGradient id="g-grad" x1="0" x2="1">
            <stop offset="0" stopColor="var(--brand-2)" />
            <stop offset="1" stopColor="var(--brand)" />
          </linearGradient>
        </defs>
        <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="none" stroke="var(--surface-2)" strokeWidth={14} strokeLinecap="round" />
        {frac > 0 && <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${ex} ${ey}`} fill="none" stroke="url(#g-grad)" strokeWidth={14} strokeLinecap="round" />}
        {ticks.map((t) => {
          const f = Math.log10(1 + t) / Math.log10(1 + max);
          const [x, y] = arc(f);
          const [ix, iy] = [Math.round((cx + (x - cx) * 0.78) * 100) / 100, Math.round((cy + (y - cy) * 0.78) * 100) / 100];
          return (
            <text key={t} x={ix} y={iy + 3} textAnchor="middle" fontSize="8" fill="var(--muted)">
              {t}
            </text>
          );
        })}
      </svg>
      <div className="-mt-10 text-center" aria-live={active ? "polite" : "off"}>
        <p className="text-4xl font-semibold tabular-nums">{value === null ? "—" : value < 10 ? value.toFixed(1) : Math.round(value)}</p>
        <p className="text-xs text-muted">
          {label} · {unit}
        </p>
      </div>
    </div>
  );
}

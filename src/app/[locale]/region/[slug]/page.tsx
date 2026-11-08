import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { Gauge, MapPinned } from "lucide-react";
import Histogram from "@/components/charts/histogram";
import TrendChart from "@/components/charts/trend-chart";
import { KeyStats } from "@/components/map/region-panel";
import { regionHref, regionName } from "@/lib/region-links";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { fmt, formatMbps, formatNumber, getDictionary } from "@/i18n/dictionary";
import {
  defaultRange,
  getAdvertisedProviders,
  getChildren,
  getCommunitySummary,
  getMapStats,
  getMeta,
  getRegion,
  getRegionIsps,
  getRegionStats,
  getRegionTrend,
} from "@/lib/data";
import { MIN_N, regionIdSchema } from "@/lib/params";
import { provinceByCode } from "@/lib/provinces";

/** "csd-3520005-toronto" → "csd:3520005" */
function idFromSlug(slug: string): string | null {
  const m = /^(pr|cd|csd)-([0-9]{2,8})(?:-|$)/.exec(slug);
  if (!m) return null;
  const id = `${m[1]}:${m[2]}`;
  return regionIdSchema.safeParse(id).success ? id : null;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/region/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const id = idFromSlug(slug);
  if (!isLocale(locale) || !id) return {};
  const region = await getRegion(id).catch(() => null);
  if (!region) return {};
  const t = getDictionary(locale);
  const name = regionName(region, locale);
  const prov = provinceByCode.get(region.prCode);
  const path = (l: Locale) => regionHref(l, region);
  return {
    title: name,
    description: fmt(t.region.metaDescription, { name, province: prov ? prov[locale] : "" }),
    alternates: { canonical: path(locale), languages: { "en-CA": path("en"), "fr-CA": path("fr") } },
  };
}

export default function RegionPage({ params }: PageProps<"/[locale]/region/[slug]">) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-surface-2" />}>
        <RegionContent params={params} />
      </Suspense>
    </div>
  );
}

async function RegionContent({ params }: { params: PageProps<"/[locale]/region/[slug]">["params"] }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const id = idFromSlug(slug);
  if (!id) notFound();
  const region = await getRegion(id);
  if (!region) notFound();
  const canonical = regionHref(locale, region);
  if (canonical !== localePath(locale, "region", slug)) permanentRedirect(canonical);

  const t = getDictionary(locale);
  const meta = await getMeta();
  const { from, to } = defaultRange(meta.latest.any);
  const childLevel = region.level === "pr" ? "cd" : region.level === "cd" ? "csd" : null;
  const [stats, trend, isps, providers, community, children, childStats] = await Promise.all([
    getRegionStats(id, { source: "all", isp: 0, from, to }),
    getRegionTrend(id, "all", to),
    getRegionIsps(id, { source: "all", from, to }),
    getAdvertisedProviders(id),
    getCommunitySummary(id, from, to),
    getChildren(id),
    childLevel ? getMapStats({ level: childLevel, direction: "down", source: "all", isp: 0, from, to }) : Promise.resolve({}),
  ]);
  const name = regionName(region, locale);
  const detail = { region, stats, trend, isps, providers, community };
  const mapHref = `${localePath(locale, "home")}?l=${region.level}&r=${encodeURIComponent(region.id)}`;

  return (
    <article>
      <nav aria-label={t.region.breadcrumbs} className="mb-3 text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href={localePath(locale, "home")} className="hover:text-text">
              {t.common.canada}
            </Link>
          </li>
          {region.parents.map((p) => (
            <li key={p.id} className="flex items-center gap-1.5">
              <span aria-hidden>›</span>
              <Link href={regionHref(locale, p)} className="hover:text-text">
                {regionName(p, locale)}
              </Link>
            </li>
          ))}
        </ol>
      </nav>
      <header className="mb-6">
        <p className="text-sm text-muted">{t.levelSingular[region.level]}</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{name}</h1>
        <p className="mt-3 max-w-2xl text-lg">
          {stats.down.n >= MIN_N && stats.down.median !== null ? fmt(t.region.summaryDown, { median: formatMbps(locale, stats.down.median) }) : t.region.summaryNone}
        </p>
        <p className="mt-1 text-sm text-muted">{t.region.last90}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={mapHref} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-contrast">
            <MapPinned className="size-4" aria-hidden /> {t.region.explore}
          </Link>
          <Link href={localePath(locale, "speedTest")} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-surface-2">
            <Gauge className="size-4" aria-hidden /> {t.region.runTest}
          </Link>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <KeyStats detail={detail} t={t} locale={locale} />
        </section>
        <section className="space-y-6 rounded-2xl border border-border bg-surface p-5 shadow-card">
          {stats.down.hist && stats.down.n >= MIN_N && <Histogram hist={stats.down.hist} target={50} title={`${t.panel.distribution} — ${t.common.download}`} unit={t.units.mbps} />}
          <TrendChart points={trend} title={t.panel.trendTitle} labels={{ down: t.common.download, up: t.common.upload, target: t.common.targetValue }} locale={locale} />
        </section>

        {(isps.length > 0 || providers.length > 0) && (
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-card lg:col-span-2">
            <h2 className="mb-3 text-lg font-semibold">{t.panel.providers}</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {isps.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-muted">{t.panel.byIsp}</h3>
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted">
                      <tr>
                        <th scope="col" className="pb-1 font-normal">{t.map.isp}</th>
                        <th scope="col" className="pb-1 text-right font-normal">↓ {t.units.mbps}</th>
                        <th scope="col" className="pb-1 text-right font-normal">↑ {t.units.mbps}</th>
                        <th scope="col" className="pb-1 text-right font-normal">50/10</th>
                        <th scope="col" className="pb-1 text-right font-normal">{t.units.people}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isps.map((r) => (
                        <tr key={r.ispId} className="border-t border-border">
                          <td className="py-1.5">{r.name}</td>
                          <td className="py-1.5 text-right tabular-nums">{formatMbps(locale, r.down.median)}</td>
                          <td className="py-1.5 text-right tabular-nums">{r.up.n >= MIN_N ? formatMbps(locale, r.up.median) : "—"}</td>
                          <td className="py-1.5 text-right tabular-nums">{r.down.pctMeet !== null ? `${formatNumber(locale, r.down.pctMeet)}%` : "—"}</td>
                          <td className="py-1.5 text-right tabular-nums text-muted">{formatNumber(locale, r.down.n)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {providers.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-muted">{t.panel.advertisedProviders}</h3>
                  <ul className="space-y-1.5 text-sm">
                    {providers.slice(0, 15).map((p) => (
                      <li key={p.name} className="flex justify-between gap-3">
                        <span>
                          {p.name} <span className="text-xs text-muted">· {p.technologies.join(", ")}</span>
                        </span>
                        <span className="text-xs tabular-nums text-muted">{p.share}%</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-muted">{t.panel.advertisedSource}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {children.length > 0 && (
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-card lg:col-span-2">
            <h2 className="mb-3 text-lg font-semibold">{fmt(t.region.subregions, { name })}</h2>
            <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {children.map((c) => {
                const s = (childStats as Record<string, [number, number | null]>)[c.id];
                return (
                  <li key={c.id} className="flex justify-between gap-2 border-b border-border py-1.5">
                    <Link href={regionHref(locale, c)} className="hover:underline">
                      {regionName(c, locale)}
                    </Link>
                    <span className="tabular-nums text-muted">{s && s[0] >= MIN_N ? `${formatMbps(locale, s[1])} ${t.units.mbps}` : "—"}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </article>
  );
}

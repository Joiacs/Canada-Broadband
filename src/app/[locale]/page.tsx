import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionary";
import MapApp from "@/components/map/map-app";

export default async function MapPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  return (
    // MapApp reads filters from the URL, so it renders on the client inside Suspense.
    <Suspense fallback={<div className="h-[calc(100dvh-3.5rem)] animate-pulse bg-surface-2" aria-label={t.common.loading} />}>
      <MapApp locale={locale} t={t} />
    </Suspense>
  );
}

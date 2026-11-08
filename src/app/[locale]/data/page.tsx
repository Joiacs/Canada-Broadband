import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import ContentPage from "@/components/content-page";
import { DataEn, DataFr } from "@/content/data";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionary";
import { defaultRange, getMeta } from "@/lib/data";

export async function generateMetadata({ params }: PageProps<"/[locale]/data">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return {
    title: t.nav.data,
    alternates: { canonical: localePath(locale, "data"), languages: { "en-CA": localePath("en", "data"), "fr-CA": localePath("fr", "data") } },
  };
}

async function DataContent({ locale }: { locale: Locale }) {
  await connection();
  const meta = await getMeta().catch(() => null);
  const latest = defaultRange(meta?.latest.any ?? null).to;
  return locale === "fr" ? <DataFr locale={locale} latest={latest} /> : <DataEn locale={locale} latest={latest} />;
}

export default async function Page({ params }: PageProps<"/[locale]/data">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  return (
    <ContentPage title={t.nav.data}>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-surface-2" />}>
        <DataContent locale={locale} />
      </Suspense>
    </ContentPage>
  );
}

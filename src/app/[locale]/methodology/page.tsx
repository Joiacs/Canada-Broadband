import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContentPage from "@/components/content-page";
import { MethodologyEn, MethodologyFr } from "@/content/methodology";
import { isLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionary";

export async function generateMetadata({ params }: PageProps<"/[locale]/methodology">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return {
    title: t.nav.methodology,
    alternates: { canonical: localePath(locale, "methodology"), languages: { "en-CA": localePath("en", "methodology"), "fr-CA": localePath("fr", "methodology") } },
  };
}

export default async function Page({ params }: PageProps<"/[locale]/methodology">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  return <ContentPage title={t.nav.methodology}>{locale === "fr" ? <MethodologyFr /> : <MethodologyEn />}</ContentPage>;
}

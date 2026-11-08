import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContentPage from "@/components/content-page";
import { AboutEn, AboutFr } from "@/content/about";
import { isLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionary";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return {
    title: t.nav.about,
    alternates: { canonical: localePath(locale, "about"), languages: { "en-CA": localePath("en", "about"), "fr-CA": localePath("fr", "about") } },
  };
}

export default async function Page({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  return <ContentPage title={t.nav.about}>{locale === "fr" ? <AboutFr /> : <AboutEn />}</ContentPage>;
}

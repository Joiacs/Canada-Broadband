import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContentPage from "@/components/content-page";
import { PrivacyEn, PrivacyFr } from "@/content/privacy";
import { isLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionary";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return {
    title: t.footer.privacy,
    alternates: { canonical: localePath(locale, "privacy"), languages: { "en-CA": localePath("en", "privacy"), "fr-CA": localePath("fr", "privacy") } },
  };
}

export default async function Page({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  return <ContentPage title={t.footer.privacy}>{locale === "fr" ? <PrivacyFr /> : <PrivacyEn />}</ContentPage>;
}

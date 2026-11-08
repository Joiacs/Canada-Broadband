import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionary";
import SpeedTest from "@/components/speedtest/speed-test";

export async function generateMetadata({ params }: PageProps<"/[locale]/speed-test">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return {
    title: t.speedTest.title,
    description: t.speedTest.intro,
    alternates: { canonical: localePath(locale, "speedTest"), languages: { "en-CA": localePath("en", "speedTest"), "fr-CA": localePath("fr", "speedTest") } },
  };
}

export default async function SpeedTestPage({ params }: PageProps<"/[locale]/speed-test">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          <span className="text-gradient">{t.speedTest.title}</span>
        </h1>
        <p className="mt-3 text-muted">{t.speedTest.intro}</p>
      </header>
      <SpeedTest t={t} locale={locale} />
    </div>
  );
}

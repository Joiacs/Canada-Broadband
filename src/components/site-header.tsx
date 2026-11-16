import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { Menu } from "lucide-react";
import { localePath, type Locale, type PageKey } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionary";
import LanguageSwitcher from "./language-switcher";
import ThemeToggle from "./theme-toggle";
import NavLink from "./nav-link";
import MobileMenu from "./mobile-menu";

const plainLink = "whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2";

export default function SiteHeader({ locale, t }: { locale: Locale; t: Messages }) {
  const items: { page: PageKey; label: string }[] = [
    { page: "home", label: t.nav.map },
    { page: "speedTest", label: t.nav.speedTest },
    { page: "methodology", label: t.nav.methodology },
    { page: "data", label: t.nav.data },
    { page: "about", label: t.nav.about },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/75">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-3 px-4">
        <Link href={localePath(locale, "home")} className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <Image src="/ideva-bulb.png" alt="Ideva" width={28} height={28} priority />
          <span>
            {t.meta.brandLead} <span className="text-gradient">{t.meta.brandAccent}</span>
            <span className="ml-1.5 hidden text-xs font-normal text-muted lg:inline">{t.meta.by}</span>
          </span>
        </Link>
        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
          {items.map((i) => (
            // usePathname() needs a Suspense boundary on dynamic routes; the fallback is a plain link
            <Suspense key={i.page} fallback={<Link href={localePath(locale, i.page)} className={plainLink}>{i.label}</Link>}>
              <NavLink href={localePath(locale, i.page)} exact={i.page === "home"}>
                {i.label}
              </NavLink>
            </Suspense>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Suspense fallback={<a href={`/${locale === "en" ? "fr" : "en"}`} className={plainLink}>{t.nav.language}</a>}>
            <LanguageSwitcher locale={locale} label={t.nav.language} ariaLabel={t.nav.languageLabel} />
          </Suspense>
          <ThemeToggle label={t.nav.theme} />
          {/* usePathname() needs Suspense; the fallback is the closed menu button */}
          <Suspense
            fallback={
              <span className="flex size-9 items-center justify-center rounded-md md:hidden" aria-hidden>
                <Menu className="size-5" />
              </span>
            }
          >
            <MobileMenu
              label={t.nav.menu}
              closeLabel={t.common.close}
              items={items.map((i) => ({ href: localePath(locale, i.page), label: i.label, exact: i.page === "home" }))}
            />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

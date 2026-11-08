"use client";

import { usePathname } from "next/navigation";
import { switchLocalePath, type Locale } from "@/i18n/config";

/** Links to the same page in the other language, keeping map filters in the query string. */
export default function LanguageSwitcher({ locale, label, ariaLabel }: { locale: Locale; label: string; ariaLabel: string }) {
  const pathname = usePathname() ?? `/${locale}`;
  const target: Locale = locale === "en" ? "fr" : "en";
  const href = switchLocalePath(pathname, target);
  return (
    <a
      href={href}
      hrefLang={target === "fr" ? "fr-CA" : "en-CA"}
      lang={target}
      aria-label={ariaLabel}
      onClick={(e) => {
        // carry the current query string (map filters) across
        e.preventDefault();
        window.location.assign(href + window.location.search);
      }}
      className="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-text"
    >
      {label}
    </a>
  );
}

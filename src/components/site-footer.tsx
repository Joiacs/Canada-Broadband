import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionary";

// Evaluated once at module load (timestamps inside render break prerendering).
const YEAR = new Date().getUTCFullYear();

export default function SiteFooter({ locale, t }: { locale: Locale; t: Messages }) {
  return (
    <footer className="border-t border-border bg-surface text-sm text-muted">
      <div className="mx-auto flex max-w-screen-2xl flex-col gap-3 px-4 py-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl space-y-1">
          <p>
            © {YEAR} {t.footer.rights}
          </p>
          <p className="text-xs leading-relaxed">{t.footer.sources}</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-1">
          <Link className="hover:text-text" href={localePath(locale, "methodology")}>
            {t.footer.methodology}
          </Link>
          <Link className="hover:text-text" href={localePath(locale, "data")}>
            {t.footer.data}
          </Link>
          <Link className="hover:text-text" href={localePath(locale, "privacy")}>
            {t.footer.privacy}
          </Link>
        </nav>
      </div>
    </footer>
  );
}

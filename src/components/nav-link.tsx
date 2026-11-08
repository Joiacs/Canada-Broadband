"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PAGES } from "@/i18n/config";

/** Highlights the current page; understands translated French segments. */
export default function NavLink({ href, exact, block, children }: { href: string; exact?: boolean; block?: boolean; children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const norm = (p: string) => {
    const parts = p.split("/").filter(Boolean);
    if (parts[1]) {
      for (const page of Object.values(PAGES)) if (page.fr === parts[1]) parts[1] = page.en;
    }
    return "/" + parts.join("/");
  };
  const a = norm(pathname);
  const b = norm(href);
  const active = exact ? a === b : a === b || a.startsWith(b + "/");
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-surface-2 ${block ? "block" : ""} ${active ? "font-semibold text-text" : "text-muted"}`}
    >
      {children}
    </Link>
  );
}

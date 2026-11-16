"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import NavLink from "./nav-link";

/**
 * Phone navigation menu. Closes when a link is tapped, when the page changes
 * (back/forward too), on a tap outside, and on Escape.
 */
export default function MobileMenu({ items, label, closeLabel }: { items: { href: string; label: string; exact: boolean }[]; label: string; closeLabel: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const [lastPath, setLastPath] = useState(pathname);

  // close when the route changes (adjusting state during render, not in an effect)
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? closeLabel : label}
        onClick={() => setOpen((o) => !o)}
        className="flex size-9 items-center justify-center rounded-md hover:bg-surface-2"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          // closes on tap even when the link points at the current page
          onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
          className="absolute right-0 z-50 mt-2 flex w-56 flex-col rounded-lg border border-border bg-surface p-2 shadow-card"
        >
          {items.map((i) => (
            <NavLink key={i.href} href={i.href} exact={i.exact} block>
              {i.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}

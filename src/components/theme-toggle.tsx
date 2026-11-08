"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

export function getEffectiveTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  const t = document.documentElement.dataset.theme;
  if (t === "dark" || t === "light") return t;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Subscribe to theme changes (toggle or OS setting). */
export function useTheme(): "light" | "dark" {
  return useSyncExternalStore(
    (cb) => {
      const mo = new MutationObserver(cb);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", cb);
      return () => {
        mo.disconnect();
        mq.removeEventListener("change", cb);
      };
    },
    getEffectiveTheme,
    () => "light",
  );
}

export default function ThemeToggle({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        const next = theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("theme", next);
        } catch {}
      }}
      className="flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
    >
      {theme === "dark" ? <Sun className="size-4.5" aria-hidden /> : <Moon className="size-4.5" aria-hidden />}
    </button>
  );
}

"use client";

import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionary";
import { provinceByCode } from "@/lib/provinces";
import type { Level } from "@/lib/params";

export type SearchResult = { id: string; level: Level; nameEn: string; nameFr: string; slug: string; prCode: string; bbox: number[] };

/** Accessible combobox searching provinces, census divisions and communities. */
export default function RegionSearch({
  t,
  locale,
  onPick,
  placeholder,
  levels,
}: {
  t: Messages;
  locale: Locale;
  onPick: (r: SearchResult) => void;
  placeholder?: string;
  levels?: Level[];
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/regions/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        const json = (await res.json()) as { results: SearchResult[] };
        const filtered = levels ? json.results.filter((r) => levels.includes(r.level)) : json.results;
        setResults(filtered);
        setOpen(true);
        setActive(filtered.length ? 0 : -1);
      } catch {
        /* aborted or offline */
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, levels]);

  const pick = (r: SearchResult) => {
    onPick(r);
    setQ(locale === "fr" ? r.nameFr : r.nameEn);
    setOpen(false);
  };
  const shown = q.trim().length >= 2 ? results : [];

  return (
    <div className="relative">
      <label htmlFor={`${listId}-input`} className="sr-only">
        {t.map.searchLabel}
      </label>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        ref={inputRef}
        id={`${listId}-input`}
        type="search"
        role="combobox"
        aria-expanded={open && shown.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder ?? t.map.search}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => shown.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, shown.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && active >= 0 && shown[active]) {
            e.preventDefault();
            pick(shown[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
        className="w-full rounded-md border border-border bg-surface py-2 pl-8 pr-3 text-sm text-text shadow-sm placeholder:text-muted focus:border-brand focus:outline-none"
      />
      {open && q.trim().length >= 2 && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-surface py-1 shadow-card">
          {shown.length === 0 && <li className="px-3 py-2 text-sm text-muted">{t.map.noResults}</li>}
          {shown.map((r, i) => (
            <li
              key={r.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(r);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-surface-2" : ""}`}
            >
              <span className="font-medium">{locale === "fr" ? r.nameFr : r.nameEn}</span>
              <span className="ml-2 text-xs text-muted">
                {t.levelSingular[r.level]}
                {r.level !== "pr" ? ` · ${provinceByCode.get(r.prCode)?.abbr ?? ""}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

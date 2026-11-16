"use client";

import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

export type SelectOption<T extends string | number> = { value: T; label: string };

/**
 * Site-styled replacement for <select>: a button that opens a listbox.
 * Keyboard: ↑/↓ (opens), Home/End, Enter/Space to pick, Esc to close,
 * typing jumps to the first matching option. Screen readers get the
 * button/listbox/option roles and aria-activedescendant.
 */
export default function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
  placeholder = "—",
  hideLabel,
  size = "md",
}: {
  label: string;
  value: T | null | undefined;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  placeholder?: string;
  hideLabel?: boolean;
  size?: "sm" | "md";
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const buttonId = `${id}-button`;
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const openList = useCallback(
    (at?: number) => {
      if (disabled) return;
      setActive(at ?? Math.max(selectedIndex, 0));
      setOpen(true);
    },
    [disabled, selectedIndex],
  );

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  }, []);

  const pick = (i: number) => {
    const o = options[i];
    if (o) onChange(o.value);
    close();
  };

  // focus the list when it opens; keep the active option in view
  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, close]);

  const typeAhead = (key: string) => {
    const now = Date.now();
    typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + key.toLowerCase(), at: now };
    const start = open ? active + 1 : 0;
    const order = [...options.slice(start), ...options.slice(0, start)];
    const match = order.find((o) => o.label.toLowerCase().startsWith(typed.current.text));
    return match ? options.indexOf(match) : -1;
  };

  const onButtonKey = (e: React.KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList(e.key === "ArrowUp" ? Math.max(selectedIndex - 1, 0) : undefined);
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const i = typeAhead(e.key);
      if (i >= 0) openList(i);
    }
  };

  const onListKey = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, last));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else if (e.key === "Enter" || e.key === " ") pick(active);
    else if (e.key === "Escape") close();
    else if (e.key === "Tab") {
      setOpen(false);
      return;
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const i = typeAhead(e.key);
      if (i >= 0) setActive(i);
    } else return;
    e.preventDefault();
  };

  const pad = size === "sm" ? "px-2.5 py-1.5 text-sm" : "px-3 py-2 text-sm";

  return (
    <div ref={root} className="relative">
      <span id={labelId} className={hideLabel ? "sr-only" : "mb-1 block text-xs font-medium text-muted"}>
        {label}
      </span>
      <button
        ref={button}
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelId} ${buttonId}`}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onButtonKey}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-surface text-left text-text shadow-sm transition-colors ${pad} ${
          open ? "border-brand ring-2 ring-brand/20" : "border-border hover:border-muted/60"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <span className={`truncate ${selected ? "" : "text-muted"}`}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div
          ref={list}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelId}
          aria-activedescendant={`${id}-opt-${active}`}
          onKeyDown={onListKey}
          className="absolute left-0 z-50 mt-1 max-h-72 min-w-full overflow-auto rounded-lg border border-border bg-surface p-1 shadow-card focus:outline-none"
        >
          {options.map((o, i) => {
            const isSelected = o.value === value;
            return (
              <div
                key={String(o.value)}
                id={`${id}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(i)}
                className={`flex cursor-pointer items-center justify-between gap-3 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm ${
                  i === active ? "bg-surface-2" : ""
                } ${isSelected ? "font-medium text-brand" : "text-text"}`}
              >
                <span>{o.label}</span>
                {isSelected && <Check className="size-4 shrink-0" aria-hidden />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

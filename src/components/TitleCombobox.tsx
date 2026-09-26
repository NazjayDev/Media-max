"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import type { SearchSuggestion } from "@/types/media";

const SUGGEST_DELAY_MS = 220;

interface TitleComboboxProps {
  value: string;
  onChange: (value: string) => void;
  /** Called with the exact title the person picked from the list. */
  onPick: (title: SearchSuggestion) => void;
  /** When set, Enter with nothing highlighted hands the typed text here instead of submitting. */
  onEnterText?: (text: string) => void;
  /** Set false to hide suggestions entirely, for example in vibe mode. */
  enabled?: boolean;
  disabled?: boolean;
  placeholder: string;
  ariaLabel: string;
  maxLength?: number;
  className: string;
  /** Decorative element shown inside the left edge of the input, such as a search icon. */
  leading?: React.ReactNode;
}

/** Text input with search-as-you-type movie/TV suggestions and full keyboard support. */
export default function TitleCombobox({
  value,
  onChange,
  onPick,
  onEnterText,
  enabled = true,
  disabled = false,
  placeholder,
  ariaLabel,
  maxLength,
  className,
  leading,
}: TitleComboboxProps) {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const lastPicked = useRef("");
  const listId = useId();

  // Older requests are cancelled so a slow reply can never overwrite a newer one.
  useEffect(() => {
    const query = value.trim();
    if (!enabled || query.length < 2 || query === lastPicked.current) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/suggest?query=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { results: [] }))
        .then((data: { results?: SearchSuggestion[] }) => {
          setSuggestions(data.results ?? []);
          setActive(-1);
        })
        .catch(() => {});
    }, SUGGEST_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, enabled]);

  const showList =
    open && enabled && value.trim().length >= 2 && suggestions.length > 0 && !disabled;

  function choose(title: SearchSuggestion) {
    lastPicked.current = title.title.trim();
    setOpen(false);
    setSuggestions([]);
    onPick(title);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !(showList && active >= 0) && onEnterText) {
      e.preventDefault();
      if (value.trim()) onEnterText(value.trim());
      return;
    }
    if (!showList) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      // -1 means "nothing highlighted", so the list cycles through the options and back to the input.
      setActive((i) => {
        const next = i + step;
        return next < -1 ? suggestions.length - 1 : next >= suggestions.length ? -1 : next;
      });
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative min-w-0 flex-1">
      {leading && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted"
        >
          {leading}
        </span>
      )}
      <input
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        className={className}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching titles"
          className="absolute inset-x-0 top-full z-30 mt-2 max-h-96 overflow-y-auto rounded-2xl border border-border bg-surface p-1.5 text-left shadow-xl"
        >
          {suggestions.map((s, i) => (
            <li
              key={`${s.mediaType}:${s.id}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // Keep focus in the input so blur doesn't close the list before the click lands.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(s)}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 ${
                i === active ? "bg-accent-from/15" : ""
              }`}
            >
              <span className="relative h-12 w-8 shrink-0 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
                {s.posterPath && (
                  <Image src={s.posterPath} alt="" fill sizes="32px" className="object-cover" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{s.title}</span>
                <span className="block text-xs text-muted">
                  {s.mediaType === "tv" ? "TV" : "Movie"}
                  {s.year ? ` · ${s.year}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

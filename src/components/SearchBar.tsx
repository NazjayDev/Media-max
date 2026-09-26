"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import MicButton from "@/components/MicButton";
import type { SearchSuggestion } from "@/types/media";

export type SearchMode = "title" | "vibe";

interface SearchBarProps {
  onSearch: (query: string, viaVoice?: boolean) => void;
  /** Called when the person picks an exact title from the suggestions dropdown. */
  onSelect: (title: SearchSuggestion) => void;
  disabled: boolean;
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
}

const MODES: { value: SearchMode; label: string }[] = [
  { value: "title", label: "By title" },
  { value: "vibe", label: "By vibe" },
];

const SUGGEST_DELAY_MS = 220;

export default function SearchBar({
  onSearch,
  onSelect,
  disabled,
  mode,
  onModeChange,
}: SearchBarProps) {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const skipNext = useRef(false);
  const listId = useId();

  // Search-as-you-type suggestions, only in title mode. Older requests are cancelled.
  useEffect(() => {
    const query = value.trim();
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    if (mode !== "title" || query.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/suggest?query=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { results: [] }))
        .then((data: { results?: SearchSuggestion[] }) => {
          setSuggestions(data.results ?? []);
          setActive(-1);
          setOpen(true);
        })
        .catch(() => {});
    }, SUGGEST_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, mode]);

  const showList =
    open && mode === "title" && value.trim().length >= 2 && suggestions.length > 0 && !disabled;

  function choose(title: SearchSuggestion) {
    skipNext.current = true;
    setValue(title.title);
    setOpen(false);
    setSuggestions([]);
    onSelect(title);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showList) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      // -1 means "nothing highlighted", so the list cycles through the options and back to the input.
      setActive((i) => {
        const next = i + step;
        return next < -1 ? suggestions.length - 1 : next >= suggestions.length ? -1 : next;
      });
    } else if (e.key === "Enter" && active >= 0 && active < suggestions.length) {
      e.preventDefault();
      choose(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      setOpen(false);
      onSearch(trimmed);
    }
  }

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4">
      <div
        role="tablist"
        aria-label="Search mode"
        className="inline-flex rounded-full border border-border bg-surface p-1 text-sm"
      >
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="tab"
            aria-selected={mode === m.value}
            onClick={() => onModeChange(m.value)}
            className={`rounded-full px-4 py-1.5 font-medium transition ${
              mode === m.value
                ? "bg-gradient-to-r from-accent-from to-accent-to text-white shadow"
                : "text-muted hover:text-foreground"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:gap-2"
      >
        <div className="relative min-w-0 flex-1">
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
              setValue(e.target.value);
              setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            maxLength={mode === "vibe" ? 300 : 120}
            placeholder={
              mode === "vibe"
                ? "Describe a vibe, e.g. cozy rainy-day sci-fi with heart..."
                : "Enter a movie, show, or anime title..."
            }
            aria-label={mode === "vibe" ? "Vibe to search for" : "Title to search for"}
            disabled={disabled}
            className="w-full rounded-full border border-border bg-surface px-5 py-3 text-base text-foreground shadow-sm outline-none transition focus:border-accent-from focus:ring-4 focus:ring-accent-from/20 disabled:opacity-60"
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
        <div className="flex justify-center sm:block">
          <MicButton
            disabled={disabled}
            onTranscript={(text) => {
              const cleaned = text.replace(/[.!?]+$/, "").trim();
              skipNext.current = true;
              setValue(cleaned);
              onSearch(cleaned, true);
            }}
          />
        </div>
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="rounded-full bg-gradient-to-r from-accent-from to-accent-to px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-accent-from/25 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {disabled ? "Searching..." : "Search"}
        </button>
      </form>
    </div>
  );
}

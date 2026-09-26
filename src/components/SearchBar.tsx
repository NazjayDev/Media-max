"use client";

import { useState } from "react";
import MicButton from "@/components/MicButton";
import TitleCombobox from "@/components/TitleCombobox";
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

export default function SearchBar({
  onSearch,
  onSelect,
  disabled,
  mode,
  onModeChange,
}: SearchBarProps) {
  const [value, setValue] = useState("");
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
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
        <TitleCombobox
          value={value}
          onChange={setValue}
          onPick={(title) => {
            setValue(title.title);
            onSelect(title);
          }}
          enabled={mode === "title"}
          disabled={disabled}
          maxLength={mode === "vibe" ? 300 : 120}
          placeholder={
            mode === "vibe"
              ? "Describe a vibe, e.g. cozy rainy-day sci-fi with heart..."
              : "Enter a movie, show, or anime title..."
          }
          ariaLabel={mode === "vibe" ? "Vibe to search for" : "Title to search for"}
          leading={
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" strokeLinecap="round" />
            </svg>
          }
          className="w-full rounded-full border border-border bg-surface py-3 pl-12 pr-5 text-base text-foreground shadow-sm outline-none transition focus:border-accent-from focus:ring-4 focus:ring-accent-from/20 disabled:opacity-60"
        />
        <div className="flex justify-center sm:block">
          <MicButton
            disabled={disabled}
            onTranscript={(text) => {
              const cleaned = text.replace(/[.!?]+$/, "").trim();
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

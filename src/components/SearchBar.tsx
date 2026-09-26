"use client";

import { useState } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  disabled: boolean;
}

export default function SearchBar({ onSearch, disabled }: SearchBarProps) {
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      onSearch(trimmed);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:gap-2"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter a movie, show, or anime title..."
        aria-label="Title to search for"
        disabled={disabled}
        className="min-w-0 flex-1 rounded-full border border-border bg-surface px-5 py-3.5 text-base text-foreground shadow-sm outline-none transition focus:border-accent-from focus:ring-4 focus:ring-accent-from/20 disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="rounded-full bg-gradient-to-r from-accent-from to-accent-to px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-accent-from/25 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
      >
        {disabled ? "Searching..." : "Search"}
      </button>
    </form>
  );
}

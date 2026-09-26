"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { MediaType } from "@/types/media";

export type Recent =
  | {
      kind: "title";
      mediaType: MediaType;
      id: number;
      title: string;
      posterPath: string | null;
      year?: number | null;
    }
  | { kind: "vibe"; text: string };

const STORAGE_KEY = "mm-recent-v1";
const MAX_RECENT = 8;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
};

function readRaw(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function parse(raw: string): Recent[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter((r): r is Recent => r?.kind === "title" || r?.kind === "vibe")
      : [];
  } catch {
    return [];
  }
}

function write(list: Recent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    // Storage can be blocked in private windows; recent searches just aren't kept.
  }
  listeners.forEach((l) => l());
}

const sameSearch = (a: Recent, b: Recent) =>
  a.kind === "title" && b.kind === "title"
    ? a.mediaType === b.mediaType && a.id === b.id
    : a.kind === "vibe" && b.kind === "vibe" && a.text.toLowerCase() === b.text.toLowerCase();

/** Remembers a search on this device, newest first, without duplicates. */
export function addRecentSearch(search: Recent) {
  write([search, ...parse(readRaw()).filter((r) => !sameSearch(r, search))]);
}

/** The person's last few searches, kept on this device. */
export function useRecentSearches() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "");
  const recents = useMemo(() => parse(raw), [raw]);
  const clear = useCallback(() => write([]), []);
  return { recents, clear };
}

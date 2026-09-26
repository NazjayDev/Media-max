"use client";

import { useSyncExternalStore } from "react";
import type { Recommendation, SearchResult } from "@/types/media";

/** Everything needed to put the home page back exactly as it was after a search. */
export interface LastSearch {
  mode: "title" | "vibe";
  matched: SearchResult | null;
  vibe: string;
  recommendations: Recommendation[];
  noMore: boolean;
}

/** Fired when someone clicks the logo while already on the home page, to return to the start screen. */
export const RESET_HOME_EVENT = "mm-reset-home";

const KEY = "mm-last-search-v1";
const SCROLL_KEY = "mm-last-scroll-v1";

/** Saves the current results for this browser tab, so coming back from a title page restores them. */
export function saveLastSearch(search: LastSearch) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(search));
  } catch {
    // Storage full or blocked: going back just shows a fresh home page.
  }
}

export function loadLastSearch(): { search: LastSearch; scrollY: number } | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const search = JSON.parse(raw) as LastSearch;
    if (!Array.isArray(search.recommendations) || search.recommendations.length === 0) return null;
    return { search, scrollY: Number(sessionStorage.getItem(SCROLL_KEY)) || 0 };
  } catch {
    return null;
  }
}

export function saveScroll(y: number) {
  try {
    sessionStorage.setItem(SCROLL_KEY, String(Math.round(y)));
  } catch {
    // Not worth reporting.
  }
}

/** Forgets the saved search, for example when someone clicks the logo to start over. */
export function clearLastSearch() {
  try {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(SCROLL_KEY);
  } catch {
    // Not worth reporting.
  }
}

/** True when there are saved results to go back to. */
export function useHasLastSearch(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => loadLastSearch() !== null,
    () => false,
  );
}

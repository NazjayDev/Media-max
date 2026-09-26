"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useWatchlist } from "@/components/Providers";
import type { Recommendation, WatchStatus } from "@/types/media";

const STORAGE_KEY = "mm-seen-v1";
const listeners = new Set<() => void>();

const keyOf = (item: Pick<Recommendation, "mediaType" | "id">) => `${item.mediaType}:${item.id}`;

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

function writeLocal(keys: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys.slice(-500)));
  } catch {
    // Private windows can block storage; the title just reappears next visit.
  }
  listeners.forEach((l) => l());
}

function parse(raw: string): string[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Titles the person has already watched, so recommendations can leave them out. Signed-in people
 * get it from their dashboard (and marking one adds it there as Watched); everyone else gets it
 * from a list kept on this device, so it works without an account.
 */
export function useSeen() {
  const { items, signedIn, toggle, setStatus } = useWatchlist();
  const raw = useSyncExternalStore(subscribe, readRaw, () => "");
  const local = useMemo(() => parse(raw), [raw]);

  const seen = useMemo(
    () => new Set([...items.filter((i) => i.status === "watched").map(keyOf), ...local]),
    [items, local],
  );

  // Undo runs later, so it needs the latest versions of these rather than the ones from click time.
  const latest = useRef({ items, toggle, setStatus, local });
  useEffect(() => {
    latest.current = { items, toggle, setStatus, local };
  });

  /** Marks a title as watched. Returns a function that puts things back the way they were. */
  const markSeen = useCallback(
    async (item: Recommendation): Promise<() => void> => {
      const key = keyOf(item);
      if (!signedIn) {
        writeLocal([...latest.current.local.filter((k) => k !== key), key]);
        return () => writeLocal(latest.current.local.filter((k) => k !== key));
      }

      const before = latest.current.items.find((i) => keyOf(i) === key);
      if (before) {
        await latest.current.setStatus(item, "watched");
        return () => void latest.current.setStatus(item, before.status as WatchStatus);
      }
      await latest.current.toggle(item); // adds it to the dashboard
      await latest.current.setStatus(item, "watched");
      return () => void latest.current.toggle(item); // removes it again
    },
    [signedIn],
  );

  return { seen, markSeen, signedIn };
}

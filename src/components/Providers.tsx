"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SessionProvider, signIn, useSession } from "next-auth/react";
import type { Recommendation, WatchStatus, WatchlistEntry } from "@/types/media";

interface WatchlistContextValue {
  items: WatchlistEntry[];
  loading: boolean;
  signedIn: boolean;
  isSaved: (item: Recommendation) => boolean;
  toggle: (item: Recommendation) => Promise<void>;
  setStatus: (item: Recommendation, status: WatchStatus) => Promise<void>;
  setRating: (item: Recommendation, rating: number | null) => Promise<void>;
  setFavorite: (item: Recommendation, favorite: boolean) => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function useWatchlist() {
  const ctx = useContext(WatchlistContext);
  if (!ctx) {
    throw new Error("useWatchlist must be used inside <Providers>");
  }
  return ctx;
}

const freshEntry = (item: Recommendation): WatchlistEntry => ({
  ...item,
  status: "want",
  userRating: null,
  favorite: false,
  statusUpdatedAt: new Date().toISOString(),
});

const keyOf = (item: Pick<Recommendation, "mediaType" | "id">) => `${item.mediaType}:${item.id}`;

function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const [fetchedItems, setItems] = useState<WatchlistEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const loading = signedIn && !loaded;
  const items = useMemo(() => (signedIn ? fetchedItems : []), [signedIn, fetchedItems]);

  useEffect(() => {
    if (!signedIn) {
      return;
    }
    let cancelled = false;
    fetch("/api/watchlist")
      .then((res) => (res.ok ? res.json() : { results: [] }))
      .then((data) => {
        if (!cancelled) setItems(data.results ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const saved = useMemo(() => new Set(items.map(keyOf)), [items]);

  const isSaved = useCallback((item: Recommendation) => saved.has(keyOf(item)), [saved]);

  const toggle = useCallback(
    async (item: Recommendation) => {
      if (!signedIn) {
        await signIn("google");
        return;
      }

      const alreadySaved = saved.has(keyOf(item));
      // Optimistic update, rolled back if the request fails.
      setItems((prev) =>
        alreadySaved
          ? prev.filter((i) => keyOf(i) !== keyOf(item))
          : [freshEntry(item), ...prev]
      );

      try {
        const res = alreadySaved
          ? await fetch(`/api/watchlist?mediaType=${item.mediaType}&id=${item.id}`, {
              method: "DELETE",
            })
          : await fetch("/api/watchlist", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(item),
            });
        if (!res.ok) throw new Error("request failed");
      } catch {
        setItems((prev) =>
          alreadySaved
            ? [freshEntry(item), ...prev]
            : prev.filter((i) => keyOf(i) !== keyOf(item))
        );
      }
    },
    [signedIn, saved]
  );

  const patch = useCallback(
    async (
      item: Recommendation,
      change: { status?: WatchStatus; userRating?: number | null; favorite?: boolean }
    ) => {
      const before = items;
      setItems((prev) =>
        prev.map((i) =>
          keyOf(i) === keyOf(item)
            ? {
                ...i,
                ...change,
                ...(change.status ? { statusUpdatedAt: new Date().toISOString() } : {}),
              }
            : i
        )
      );
      try {
        const res = await fetch("/api/watchlist", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaType: item.mediaType, id: item.id, ...change }),
        });
        if (!res.ok) throw new Error("request failed");
      } catch {
        setItems(before);
      }
    },
    [items]
  );

  const setStatus = useCallback(
    (item: Recommendation, status: WatchStatus) => patch(item, { status }),
    [patch]
  );
  const setRating = useCallback(
    (item: Recommendation, userRating: number | null) => patch(item, { userRating }),
    [patch]
  );

  const setFavorite = useCallback(
    (item: Recommendation, favorite: boolean) => patch(item, { favorite }),
    [patch]
  );

  const value = useMemo(
    () => ({ items, loading, signedIn, isSaved, toggle, setStatus, setRating, setFavorite }),
    [items, loading, signedIn, isSaved, toggle, setStatus, setRating, setFavorite]
  );

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <WatchlistProvider>{children}</WatchlistProvider>
    </SessionProvider>
  );
}

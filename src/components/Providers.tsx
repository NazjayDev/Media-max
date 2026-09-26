"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SessionProvider, signIn, useSession } from "next-auth/react";
import type { Recommendation } from "@/types/media";

interface WatchlistContextValue {
  items: Recommendation[];
  loading: boolean;
  signedIn: boolean;
  isSaved: (item: Recommendation) => boolean;
  toggle: (item: Recommendation) => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function useWatchlist() {
  const ctx = useContext(WatchlistContext);
  if (!ctx) {
    throw new Error("useWatchlist must be used inside <Providers>");
  }
  return ctx;
}

const keyOf = (item: Pick<Recommendation, "mediaType" | "id">) => `${item.mediaType}:${item.id}`;

function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const [fetchedItems, setItems] = useState<Recommendation[]>([]);
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
        alreadySaved ? prev.filter((i) => keyOf(i) !== keyOf(item)) : [item, ...prev]
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
          alreadySaved ? [item, ...prev] : prev.filter((i) => keyOf(i) !== keyOf(item))
        );
      }
    },
    [signedIn, saved]
  );

  const value = useMemo(
    () => ({ items, loading, signedIn, isSaved, toggle }),
    [items, loading, signedIn, isSaved, toggle]
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

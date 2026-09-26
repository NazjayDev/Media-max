"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { useWatchlist } from "@/components/Providers";
import RecommendationCard from "@/components/RecommendationCard";
import SkeletonCard from "@/components/SkeletonCard";
import WatchControls from "@/components/WatchControls";
import type { Recommendation, WatchStatus } from "@/types/media";

type Filter = "all" | WatchStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "want", label: "Want to watch" },
  { value: "watching", label: "Watching" },
  { value: "watched", label: "Watched" },
];

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5";

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-6 py-8 text-center">{children}</div>
  );
}

export default function WatchlistPage() {
  const { status } = useSession();
  const { items, loading } = useWatchlist();
  const [filter, setFilter] = useState<Filter>("all");

  const [picks, setPicks] = useState<Recommendation[] | null>(null);
  const [picksFailed, setPicksFailed] = useState(false);
  const [picksBasedOn, setPicksBasedOn] = useState(0);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const hasItems = status === "authenticated" && !loading && items.length > 0;
  const picksLoading = hasItems && picks === null && !picksFailed;

  useEffect(() => {
    if (!hasItems) return;
    let cancelled = false;
    fetch("/api/watchlist/picks")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("picks failed"))))
      .then((data) => {
        if (cancelled) return;
        setPicks(data.results ?? []);
        setPicksBasedOn(data.basedOn ?? 0);
      })
      .catch(() => {
        if (!cancelled) setPicksFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [hasItems, refreshNonce]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: items.length, want: 0, watching: 0, watched: 0 };
    for (const i of items) c[i.status]++;
    return c;
  }, [items]);

  const visible = filter === "all" ? items : items.filter((i) => i.status === filter);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-16 pt-24 sm:px-8">
      <h1 className="bg-gradient-to-r from-accent-from to-accent-to bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
        My watchlist
      </h1>

      <div className="mt-8" aria-live="polite">
        {status === "loading" || loading ? (
          <div className={GRID}>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : status === "unauthenticated" ? (
          <Panel>
            <p className="text-muted">Sign in to see the titles you&apos;ve saved.</p>
            <button
              type="button"
              onClick={() => signIn("google")}
              className="mt-4 rounded-full bg-gradient-to-r from-accent-from to-accent-to px-6 py-2.5 font-semibold text-white"
            >
              Sign in with Google
            </button>
          </Panel>
        ) : items.length === 0 ? (
          <Panel>
            <p className="text-muted">Nothing saved yet. Tap the bookmark on any recommendation.</p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-full border border-border px-6 py-2.5 font-medium hover:border-accent-from"
            >
              Find something to watch
            </Link>
          </Panel>
        ) : (
          <>
            <div role="tablist" aria-label="Filter by status" className="mb-6 flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.value}
                  onClick={() => setFilter(f.value)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    filter === f.value
                      ? "bg-gradient-to-r from-accent-from to-accent-to text-white shadow"
                      : "border border-border bg-surface text-muted hover:text-foreground"
                  }`}
                >
                  {f.label} <span className="opacity-70">({counts[f.value]})</span>
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <Panel>
                <p className="text-muted">Nothing here yet. Change a title&apos;s status to move it.</p>
              </Panel>
            ) : (
              <div className={GRID}>
                {visible.map((entry, i) => (
                  <RecommendationCard
                    key={`${entry.mediaType}:${entry.id}`}
                    item={entry}
                    index={i}
                    footer={<WatchControls entry={entry} />}
                  />
                ))}
              </div>
            )}

            <section className="mt-14" aria-labelledby="picks-heading">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id="picks-heading" className="text-xl font-bold">
                    Picked for you
                  </h2>
                  <p className="text-sm text-muted">
                    {picksBasedOn > 0
                      ? `Based on ${picksBasedOn} of your saved titles, favoring the ones you rated highly.`
                      : "Based on your saved titles."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPicks(null);
                    setPicksFailed(false);
                    setRefreshNonce((n) => n + 1);
                  }}
                  disabled={picksLoading}
                  className="rounded-full border border-border px-4 py-1.5 text-sm font-medium transition hover:border-accent-from disabled:opacity-50"
                >
                  Refresh picks
                </button>
              </div>

              {picksLoading ? (
                <div className={GRID}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : picksFailed ? (
                <Panel>
                  <p className="text-muted">Couldn&apos;t build picks right now. Try again in a moment.</p>
                </Panel>
              ) : picks && picks.length > 0 ? (
                <div className={GRID}>
                  {picks.map((item, i) => (
                    <RecommendationCard key={`${item.mediaType}:${item.id}`} item={item} index={i} />
                  ))}
                </div>
              ) : (
                <Panel>
                  <p className="text-muted">
                    Save a few more well-known titles and we&apos;ll find your next watch.
                  </p>
                </Panel>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

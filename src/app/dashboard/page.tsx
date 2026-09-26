"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import ContinueWatching from "@/components/dashboard/ContinueWatching";
import { Panel, Row, RowCard, SkeletonRow } from "@/components/dashboard/Row";
import { groupWatchlist } from "@/components/dashboard/sections";
import LetterboxdImport from "@/components/dashboard/LetterboxdImport";
import StatsStrip from "@/components/dashboard/StatsStrip";
import { useWatchlist } from "@/components/Providers";
import SkeletonCard from "@/components/SkeletonCard";
import WatchControls from "@/components/WatchControls";
import { useJson } from "@/lib/useJson";
import type { Recommendation, WatchlistEntry } from "@/types/media";

interface BecauseRow {
  basedOn: { mediaType: string; id: number; title: string };
  results: Recommendation[];
}

const withControls = (entries: WatchlistEntry[]) =>
  entries.map((entry, i) => (
    <RowCard
      key={`${entry.mediaType}:${entry.id}`}
      item={entry}
      index={i}
      footer={<WatchControls entry={entry} />}
    />
  ));

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const { items, loading, reload } = useWatchlist();
  const isDemo = !!session?.user?.demo;

  const [refreshKey, setRefreshKey] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState("");
  const autoSeeded = useRef(false);

  const hasItems = status === "authenticated" && !loading && items.length > 0;
  const hasWatched = hasItems && items.some((i) => i.status === "watched");
  const because = useJson<{ rows: BecauseRow[] }>(
    hasWatched ? "/api/watchlist/because" : null,
    refreshKey,
  );
  const picks = useJson<{ results: Recommendation[]; basedOn: number }>(
    hasItems ? "/api/watchlist/picks" : null,
    refreshKey,
  );
  const sections = useMemo(() => groupWatchlist(items), [items]);

  function onImported() {
    reload();
    setRefreshKey((k) => k + 1);
  }

  async function runSeed() {
    setSeeding(true);
    setSeedError("");
    try {
      const res = await fetch("/api/demo/seed", { method: "POST" });
      if (!res.ok) {
        setSeedError(
          (await res.json().catch(() => ({}))).error ?? "Couldn't prepare the demo account.",
        );
        return;
      }
      setRefreshKey((k) => k + 1);
      reload();
    } catch {
      setSeedError("Network error. Try again.");
    } finally {
      setSeeding(false);
    }
  }

  // A brand-new demo account fills itself in the first time the dashboard opens.
  useEffect(() => {
    if (
      isDemo &&
      status === "authenticated" &&
      !loading &&
      items.length === 0 &&
      !autoSeeded.current
    ) {
      autoSeeded.current = true;
      void runSeed();
    }
    // runSeed only uses stable setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, status, loading, items.length]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-16 pt-24 sm:px-8">
      <Link href="/" className="mb-4 text-sm text-muted hover:text-foreground">
        &larr; Back to home
      </Link>
      <h1 className="bg-gradient-to-r from-accent-from to-accent-to bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
        My dashboard
      </h1>

      <div aria-live="polite" className="mt-2">
        {status === "loading" || loading ? (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : status === "unauthenticated" ? (
          <div className="mt-8">
            <Panel>
              <p>Sign in to see your dashboard.</p>
              <button
                type="button"
                onClick={() => signIn("google")}
                className="mt-4 rounded-full bg-gradient-to-r from-accent-from to-accent-to px-6 py-2.5 font-semibold text-white"
              >
                Sign in with Google
              </button>
            </Panel>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8">
            <Panel>
              {seeding || isDemo ? (
                <>
                  <p>
                    {seedError || "Setting up your demo dashboard with sample viewing history..."}
                  </p>
                  {seedError && (
                    <button
                      type="button"
                      onClick={runSeed}
                      className="mt-4 rounded-full border border-border px-6 py-2.5 font-medium text-foreground hover:border-accent-from"
                    >
                      Try again
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p>
                    Nothing saved yet. Tap the bookmark on any recommendation to start your
                    dashboard.
                  </p>
                  <Link
                    href="/"
                    className="mt-4 inline-block rounded-full border border-border px-6 py-2.5 font-medium text-foreground hover:border-accent-from"
                  >
                    Find something to watch
                  </Link>
                  <div className="mt-4 text-left">
                    <LetterboxdImport onDone={onImported} />
                  </div>
                </>
              )}
            </Panel>
          </div>
        ) : (
          <>
            {isDemo && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                <span>
                  Demo account: preloaded with sample viewing history for the presentation.
                </span>
                <button
                  type="button"
                  disabled={seeding}
                  onClick={() => {
                    if (window.confirm("Reset this demo account to its original sample data?"))
                      void runSeed();
                  }}
                  className="rounded-full border border-amber-500/60 px-3 py-1 text-xs font-semibold hover:bg-amber-500/20 disabled:opacity-50"
                >
                  {seeding ? "Resetting..." : "Reset demo data"}
                </button>
              </div>
            )}

            <StatsStrip items={items} />
            {!isDemo && <LetterboxdImport onDone={onImported} />}
            {sections.watching[0] && <ContinueWatching entry={sections.watching[0]} />}

            <Row
              id="watching"
              title="Watching"
              count={sections.watching.length}
              emptyText="Nothing in progress. Mark a title as Watching to see it here."
            >
              {withControls(sections.watching)}
            </Row>
            <Row
              id="want"
              title="Want to watch"
              count={sections.want.length}
              emptyText="Your queue is empty. Save titles from search results."
            >
              {withControls(sections.want)}
            </Row>
            <Row
              id="watched"
              title="Watched"
              count={sections.watched.length}
              emptyText="Nothing marked as watched yet."
            >
              {withControls(sections.watched)}
            </Row>
            <Row
              id="favorites"
              title="Favorites"
              subtitle="Titles you've hearted."
              count={sections.favorites.length}
              emptyText="Tap the heart on any saved title to add it to your favorites."
            >
              {withControls(sections.favorites)}
            </Row>
            <Row
              id="toprated"
              title="Your top rated"
              subtitle="Anything you rate 4 stars or higher lands here automatically."
              count={sections.topRated.length}
              emptyText="Rate a watched title 4 stars or more and it will show up here."
            >
              {withControls(sections.topRated)}
            </Row>

            {because.loading && <SkeletonRow title="Because you watched..." />}
            {because.failed && (
              <div className="mt-10">
                <Panel>
                  Couldn&apos;t load recommendations from your recent watches. Try again in a
                  moment.
                </Panel>
              </div>
            )}
            {because.data?.rows.map((row, r) => (
              <Row
                key={`${row.basedOn.mediaType}:${row.basedOn.id}`}
                id={`because-${r}`}
                title={`Because you watched ${row.basedOn.title}`}
              >
                {row.results.map((rec, i) => (
                  <RowCard key={`${rec.mediaType}:${rec.id}`} item={rec} index={i} />
                ))}
              </Row>
            ))}

            {picks.loading ? (
              <SkeletonRow title="Picked for you" />
            ) : (
              <Row
                id="picks"
                title="Picked for you"
                subtitle={
                  picks.data && picks.data.basedOn > 0
                    ? `Based on ${picks.data.basedOn} of your saved titles, favoring the ones you rated highly.`
                    : "Based on your saved titles."
                }
                action={
                  <button
                    type="button"
                    onClick={() => setRefreshKey((k) => k + 1)}
                    className="rounded-full border border-border px-4 py-1.5 text-sm font-medium transition hover:border-accent-from"
                  >
                    Refresh picks
                  </button>
                }
                count={picks.data?.results.length ? undefined : 0}
                emptyText={
                  picks.failed
                    ? "Couldn't build picks right now. Try again in a moment."
                    : "Save a few more well-known titles and we'll find your next watch."
                }
              >
                {picks.data?.results.map((item, i) => (
                  <RowCard key={`${item.mediaType}:${item.id}`} item={item} index={i} />
                ))}
              </Row>
            )}
          </>
        )}
      </div>
    </div>
  );
}

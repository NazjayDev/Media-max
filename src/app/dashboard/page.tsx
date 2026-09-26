"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { useWatchlist } from "@/components/Providers";
import RecommendationCard from "@/components/RecommendationCard";
import SkeletonCard from "@/components/SkeletonCard";
import WatchControls from "@/components/WatchControls";
import type { Recommendation, WatchlistEntry } from "@/types/media";

const TOP_RATED_MIN = 4;

interface BecauseRow {
  basedOn: { mediaType: string; id: number; title: string };
  results: Recommendation[];
}

const byRecent = (a: WatchlistEntry, b: WatchlistEntry) =>
  new Date(b.statusUpdatedAt ?? 0).getTime() -
  new Date(a.statusUpdatedAt ?? 0).getTime();

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-6 py-6 text-center text-sm text-muted">
      {children}
    </div>
  );
}

function Row({
  id,
  title,
  subtitle,
  count,
  emptyText,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  count?: number;
  emptyText?: string;
  children?: React.ReactNode;
}) {
  const empty = count === 0;
  return (
    <section className="mt-10" aria-labelledby={`${id}-heading`}>
      <div className="mb-3">
        <h2 id={`${id}-heading`} className="text-xl font-bold">
          {title}
          {count !== undefined && (
            <span className="ml-2 text-base font-normal text-muted">
              ({count})
            </span>
          )}
        </h2>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {empty ? (
        <Panel>{emptyText}</Panel>
      ) : (
        <div className="scroll-row -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:-mx-0 sm:gap-4 sm:px-0">
          {children}
        </div>
      )}
    </section>
  );
}

function RowCard({
  item,
  index,
  footer,
}: {
  item: Recommendation;
  index: number;
  footer?: React.ReactNode;
}) {
  return (
    <div className="w-44 shrink-0 snap-start sm:w-52">
      <RecommendationCard item={item} index={index} footer={footer} />
    </div>
  );
}

function StatsStrip({ items }: { items: WatchlistEntry[] }) {
  const stats = useMemo(() => {
    const ratings = items
      .map((i) => i.userRating)
      .filter((r): r is number => r !== null);
    const genreCounts = new Map<string, number>();
    for (const i of items)
      for (const g of i.genres ?? [])
        genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    return {
      saved: items.length,
      watched: items.filter((i) => i.status === "watched").length,
      avg: ratings.length
        ? Math.round(
            (ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10,
          ) / 10
        : null,
      genres: [...genreCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([g]) => g),
    };
  }, [items]);

  const tiles: { label: string; value: string }[] = [
    { label: "Saved", value: String(stats.saved) },
    { label: "Watched", value: String(stats.watched) },
    {
      label: "Avg rating you give",
      value: stats.avg === null ? "n/a" : `${stats.avg} / 5`,
    },
    {
      label: "Top genres",
      value: stats.genres.length ? stats.genres.join(", ") : "n/a",
    },
  ];

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-xl border border-border bg-surface px-4 py-3"
        >
          <p className="text-[11px] uppercase tracking-wide text-muted">
            {t.label}
          </p>
          <p className="mt-1 truncate text-lg font-bold" title={t.value}>
            {t.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function ContinueWatching({ entry }: { entry: WatchlistEntry }) {
  const { setStatus } = useWatchlist();
  return (
    <section
      className="mt-8 overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-accent-from/10 to-accent-to/10"
      aria-labelledby="continue-heading"
    >
      <div className="flex gap-4 p-4 sm:gap-6 sm:p-5">
        <Link
          href={`/title/${entry.mediaType}/${entry.id}`}
          className="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800 sm:w-32"
        >
          {entry.posterPath && (
            <Image
              src={entry.posterPath}
              alt={entry.title}
              fill
              sizes="128px"
              className="object-cover"
            />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-from dark:text-violet-300">
            Continue watching
          </p>
          <h2
            id="continue-heading"
            className="mt-1 text-xl font-extrabold sm:text-2xl"
          >
            <Link
              href={`/title/${entry.mediaType}/${entry.id}`}
              className="hover:underline"
            >
              {entry.title}
            </Link>
          </h2>
          <p className="mt-2 line-clamp-3 text-sm text-muted">
            {entry.blurb || entry.synopsis}
          </p>
          {entry.streamingProviders.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.streamingProviders
                .slice(0, 5)
                .map((p) =>
                  p.logoPath ? (
                    <Image
                      key={p.id}
                      src={p.logoPath}
                      alt={p.name}
                      title={p.name}
                      width={28}
                      height={28}
                      className="rounded-md ring-1 ring-border"
                    />
                  ) : null,
                )}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatus(entry, "watched")}
              className="rounded-full bg-gradient-to-r from-accent-from to-accent-to px-4 py-2 text-sm font-semibold text-white"
            >
              Mark as watched
            </button>
            <Link
              href={`/title/${entry.mediaType}/${entry.id}`}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-accent-from"
            >
              Join the discussion
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const { status } = useSession();
  const { items, loading } = useWatchlist();

  const [because, setBecause] = useState<BecauseRow[] | null>(null);
  const [becauseFailed, setBecauseFailed] = useState(false);

  const [picks, setPicks] = useState<Recommendation[] | null>(null);
  const [picksFailed, setPicksFailed] = useState(false);
  const [picksBasedOn, setPicksBasedOn] = useState(0);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const hasItems = status === "authenticated" && !loading && items.length > 0;
  const hasWatched = hasItems && items.some((i) => i.status === "watched");
  const picksLoading = hasItems && picks === null && !picksFailed;
  const becauseLoading = hasWatched && because === null && !becauseFailed;

  useEffect(() => {
    if (!hasWatched) return;
    let cancelled = false;
    fetch("/api/watchlist/because")
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("because failed")),
      )
      .then((data) => {
        if (!cancelled) setBecause(data.rows ?? []);
      })
      .catch(() => {
        if (!cancelled) setBecauseFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [hasWatched, refreshNonce]);

  useEffect(() => {
    if (!hasItems) return;
    let cancelled = false;
    fetch("/api/watchlist/picks")
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("picks failed")),
      )
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

  const sections = useMemo(() => {
    const watching = items
      .filter((i) => i.status === "watching")
      .sort(byRecent);
    const want = items
      .filter((i) => i.status === "want")
      .sort(
        (a, b) =>
          new Date(b.addedAt ?? 0).getTime() -
          new Date(a.addedAt ?? 0).getTime(),
      );
    const watched = items.filter((i) => i.status === "watched").sort(byRecent);
    const favorites = items.filter((i) => i.favorite);
    const topRated = items
      .filter((i) => (i.userRating ?? 0) >= TOP_RATED_MIN)
      .sort(
        (a, b) => (b.userRating ?? 0) - (a.userRating ?? 0) || byRecent(a, b),
      );
    return { watching, want, watched, favorites, topRated };
  }, [items]);

  const withControls = (entries: WatchlistEntry[]) =>
    entries.map((entry, i) => (
      <RowCard
        key={`${entry.mediaType}:${entry.id}`}
        item={entry}
        index={i}
        footer={<WatchControls entry={entry} />}
      />
    ));

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-16 pt-24 sm:px-8">
      <Link href="/" className="mb-4 text-sm text-muted hover:text-foreground">
        &larr; Back to home
      </Link>
      <h1 className="bg-gradient-to-r from-accent-from to-accent-to bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
        My dashboard
      </h1>

      <div aria-live="polite">
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
              <p>
                Nothing saved yet. Tap the bookmark on any recommendation to
                start your dashboard.
              </p>
              <Link
                href="/"
                className="mt-4 inline-block rounded-full border border-border px-6 py-2.5 font-medium text-foreground hover:border-accent-from"
              >
                Find something to watch
              </Link>
            </Panel>
          </div>
        ) : (
          <>
            <StatsStrip items={items} />

            {sections.watching[0] && (
              <ContinueWatching entry={sections.watching[0]} />
            )}

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

            {hasWatched && (
              <>
                {becauseLoading && (
                  <section
                    className="mt-10"
                    aria-label="Recommendations based on what you watched"
                  >
                    <h2 className="mb-3 text-xl font-bold">
                      Because you watched...
                    </h2>
                    <div className="flex gap-3 overflow-hidden">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="w-40 shrink-0 sm:w-44">
                          <SkeletonCard />
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {because?.map((row, r) => (
                  <Row
                    key={`${row.basedOn.mediaType}:${row.basedOn.id}`}
                    id={`because-${r}`}
                    title={`Because you watched ${row.basedOn.title}`}
                  >
                    {row.results.map((rec, i) => (
                      <RowCard
                        key={`${rec.mediaType}:${rec.id}`}
                        item={rec}
                        index={i}
                      />
                    ))}
                  </Row>
                ))}
                {becauseFailed && (
                  <div className="mt-10">
                    <Panel>
                      Couldn&apos;t load recommendations from your recent
                      watches. Try again in a moment.
                    </Panel>
                  </div>
                )}
              </>
            )}

            <section className="mt-12" aria-labelledby="picks-heading">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
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
                    setBecause(null);
                    setBecauseFailed(false);
                    setRefreshNonce((n) => n + 1);
                  }}
                  disabled={picksLoading}
                  className="rounded-full border border-border px-4 py-1.5 text-sm font-medium transition hover:border-accent-from disabled:opacity-50"
                >
                  Refresh picks
                </button>
              </div>

              {picksLoading ? (
                <div className="flex gap-3 overflow-hidden">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="w-40 shrink-0 sm:w-44">
                      <SkeletonCard />
                    </div>
                  ))}
                </div>
              ) : picksFailed ? (
                <Panel>
                  Couldn&apos;t build picks right now. Try again in a moment.
                </Panel>
              ) : picks && picks.length > 0 ? (
                <div className="scroll-row -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:gap-4 sm:px-0">
                  {picks.map((item, i) => (
                    <RowCard
                      key={`${item.mediaType}:${item.id}`}
                      item={item}
                      index={i}
                    />
                  ))}
                </div>
              ) : (
                <Panel>
                  Save a few more well-known titles and we&apos;ll find your
                  next watch.
                </Panel>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

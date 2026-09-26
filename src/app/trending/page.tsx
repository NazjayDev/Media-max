"use client";

import Link from "next/link";
import ActivityChart from "@/components/ActivityChart";
import RecommendationCard from "@/components/RecommendationCard";
import SkeletonCard from "@/components/SkeletonCard";
import { TrendingFooter, useTrending } from "@/components/TrendingStrip";

export default function TrendingPage() {
  const data = useTrending();
  const empty = data && data.titles.length === 0 && data.queries.length === 0;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-16 pt-24 sm:px-8">
      <h1 className="bg-gradient-to-r from-accent-from to-accent-to bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
        Trending
      </h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Live from the last 24 hours of searches and saves. Every event is stored anonymously in a
        Tiger Data (TimescaleDB) hypertable and rolled up hourly by continuous aggregates.
      </p>
      {data?.includesDemo && (
        <p className="mt-2 max-w-xl rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          This view includes sample activity added for the hackathon demo, mixed with any real activity.
        </p>
      )}

      {!data ? (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : empty ? (
        <div className="mt-8 rounded-xl border border-border bg-surface px-6 py-8 text-center text-muted">
          <p>No activity yet. Run a search and check back in a moment.</p>
          <Link href="/" className="mt-4 inline-block rounded-full border border-border px-6 py-2.5 font-medium text-foreground hover:border-accent-from">
            Start searching
          </Link>
        </div>
      ) : (
        <>
          <section className="mt-8 rounded-2xl border border-border bg-surface p-5" aria-labelledby="activity-heading">
            <h2 id="activity-heading" className="mb-4 text-lg font-bold">
              Activity by hour
            </h2>
            <ActivityChart points={data.activity} />
          </section>

          {data.queries.length > 0 && (
            <section className="mt-10" aria-labelledby="vibes-heading">
              <h2 id="vibes-heading" className="mb-3 text-lg font-bold">
                Trending vibes
              </h2>
              <ol className="divide-y divide-border rounded-2xl border border-border bg-surface">
                {data.queries.map((q, i) => (
                  <li key={q.query} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                    <span>
                      <span className="mr-3 text-muted">{i + 1}</span>
                      {q.query}
                    </span>
                    <span className="text-muted">{q.count} search{q.count === 1 ? "" : "es"}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {data.titles.length > 0 && (
            <section className="mt-10" aria-labelledby="titles-heading">
              <h2 id="titles-heading" className="mb-3 text-lg font-bold">
                Trending titles
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
                {data.titles.map((t, i) => (
                  <RecommendationCard key={`${t.mediaType}:${t.id}`} item={t} index={i} footer={<TrendingFooter title={t} />} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

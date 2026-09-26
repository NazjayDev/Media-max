"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RecommendationCard from "@/components/RecommendationCard";
import Sparkline from "@/components/Sparkline";
import type { TrendingData, TrendingTitle } from "@/lib/trending";

export function TrendingFooter({ title }: { title: TrendingTitle }) {
  return (
    <div className="mt-3 border-t border-border pt-2">
      <Sparkline values={title.series} label={`Activity for ${title.title} over the last 24 hours`} />
      <p className="mt-1 text-[11px] text-muted">
        {title.searches} search{title.searches === 1 ? "" : "es"}
        {title.saves > 0 ? `, ${title.saves} save${title.saves === 1 ? "" : "s"}` : ""} today
      </p>
    </div>
  );
}

export function useTrending(): TrendingData | null {
  const [data, setData] = useState<TrendingData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/trending")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json) setData(json);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}

interface TrendingStripProps {
  onPickVibe: (query: string) => void;
}

/** Compact "trending now" section for the home page. Renders nothing until there is data. */
export default function TrendingStrip({ onPickVibe }: TrendingStripProps) {
  const data = useTrending();
  if (!data || (data.titles.length === 0 && data.queries.length === 0)) return null;

  return (
    <section aria-labelledby="trending-heading" className="animate-fade-up">
      <div className="mb-4 flex items-end justify-between gap-2">
        <div>
          <h2 id="trending-heading" className="text-xl font-bold">
            Trending on Media Max
          </h2>
          <p className="text-sm text-muted">What people are searching and saving right now.</p>
          {data.includesDemo && (
            <p className="mt-1 text-xs text-muted">Includes sample activity added for the hackathon demo.</p>
          )}
        </div>
        <Link href="/trending" className="text-sm font-medium text-accent-from underline-offset-2 hover:underline dark:text-violet-300">
          See all trends
        </Link>
      </div>

      {data.queries.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {data.queries.slice(0, 5).map((q) => (
            <button
              key={q.query}
              type="button"
              onClick={() => onPickVibe(q.query)}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm transition hover:border-accent-from"
            >
              {q.query} <span className="text-muted">({q.count})</span>
            </button>
          ))}
        </div>
      )}

      {data.titles.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
          {data.titles.slice(0, 5).map((t, i) => (
            <RecommendationCard key={`${t.mediaType}:${t.id}`} item={t} index={i} footer={<TrendingFooter title={t} />} />
          ))}
        </div>
      )}
    </section>
  );
}

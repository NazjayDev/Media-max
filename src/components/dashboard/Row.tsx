"use client";

import { useEffect, useState } from "react";
import RecommendationCard from "@/components/RecommendationCard";
import SkeletonCard from "@/components/SkeletonCard";
import type { Recommendation } from "@/types/media";

export function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-6 py-6 text-center text-sm text-muted">
      {children}
    </div>
  );
}

const SCROLL_ROW =
  "scroll-row -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:gap-4 sm:px-0";

interface RowProps {
  id: string;
  title: string;
  subtitle?: string;
  count?: number;
  emptyText?: string;
  /** Optional control shown at the right of the row header. */
  action?: React.ReactNode;
  children?: React.ReactNode;
}

/** A titled, horizontally scrolling row of cards with an empty state. */
export function Row({ id, title, subtitle, count, emptyText, action, children }: RowProps) {
  return (
    <section className="mt-10" aria-labelledby={`${id}-heading`}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id={`${id}-heading`} className="text-xl font-bold">
            {title}
            {count !== undefined && (
              <span className="ml-2 text-base font-normal text-muted">({count})</span>
            )}
          </h2>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {count === 0 ? <Panel>{emptyText}</Panel> : <div className={SCROLL_ROW}>{children}</div>}
    </section>
  );
}

export function RowCard({
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

/** Seconds since mount, ticking once a second, so loading text can change as a wait drags on. */
function useElapsedSeconds(): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return seconds;
}

/**
 * Placeholder row shown while a section loads. `messages` are shown in turn as the wait grows:
 * each entry is [seconds after which it appears, text].
 */
export function SkeletonRow({ title, messages }: { title: string; messages?: [number, string][] }) {
  const elapsed = useElapsedSeconds();
  const message = messages?.filter(([after]) => elapsed >= after).at(-1)?.[1];

  return (
    <section className="mt-10" aria-label={`${title} (loading)`}>
      <h2 className="text-xl font-bold">{title}</h2>
      <p role="status" className="mb-3 mt-1 flex min-h-5 items-center gap-2 text-sm text-muted">
        {message && (
          <>
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent-from"
            />
            {message}
          </>
        )}
      </p>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-44 shrink-0 sm:w-52">
            <SkeletonCard />
          </div>
        ))}
      </div>
    </section>
  );
}

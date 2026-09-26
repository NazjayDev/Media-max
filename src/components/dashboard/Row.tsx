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

/** Placeholder row shown while a section loads. */
export function SkeletonRow({ title }: { title: string }) {
  return (
    <section className="mt-10" aria-label={`${title} (loading)`}>
      <h2 className="mb-3 text-xl font-bold">{title}</h2>
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

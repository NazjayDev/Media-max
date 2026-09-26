"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import RecommendationCard from "@/components/RecommendationCard";
import SkeletonCard from "@/components/SkeletonCard";
import { useJson } from "@/lib/useJson";
import type { Recommendation } from "@/types/media";

function SearchInner() {
  const router = useRouter();
  const q = useSearchParams().get("q")?.trim() ?? "";
  const [draft, setDraft] = useState(q);
  const { data, loading, failed } = useJson<{ results: Recommendation[] }>(
    q.length >= 2 ? `/api/lookup?query=${encodeURIComponent(q)}` : null,
  );
  const results = data?.results ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-24 sm:px-8">
      <Link href="/" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
        &larr; Back to home
      </Link>
      <h1 className="text-3xl font-extrabold tracking-tight text-accent-from sm:text-5xl">
        Look up a title
      </h1>
      <p className="mt-2 max-w-xl text-muted">
        Find any movie, show or anime and see where it streams. For picks based on what you like,
        use the{" "}
        <Link
          href="/"
          className="font-semibold text-accent-from underline-offset-2 hover:underline"
        >
          recommendations search
        </Link>
        .
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const next = draft.trim();
          if (next.length >= 2) router.replace(`/search?q=${encodeURIComponent(next)}`);
        }}
        className="mt-6 flex max-w-xl gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={100}
          placeholder="Enter a movie, show, or anime title..."
          aria-label="Title to look up"
          className="min-w-0 flex-1 rounded-full border border-border bg-surface px-5 py-3 text-base outline-none focus:border-accent-from focus:ring-4 focus:ring-accent-from/20"
        />
        <button
          type="submit"
          disabled={draft.trim().length < 2}
          className="rounded-full bg-gradient-to-r from-accent-from to-accent-to px-6 py-3 font-bold disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-none disabled:bg-surface disabled:text-muted"
        >
          Look up
        </button>
      </form>

      <div className="mt-8" aria-live="polite">
        {loading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}
        {failed && (
          <p role="alert" className="text-sm text-red-400">
            Couldn&apos;t search right now. Try again in a moment.
          </p>
        )}
        {q && !loading && !failed && results.length === 0 && (
          <p className="rounded-lg border border-border bg-surface px-6 py-8 text-center text-muted">
            No matches for &ldquo;{q}&rdquo;. Check the spelling or try a shorter name.
          </p>
        )}
        {results.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
            {results.map((item, i) => (
              <RecommendationCard
                key={`${item.mediaType}:${item.id}`}
                item={item}
                index={i}
                footer={
                  <Link
                    href={`/?like=${item.mediaType}:${item.id}`}
                    className="mt-2 inline-block text-xs font-bold text-accent-from underline-offset-2 hover:underline"
                  >
                    Get recommendations like this
                  </Link>
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchInner />
    </Suspense>
  );
}

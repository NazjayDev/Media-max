"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import RecommendationCard from "@/components/RecommendationCard";
import SkeletonCard from "@/components/SkeletonCard";
import UndoBar, { type UndoState } from "@/components/UndoBar";
import { GENRES } from "@/lib/genres";
import { useJson } from "@/lib/useJson";
import { useSeen } from "@/lib/useSeen";
import type { Recommendation } from "@/types/media";

const TYPES = [
  ["all", "Everything"],
  ["movie", "Movies"],
  ["tv", "TV"],
  ["anime", "Anime"],
] as const;
const SORTS = [
  ["popular", "Most popular"],
  ["rating", "Top rated"],
] as const;

interface Page {
  results: Recommendation[];
  hasMore: boolean;
}

const chip = (active: boolean) =>
  `inline-flex min-h-9 items-center rounded-md border px-3.5 text-sm font-semibold transition ${
    active
      ? "border-accent-to bg-accent-to text-[var(--on-accent)]"
      : "border-border bg-surface hover:border-accent-to hover:text-accent-from"
  }`;

function BrowseInner() {
  const router = useRouter();
  const params = useSearchParams();
  const genre = GENRES.some((g) => g.label === params.get("genre")) ? params.get("genre")! : "";
  const type = TYPES.find(([t]) => t === params.get("type"))?.[0] ?? "all";
  const sort = SORTS.find(([s]) => s === params.get("sort"))?.[0] ?? "popular";
  const q = params.get("q")?.trim().slice(0, 60) ?? "";
  const [draft, setDraft] = useState(q);
  const typing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { seen, markSeen } = useSeen();
  const [undo, setUndo] = useState<UndoState | null>(null);

  // The first page comes from the address; more pages are added below it and belong to that address.
  const query = `genre=${encodeURIComponent(genre)}&type=${type}&sort=${sort}&q=${encodeURIComponent(q)}`;
  const first = useJson<Page>(`/api/browse?${query}&page=0`);
  const [extra, setExtra] = useState<{
    query: string;
    pages: number;
    results: Recommendation[];
    hasMore: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const more = extra?.query === query ? extra : null;

  function go(next: { genre?: string; type?: string; sort?: string; q?: string }) {
    const merged = { genre, type, sort, q, ...next };
    const qs = new URLSearchParams();
    if (merged.q) qs.set("q", merged.q);
    if (merged.genre) qs.set("genre", merged.genre);
    if (merged.type !== "all") qs.set("type", merged.type);
    if (merged.sort !== "popular") qs.set("sort", merged.sort);
    router.replace(`/browse${qs.size ? `?${qs}` : ""}`, { scroll: false });
  }

  async function loadMore() {
    setBusy(true);
    setError("");
    try {
      const page = more?.pages ?? 1;
      const res = await fetch(`/api/browse?${query}&page=${page}`);
      if (!res.ok) throw new Error("Couldn't load more.");
      const data = (await res.json()) as Page;
      setExtra({
        query,
        pages: page + 1,
        results: [...(more?.results ?? []), ...data.results],
        hasMore: data.hasMore,
      });
    } catch {
      setError("Couldn't load more. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const all = [...(first.data?.results ?? []), ...(more?.results ?? [])];
  const visible = all.filter((r) => !seen.has(`${r.mediaType}:${r.id}`));
  const hasMore = more ? more.hasMore : (first.data?.hasMore ?? false);
  const scope = `${genre || "All genres"}${type === "all" ? "" : ` in ${TYPES.find(([t]) => t === type)![1]}`}`;
  const title = q.length >= 2 ? `\u201c${q}\u201d in ${scope}` : scope;

  // Waits a moment after the last keystroke, so typing doesn't search on every letter.
  function onType(value: string) {
    setDraft(value);
    clearTimeout(typing.current);
    typing.current = setTimeout(() => go({ q: value.trim() }), 350);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-24 sm:px-8">
      <Link href="/" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
        &larr; Back to home
      </Link>
      <h1 className="text-3xl font-extrabold tracking-tight text-accent-from sm:text-5xl">
        Browse
      </h1>
      <p className="mt-2 max-w-xl text-muted">
        Pick a genre and a type to see what&apos;s popular or best rated. Open anything to get
        recommendations like it.
      </p>

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          clearTimeout(typing.current);
          go({ q: draft.trim() });
        }}
        className="relative mt-6 max-w-xl"
      >
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={draft}
          onChange={(e) => onType(e.target.value)}
          maxLength={60}
          placeholder={genre ? `Search ${genre} titles by name...` : "Search titles by name..."}
          aria-label="Search these titles by name"
          className="w-full rounded-full border border-border bg-surface py-3 pl-12 pr-11 text-base outline-none focus:border-accent-from focus:ring-4 focus:ring-accent-from/20"
        />
        {draft && (
          <button
            type="button"
            onClick={() => {
              clearTimeout(typing.current);
              setDraft("");
              go({ q: "" });
            }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 text-xl leading-none text-muted hover:text-foreground"
          >
            &times;
          </button>
        )}
      </form>

      <div className="mt-6 flex flex-col gap-4">
        <div role="group" aria-label="Type" className="flex flex-wrap gap-2">
          {TYPES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={type === value}
              onClick={() => go({ type: value })}
              className={chip(type === value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Genre" className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={genre === ""}
            onClick={() => go({ genre: "" })}
            className={chip(genre === "")}
          >
            All genres
          </button>
          {GENRES.map((g) => (
            <button
              key={g.label}
              type="button"
              aria-pressed={genre === g.label}
              onClick={() => go({ genre: g.label })}
              className={chip(genre === g.label)}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Sort" className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Sort by</span>
          {SORTS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={sort === value}
              onClick={() => go({ sort: value })}
              className={chip(sort === value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <h2 className="mt-8 text-xl font-extrabold">{title}</h2>

      <div
        className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5"
        aria-live="polite"
      >
        {first.loading && Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
        {visible.map((item, i) => (
          <RecommendationCard
            key={`${item.mediaType}:${item.id}`}
            item={item}
            index={i}
            onSeen={async (it) => setUndo({ title: it.title, run: await markSeen(it) })}
          />
        ))}
        {busy && Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={`more-${i}`} />)}
      </div>

      {first.failed && (
        <p role="alert" className="mt-6 text-sm text-red-400">
          Couldn&apos;t load this list. Try again in a moment.
        </p>
      )}
      {!first.loading && !first.failed && all.length === 0 && (
        <p className="mt-6 rounded-lg border border-border bg-surface px-6 py-8 text-center text-muted">
          {q.length >= 2 ? (
            <>
              Nothing called &ldquo;{q}&rdquo; in {scope.toLowerCase()}.{" "}
              <Link
                href={`/search?q=${encodeURIComponent(q)}`}
                className="font-semibold text-accent-from underline-offset-2 hover:underline"
              >
                Look it up across every title
              </Link>
              .
            </>
          ) : (
            "Nothing in the catalog matches that yet. Try another genre or type."
          )}
        </p>
      )}
      {hasMore && !first.loading && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={busy}
            className="min-h-11 rounded-full border border-accent-to px-7 text-sm font-bold text-accent-from transition hover:bg-accent-to/10 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? "Loading..." : "Show more"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-center text-sm text-red-400">
          {error}
        </p>
      )}
      <UndoBar undo={undo} onDismiss={() => setUndo(null)} />
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense>
      <BrowseInner />
    </Suspense>
  );
}

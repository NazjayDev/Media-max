"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ProfileFavorite } from "@/lib/profileTypes";
import { useJson } from "@/lib/useJson";

interface Hit {
  username: string;
  favorites: ProfileFavorite[];
}

/** Search for people by username, to find a friend and open their profile. */
export default function PeoplePage() {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const { data, loading } = useJson<{ results: Hit[] }>(
    term.length >= 2 ? `/api/users/search?q=${encodeURIComponent(term)}` : null,
  );
  const results = data?.results ?? [];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-24 sm:px-8">
      <Link href="/" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
        &larr; Back to home
      </Link>
      <h1 className="text-3xl font-extrabold tracking-tight text-accent-from sm:text-5xl">
        Find people
      </h1>
      <p className="mt-2 max-w-xl text-muted">
        Search for a friend&apos;s username to see their favorites and top posts.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(query.trim());
        }}
        className="mt-6 flex max-w-sm gap-2"
      >
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setTerm(e.target.value.trim());
          }}
          maxLength={20}
          placeholder="Username"
          aria-label="Search by username"
          className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent-from focus:ring-4 focus:ring-accent-from/20"
        />
      </form>

      <div className="mt-6" aria-live="polite">
        {term.length >= 2 && loading && <p className="text-sm text-muted">Searching...</p>}
        {term.length >= 2 && !loading && results.length === 0 && (
          <p className="text-sm text-muted">No one found matching &ldquo;{term}&rdquo;.</p>
        )}
        <ul className="flex flex-col gap-2">
          {results.map((hit) => (
            <li key={hit.username}>
              <Link
                href={`/u/${encodeURIComponent(hit.username)}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 transition hover:border-accent-to"
              >
                <span className="flex -space-x-3">
                  {hit.favorites.slice(0, 3).map((f, i) => (
                    <span
                      key={i}
                      className="relative h-10 w-7 overflow-hidden rounded-[2px] bg-zinc-800 ring-2 ring-surface"
                      style={{ zIndex: 3 - i }}
                    >
                      {f.posterPath && (
                        <Image
                          src={f.posterPath}
                          alt=""
                          fill
                          sizes="28px"
                          className="object-cover"
                        />
                      )}
                    </span>
                  ))}
                  {hit.favorites.length === 0 && (
                    <span className="flex h-10 w-7 items-center justify-center rounded-[2px] bg-white/[.06] text-xs text-muted">
                      &ndash;
                    </span>
                  )}
                </span>
                <span className="font-semibold">{hit.username}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

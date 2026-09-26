"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { Community } from "@/lib/community";
import { useJson } from "@/lib/useJson";

function Stat({ children }: { children: React.ReactNode }) {
  return <span className="whitespace-nowrap">{children}</span>;
}

export default function CommunityPage() {
  const { data: session } = useSession();
  const isDemo = !!session?.user?.demo;
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const { data, loading } = useJson<Community>("/api/community", refreshKey);

  async function refreshSamples() {
    setRefreshing(true);
    setRefreshError("");
    try {
      const res = await fetch("/api/demo/discussions", { method: "POST" });
      if (!res.ok) {
        setRefreshError((await res.json().catch(() => ({}))).error ?? "Couldn't refresh.");
      }
      setRefreshKey((k) => k + 1);
    } catch {
      setRefreshError("Network error. Try again.");
    } finally {
      setRefreshing(false);
    }
  }

  const titles = data?.titles ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-24 sm:px-8">
      <Link href="/" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
        &larr; Back to home
      </Link>
      <h1 className="text-3xl font-extrabold tracking-tight text-accent-from sm:text-5xl">
        What&apos;s got people talking?
      </h1>
      <p className="mt-3 max-w-xl text-muted">
        The movies, shows and anime with the busiest discussions right now. Recent posts and likes
        count most, and older activity fades.
      </p>

      {(data?.includesSample || isDemo) && (
        <div className="mt-4 flex max-w-xl flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <span>
            {refreshError ||
              (data?.includesSample
                ? "Demo account: these discussions are sample conversations for the presentation. Regular visitors only see real ones."
                : "Demo account: the sample discussions aren't loaded yet. Press Refresh samples.")}
          </span>
          {isDemo && (
            <button
              type="button"
              disabled={refreshing}
              onClick={refreshSamples}
              className="rounded-full border border-amber-500/60 px-3 py-1 font-semibold hover:bg-amber-500/20 disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "Refresh samples"}
            </button>
          )}
        </div>
      )}

      {loading && !data ? (
        <ol className="mt-8 flex flex-col gap-4" aria-label="Loading discussions">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="h-40 animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </ol>
      ) : titles.length === 0 ? (
        <div className="mt-8 rounded-lg border border-border bg-surface px-6 py-10 text-center">
          <p className="font-semibold">No one is talking yet.</p>
          <p className="mt-1 text-sm text-muted">
            Open any movie, show or anime and start the first discussion.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-full border border-accent-to px-6 py-2.5 text-sm font-bold text-accent-from transition hover:bg-accent-to/10"
          >
            Find something to discuss
          </Link>
        </div>
      ) : (
        <ol className="mt-8 flex flex-col gap-4">
          {titles.map((t, i) => (
            <li
              key={`${t.mediaType}:${t.id}`}
              className="flex gap-4 rounded-lg border border-border bg-surface p-4 sm:gap-5"
            >
              <span
                aria-label={`Number ${i + 1}`}
                className="w-7 shrink-0 font-[family-name:var(--font-display)] text-3xl font-extrabold leading-none text-accent-to sm:w-9 sm:text-4xl"
              >
                {i + 1}
              </span>

              <Link
                href={`/title/${t.mediaType}/${t.id}`}
                aria-label={`Open ${t.title} and its discussion`}
                className="relative hidden aspect-[2/3] w-20 shrink-0 self-start overflow-hidden rounded-[2px] bg-zinc-800 ring-1 ring-border sm:block"
              >
                {t.posterPath && (
                  <Image src={t.posterPath} alt="" fill sizes="80px" className="object-cover" />
                )}
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 className="text-lg font-extrabold sm:text-xl">
                    <Link href={`/title/${t.mediaType}/${t.id}`} className="hover:underline">
                      {t.title}
                    </Link>
                  </h2>
                  <span className="text-xs text-muted">
                    {t.mediaType === "tv" ? "TV" : "Movie"}
                  </span>
                  {i === 0 && (
                    <span className="rounded-full bg-accent-to px-2.5 py-0.5 text-xs font-bold text-[var(--on-accent)]">
                      Hottest right now
                    </span>
                  )}
                  {t.rising && i !== 0 && (
                    <span className="rounded-full border border-accent-to px-2.5 py-0.5 text-xs font-bold text-accent-from">
                      Rising
                    </span>
                  )}
                </div>

                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  <Stat>
                    <strong className="text-foreground">{t.postsToday}</strong> today
                  </Stat>
                  <Stat>
                    <strong className="text-foreground">{t.posts}</strong> this week
                  </Stat>
                  <Stat>
                    <strong className="text-foreground">{t.likes}</strong> likes
                  </Stat>
                  <Stat>
                    <strong className="text-foreground">{t.people}</strong> people
                  </Stat>
                </p>

                <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                  <span
                    className="h-1.5 w-32 shrink-0 overflow-hidden rounded-full bg-white/10 sm:w-48"
                    role="img"
                    aria-label={`${Math.round(t.vsLeader * 100)}% as many posts as the busiest title`}
                  >
                    <span
                      className="block h-full rounded-full bg-accent-to"
                      style={{ width: `${Math.max(6, Math.round(t.vsLeader * 100))}%` }}
                    />
                  </span>
                  <span>
                    {t.timesAverage >= 1.1
                      ? `${t.timesAverage.toFixed(1)}\u00d7 the average discussion`
                      : `${Math.round(t.vsLeader * 100)}% as busy as the top discussion`}
                  </span>
                </div>

                {t.top && (
                  <blockquote className="mt-3 border-l-2 border-border pl-3 text-sm">
                    {t.top.spoiler ? (
                      <p className="text-amber-300">
                        Top comment contains spoilers. Open the discussion to view it.
                      </p>
                    ) : (
                      <p className="leading-6">{t.top.text}</p>
                    )}
                    <footer className="mt-1 text-xs text-muted">
                      {t.top.author} · {t.top.likes} {t.top.likes === 1 ? "like" : "likes"}
                    </footer>
                  </blockquote>
                )}

                <Link
                  href={`/title/${t.mediaType}/${t.id}`}
                  className="mt-3 inline-block text-sm font-semibold text-accent-from underline-offset-2 hover:underline"
                >
                  Join the discussion
                </Link>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

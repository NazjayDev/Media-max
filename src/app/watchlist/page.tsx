"use client";

import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { useWatchlist } from "@/components/Providers";
import RecommendationCard from "@/components/RecommendationCard";
import SkeletonCard from "@/components/SkeletonCard";

export default function WatchlistPage() {
  const { status } = useSession();
  const { items, loading } = useWatchlist();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-16 pt-24 sm:px-8">
      <h1 className="bg-gradient-to-r from-accent-from to-accent-to bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
        My watchlist
      </h1>

      <div className="mt-8" aria-live="polite">
        {status === "loading" || loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : status === "unauthenticated" ? (
          <div className="rounded-xl border border-border bg-surface px-6 py-8 text-center">
            <p className="text-muted">Sign in to see the titles you&apos;ve saved.</p>
            <button
              type="button"
              onClick={() => signIn("google")}
              className="mt-4 rounded-full bg-gradient-to-r from-accent-from to-accent-to px-6 py-2.5 font-semibold text-white"
            >
              Sign in with Google
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface px-6 py-8 text-center">
            <p className="text-muted">Nothing saved yet. Tap the bookmark on any recommendation.</p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-full border border-border px-6 py-2.5 font-medium hover:border-accent-from"
            >
              Find something to watch
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
            {items.map((item, i) => (
              <RecommendationCard key={`${item.mediaType}:${item.id}`} item={item} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

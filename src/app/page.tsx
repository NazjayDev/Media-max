"use client";

import { useState } from "react";
import SearchBar from "@/components/SearchBar";
import RecommendationCard from "@/components/RecommendationCard";
import SkeletonCard from "@/components/SkeletonCard";
import type { Recommendation, SearchResult } from "@/types/media";

type Status = "idle" | "loading" | "error" | "success";

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [matchedTitle, setMatchedTitle] = useState<SearchResult | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  async function handleSearch(query: string) {
    setStatus("loading");
    setErrorMessage("");
    setRecommendations([]);
    setMatchedTitle(null);

    try {
      const searchRes = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
      const searchData = await searchRes.json();

      if (!searchRes.ok) {
        setErrorMessage(
          searchRes.status === 404
            ? `No matches found for "${query}". Try a different title.`
            : "Something went wrong searching for that title. Please try again."
        );
        setStatus("error");
        return;
      }

      const match: SearchResult = searchData;
      setMatchedTitle(match);

      const recsRes = await fetch(
        `/api/recommendations?mediaType=${match.mediaType}&id=${match.id}`
      );
      const recsData = await recsRes.json();

      if (!recsRes.ok) {
        setErrorMessage("Found the title, but couldn't load recommendations. Please try again.");
        setStatus("error");
        return;
      }

      if (!recsData.results || recsData.results.length === 0) {
        setErrorMessage(`No similar titles found for "${match.title}".`);
        setStatus("error");
        return;
      }

      setRecommendations(recsData.results);
      setStatus("success");
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-x-hidden px-4 pb-16 pt-12 sm:px-8 sm:pt-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-gradient-to-b from-accent-from/15 via-accent-to/5 to-transparent"
      />

      <header className="animate-fade-up flex w-full max-w-5xl flex-col items-center gap-3 text-center">
        <h1 className="bg-gradient-to-r from-accent-from to-accent-to bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-6xl">
          Media Max
        </h1>
        <p className="max-w-md text-sm text-muted sm:text-base">
          Find your next watch. Search a movie, show, or anime and get recommendations
          with the same vibe — plus exactly where to stream them.
        </p>

        <div className="mt-4 flex w-full justify-center sm:mt-6">
          <SearchBar onSearch={handleSearch} disabled={status === "loading"} />
        </div>
      </header>

      <main className="mt-10 w-full max-w-5xl sm:mt-14" aria-live="polite">
        {status === "loading" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {status === "error" && (
          <p
            role="alert"
            className="animate-fade-up mx-auto max-w-md rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-center text-sm text-red-600 dark:text-red-400"
          >
            {errorMessage}
          </p>
        )}

        {status === "success" && matchedTitle && (
          <>
            <p className="animate-fade-up mb-6 text-center text-sm text-muted">
              Because you searched for{" "}
              <span className="font-semibold text-foreground">{matchedTitle.title}</span>
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
              {recommendations.map((item, i) => (
                <RecommendationCard key={item.id} item={item} index={i} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

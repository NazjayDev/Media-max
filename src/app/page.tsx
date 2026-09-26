"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import PosterReel, { type ReelKind } from "@/components/PosterReel";
import SearchBar, { type SearchMode } from "@/components/SearchBar";
import RecommendationCard from "@/components/RecommendationCard";
import SkeletonCard from "@/components/SkeletonCard";
import NarrateButton from "@/components/NarrateButton";
import TrendingStrip from "@/components/TrendingStrip";
import { useVoiceReplies } from "@/lib/voiceSetting";
import type { Recommendation, SearchResult, SearchSuggestion } from "@/types/media";

type Status = "idle" | "loading" | "error" | "success";

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [matchedTitle, setMatchedTitle] = useState<SearchResult | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [mode, setMode] = useState<SearchMode>("title");
  const [vibeQuery, setVibeQuery] = useState("");
  const [narrateToken, setNarrateToken] = useState(0);
  const [reelKind, setReelKind] = useState<ReelKind>(null);
  const { status: authStatus } = useSession();
  const voiceReplies = useVoiceReplies();

  const narrationScript = useMemo(() => {
    const intro = matchedTitle
      ? `Because you liked ${matchedTitle.title}, here are my top picks.`
      : `Here are my picks for the vibe: ${vibeQuery}.`;
    const ordinals = ["One", "Two", "Three"];
    let script = intro;
    recommendations.slice(0, 3).forEach((rec, i) => {
      const reason = (rec.why || rec.blurb || "").replace(/\s+/g, " ").trim();
      const line = ` ${ordinals[i]}: ${rec.title}. ${reason.slice(0, 120)}`;
      if (script.length + line.length <= 650) script += line;
    });
    return script;
  }, [matchedTitle, vibeQuery, recommendations]);

  async function handleVibeSearch(vibe: string, viaVoice = false) {
    setStatus("loading");
    setErrorMessage("");
    setRecommendations([]);
    setMatchedTitle(null);
    setVibeQuery(vibe);

    try {
      const res = await fetch(`/api/vibe?vibe=${encodeURIComponent(vibe)}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(
          res.status === 503
            ? "Vibe search isn't available right now."
            : res.status === 429
              ? "Vibe search is busy. Try again in a moment."
              : "Couldn't run vibe search. Please try again.",
        );
        setStatus("error");
        return;
      }

      if (!data.results || data.results.length === 0) {
        setErrorMessage(`No matches found for that vibe. Try describing it differently.`);
        setStatus("error");
        return;
      }

      setRecommendations(data.results);
      setStatus("success");
      if (viaVoice && voiceReplies) setNarrateToken((t) => t + 1);
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  async function handleSearch(rawQuery: string, viaVoice = false) {
    // Spoken requests often sound like "movies like Interstellar"; search by the title itself.
    const query =
      mode === "title" && viaVoice
        ? rawQuery.replace(
            /^(?:(?:show|find|give) me |i(?:'d| would) like |i want |recommend )?(?:some )?(?:movies?|shows?|series|anime|films?|something|stuff)? ?(?:like|similar to) /i,
            "",
          )
        : rawQuery;

    if (mode === "vibe") {
      return handleVibeSearch(query, viaVoice);
    }

    return handleTitleSearch(`query=${encodeURIComponent(query)}`, query, viaVoice);
  }

  // A title picked from the dropdown is looked up by its exact id rather than by its name.
  function handleSelect(title: SearchSuggestion) {
    return handleTitleSearch(`mediaType=${title.mediaType}&id=${title.id}`, title.title, false);
  }

  async function handleTitleSearch(lookup: string, label: string, viaVoice: boolean) {
    setStatus("loading");
    setErrorMessage("");
    setRecommendations([]);
    setMatchedTitle(null);

    try {
      const searchRes = await fetch(`/api/search?${lookup}`);
      const searchData = await searchRes.json();

      if (!searchRes.ok) {
        setErrorMessage(
          searchRes.status === 404
            ? `No matches found for "${label}". Try a different title.`
            : "Something went wrong searching for that title. Please try again.",
        );
        setStatus("error");
        return;
      }

      const match: SearchResult = searchData;
      setMatchedTitle(match);

      const recsRes = await fetch(
        `/api/recommendations?mediaType=${match.mediaType}&id=${match.id}`,
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
      if (viaVoice && voiceReplies) setNarrateToken((t) => t + 1);
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-x-hidden px-4 pb-16 pt-20 sm:px-8 sm:pt-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(ellipse_at_50%_0%,rgba(247,101,0,0.2),transparent_65%)]"
      />

      <h1 className="sr-only">Media Max: select your next watch</h1>
      <Image
        src="/brand/mediamax-banner.png"
        alt="Media Max. Select your next watch."
        width={1600}
        height={513}
        priority
        unoptimized
        className="h-auto w-[min(660px,92vw)]"
      />

      {/* The reel breaks out of the page padding so it runs edge to edge, tilted like a strip in motion. */}
      <div className="relative left-1/2 mt-2 w-[104vw] -translate-x-1/2 -rotate-[1.2deg] sm:mt-4">
        <PosterReel kind={reelKind} />
      </div>

      <div
        role="group"
        aria-label="Change the posters on the reel"
        className="mt-8 flex items-center gap-2"
      >
        {(
          [
            ["movie", "Movies"],
            ["tv", "TV"],
            ["anime", "Anime"],
          ] as const
        ).map(([kind, label]) => (
          <button
            key={kind}
            type="button"
            aria-pressed={reelKind === kind}
            onClick={() => setReelKind(reelKind === kind ? null : kind)}
            className={`min-h-11 min-w-[5.5rem] rounded-md border px-5 text-sm font-bold transition ${
              reelKind === kind
                ? "border-accent-to bg-accent-to text-[var(--on-accent)]"
                : "border-border bg-surface text-foreground hover:border-accent-to hover:text-accent-from"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <nav
        aria-label="Explore"
        className="mt-5 flex w-full max-w-xl items-center justify-between gap-6 sm:justify-around"
      >
        {[
          ["/trending", "Community"],
          ["/dashboard", "Dashboard"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="font-[family-name:var(--font-display)] text-lg font-extrabold uppercase tracking-wide underline decoration-accent-to decoration-2 underline-offset-8 transition hover:text-accent-from sm:text-xl"
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-8 flex w-full justify-center">
        <SearchBar
          onSearch={handleSearch}
          onSelect={handleSelect}
          disabled={status === "loading"}
          mode={mode}
          onModeChange={setMode}
        />
      </div>
      <section
        aria-label="Other ways to choose"
        className="mt-6 grid w-full max-w-3xl gap-3 sm:grid-cols-2"
      >
        {[
          {
            href: "/ask",
            title: "Ask Media Max",
            text: "Say what you're in the mood for, with limits like length or streaming service, and keep refining.",
            icon: (
              <path
                d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5V15h-.5A1.5 1.5 0 0 1 5 13.5z"
                strokeLinejoin="round"
              />
            ),
          },
          {
            href: "/together",
            title: "Watch Together",
            text: "Add everyone's favorites and get picks the whole group will enjoy, ranked by who likes them least.",
            icon: (
              <>
                <circle cx="9" cy="12" r="5.5" />
                <circle cx="15" cy="12" r="5.5" />
              </>
            ),
          },
        ].map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            className="group flex gap-4 rounded-lg border border-border bg-surface p-4 transition hover:border-accent-to hover:bg-accent-to/5"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent-to/15 text-accent-from">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden
              >
                {entry.icon}
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block font-[family-name:var(--font-display)] text-base font-extrabold">
                {entry.title}
              </span>
              <span className="mt-1 block text-sm leading-5 text-muted">{entry.text}</span>
            </span>
          </Link>
        ))}
      </section>

      <main className="mt-12 w-full max-w-5xl sm:mt-16" aria-live="polite">
        {status === "idle" && (
          <TrendingStrip
            onPickVibe={(query) => {
              setMode("vibe");
              void handleVibeSearch(query);
            }}
          />
        )}

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

        {status === "success" && (matchedTitle || vibeQuery) && (
          <>
            <p className="animate-fade-up mb-6 text-center text-sm text-muted">
              {matchedTitle ? "Because you searched for" : "Matching the vibe"}{" "}
              <span className="font-semibold text-foreground">
                {matchedTitle ? matchedTitle.title : `"${vibeQuery}"`}
              </span>
            </p>
            {voiceReplies && (
              <div className="mb-6 flex justify-center">
                <NarrateButton script={narrationScript} autoPlayToken={narrateToken} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
              {recommendations.map((item, i) => (
                <RecommendationCard key={item.id} item={item} index={i} />
              ))}
            </div>
          </>
        )}
      </main>

      {authStatus === "unauthenticated" && (
        <div className="mt-16 flex w-full max-w-xs flex-col gap-3">
          <button
            type="button"
            onClick={() => signIn("google")}
            className="rounded-full bg-gradient-to-r from-accent-from to-accent-to px-8 py-3 text-base font-bold transition hover:brightness-110"
          >
            Sign up
          </button>
          <button
            type="button"
            onClick={() => signIn("google")}
            className="rounded-full border border-accent-to px-8 py-3 text-base font-bold text-accent-from transition hover:bg-accent-to/10"
          >
            Login
          </button>
        </div>
      )}

      <footer className="mt-auto w-full max-w-5xl pt-16 text-center text-xs leading-5 text-muted">
        <p>
          This product uses the{" "}
          <a
            href="https://www.themoviedb.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            TMDB
          </a>{" "}
          API but is not endorsed or certified by TMDB.
        </p>
        <p className="mb-1">
          <span className="font-semibold text-foreground">mediamax.select</span>: a{" "}
          <span className="font-mono">.select</span> domain, because the whole point is choosing
          well.
        </p>
        <p>
          Streaming availability data provided by{" "}
          <a
            href="https://www.justwatch.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            JustWatch
          </a>
          .
        </p>
      </footer>
    </div>
  );
}

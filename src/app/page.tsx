"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import PosterReel, { type ReelKind } from "@/components/PosterReel";
import SearchBar, { type SearchMode } from "@/components/SearchBar";
import RecommendationCard from "@/components/RecommendationCard";
import SkeletonCard from "@/components/SkeletonCard";
import NarrateButton from "@/components/NarrateButton";
import TrendingStrip from "@/components/TrendingStrip";
import { useSeen } from "@/lib/useSeen";
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
  const { seen, markSeen } = useSeen();
  const [moreBusy, setMoreBusy] = useState(false);
  const [noMore, setNoMore] = useState(false);
  const [moreError, setMoreError] = useState("");
  const [undo, setUndo] = useState<{ title: string; run: () => void } | null>(null);

  // Titles the person has already watched are left out of what they see.
  const visible = useMemo(
    () => recommendations.filter((r) => !seen.has(`${r.mediaType}:${r.id}`)),
    [recommendations, seen],
  );

  // The "marked as watched" bar goes away by itself.
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 8000);
    return () => clearTimeout(timer);
  }, [undo]);

  const narrationScript = useMemo(() => {
    const intro = matchedTitle
      ? `Because you liked ${matchedTitle.title}, here are my top picks.`
      : `Here are my picks for the vibe: ${vibeQuery}.`;
    const ordinals = ["One", "Two", "Three"];
    let script = intro;
    visible.slice(0, 3).forEach((rec, i) => {
      const reason = (rec.why || rec.blurb || "").replace(/\s+/g, " ").trim();
      const line = ` ${ordinals[i]}: ${rec.title}. ${reason.slice(0, 120)}`;
      if (script.length + line.length <= 650) script += line;
    });
    return script;
  }, [matchedTitle, vibeQuery, visible]);

  async function handleVibeSearch(vibe: string, viaVoice = false) {
    setStatus("loading");
    setErrorMessage("");
    setRecommendations([]);
    setMatchedTitle(null);
    setVibeQuery(vibe);
    setNoMore(false);
    setMoreError("");

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
    setNoMore(false);
    setMoreError("");

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

  async function handleSeen(item: Recommendation) {
    const run = await markSeen(item);
    setUndo({ title: item.title, run });
  }

  async function loadMore() {
    setMoreBusy(true);
    setMoreError("");
    try {
      // Everything shown so far, plus everything already watched, so nothing comes back twice.
      const exclude = [
        ...new Set([...recommendations.map((r) => `${r.mediaType}:${r.id}`), ...seen]),
      ];
      const res = await fetch("/api/more", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          matchedTitle
            ? { mediaType: matchedTitle.mediaType, id: matchedTitle.id, exclude }
            : { vibe: vibeQuery, exclude },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't find more right now.");
      const known = new Set(exclude);
      const fresh = ((data.results ?? []) as Recommendation[]).filter(
        (r) => !known.has(`${r.mediaType}:${r.id}`),
      );
      if (fresh.length === 0) setNoMore(true);
      else setRecommendations((prev) => [...prev, ...fresh]);
    } catch (error) {
      setMoreError(error instanceof Error ? error.message : "Couldn't find more right now.");
    } finally {
      setMoreBusy(false);
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
        className="mt-5 flex w-full max-w-xl flex-wrap items-center justify-center gap-x-5 gap-y-3 sm:justify-around sm:gap-x-8"
      >
        {[
          ["/community", "Community"],
          ["/trending", "Trending"],
          ["/dashboard", "Dashboard"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="font-[family-name:var(--font-display)] text-base font-extrabold uppercase tracking-wide underline decoration-accent-to decoration-2 underline-offset-8 transition hover:text-accent-from sm:text-xl"
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
        className="mt-8 grid w-full max-w-3xl gap-4 sm:grid-cols-2 sm:gap-5"
      >
        {[
          {
            href: "/ask",
            title: "Ask Media Max",
            text: "Say what you're in the mood for, with limits like length or streaming service.",
            seats: "1",
            tilt: "-0.7deg",
          },
          {
            href: "/together",
            title: "Watch Together",
            text: "Add everyone's favorites and get picks the whole group will enjoy.",
            seats: "2\u20134",
            tilt: "0.7deg",
          },
        ].map((ticket) => (
          <Link
            key={ticket.href}
            href={ticket.href}
            className="ticket"
            style={{ "--tilt": ticket.tilt } as React.CSSProperties}
          >
            <span className="ticket-main">
              <span className="ticket-title">{ticket.title}</span>
              <span className="ticket-text">{ticket.text}</span>
            </span>
            {/* Seats: one for asking on your own, two to four for a group. Decorative. */}
            <span className="ticket-stub" aria-hidden>
              <span className="ticket-admit">Admit</span>
              <span className="ticket-seats">{ticket.seats}</span>
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
              {visible.map((item, i) => (
                <RecommendationCard
                  key={`${item.mediaType}:${item.id}`}
                  item={item}
                  index={i}
                  onSeen={handleSeen}
                />
              ))}
              {moreBusy &&
                Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={`more-${i}`} />)}
            </div>

            <div className="mt-8 flex flex-col items-center gap-3 text-center">
              {visible.length === 0 && !moreBusy && (
                <p className="text-sm text-muted">You&apos;ve seen everything on this list.</p>
              )}
              {noMore ? (
                <p className="max-w-md text-sm text-muted">
                  That&apos;s everything we found for this one. Try another title, or describe the
                  vibe you&apos;re after.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={moreBusy}
                  className="min-h-11 rounded-full border border-accent-to px-7 text-sm font-bold text-accent-from transition hover:bg-accent-to/10 disabled:cursor-wait disabled:opacity-60"
                >
                  {moreBusy ? "Finding more..." : "Show more suggestions"}
                </button>
              )}
              {moreError && (
                <p role="alert" className="text-sm text-red-400">
                  {moreError}
                </p>
              )}
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

      {undo && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-md items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm shadow-xl shadow-black/50"
        >
          <span className="min-w-0">
            Marked <strong className="break-words">{undo.title}</strong> as watched.
          </span>
          <button
            type="button"
            onClick={() => {
              undo.run();
              setUndo(null);
            }}
            className="shrink-0 font-bold text-accent-from hover:underline"
          >
            Undo
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

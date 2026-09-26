"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import GenreChips from "@/components/GenreChips";
import HowItWorks from "@/components/HowItWorks";
import PosterReel, { type ReelKind } from "@/components/PosterReel";
import RecentSearches from "@/components/RecentSearches";
import SearchedPanel from "@/components/SearchedPanel";
import UndoBar, { type UndoState } from "@/components/UndoBar";
import SearchBar, { type SearchMode } from "@/components/SearchBar";
import RecommendationCard from "@/components/RecommendationCard";
import SkeletonCard from "@/components/SkeletonCard";
import NarrateButton from "@/components/NarrateButton";
import TrendingStrip from "@/components/TrendingStrip";
import {
  RESET_HOME_EVENT,
  loadLastSearch,
  saveLastSearch,
  saveScroll,
  type LastSearch,
} from "@/lib/lastSearch";
import { addRecentSearch } from "@/lib/recentSearches";
import { useSeen } from "@/lib/useSeen";
import { useVoiceReplies } from "@/lib/voiceSetting";
import type { MediaType, Recommendation, SearchResult, SearchSuggestion } from "@/types/media";

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
  const [undo, setUndo] = useState<UndoState | null>(null);
  const started = useRef(false);

  // Titles the person has already watched are left out of what they see.
  const visible = useMemo(
    () => recommendations.filter((r) => !seen.has(`${r.mediaType}:${r.id}`)),
    [recommendations, seen],
  );

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
      addRecentSearch({ kind: "vibe", text: vibe });
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
    return handleTitleSearch(
      `mediaType=${title.mediaType}&id=${title.id}`,
      title.title,
      false,
      title.year,
    );
  }

  async function handleTitleSearch(
    lookup: string,
    label: string,
    viaVoice: boolean,
    yearHint?: number | null,
  ) {
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

      // Picking from the suggestions gives us the year; a typed search gets it from the lookup.
      const match: SearchResult = { ...searchData, year: searchData.year ?? yearHint ?? null };
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
      addRecentSearch({
        kind: "title",
        mediaType: match.mediaType,
        id: match.id,
        title: match.title,
        posterPath: match.posterPath,
        year: match.year,
      });
      if (viaVoice && voiceReplies) setNarrateToken((t) => t + 1);
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  function restoreSearch(snapshot: { search: LastSearch; scrollY: number }) {
    const { search, scrollY } = snapshot;
    setMode(search.mode);
    setMatchedTitle(search.matched);
    setVibeQuery(search.vibe);
    setRecommendations(search.recommendations);
    setNoMore(search.noMore);
    setStatus("success");
    // Two frames so the results have laid out before scrolling back to where the person was.
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, scrollY)));
  }

  // On arrival: open a title someone asked to get recommendations for, or put the last search back
  // (which is what "Back" from a title page needs).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const like = new URLSearchParams(window.location.search).get("like");
    if (like && /^(movie|tv):\d+$/.test(like)) {
      const [mediaType, id] = like.split(":");
      window.history.replaceState(null, "", "/");
      void handleSelect({
        mediaType: mediaType as MediaType,
        id: Number(id),
        title: "",
        posterPath: null,
        year: null,
      });
      return;
    }
    const snapshot = loadLastSearch();
    // Browser storage can only be read after arrival, so this can't be initial state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (snapshot) restoreSearch(snapshot);
    // Runs once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clicking the logo while already here returns to the start screen.
  useEffect(() => {
    const reset = () => {
      setStatus("idle");
      setRecommendations([]);
      setMatchedTitle(null);
      setVibeQuery("");
      setNoMore(false);
      setMoreError("");
      window.scrollTo({ top: 0 });
    };
    window.addEventListener(RESET_HOME_EVENT, reset);
    return () => window.removeEventListener(RESET_HOME_EVENT, reset);
  }, []);

  // Keep the current results (and where the page is scrolled to) so Back can restore them.
  useEffect(() => {
    if (status !== "success") return;
    saveLastSearch({
      mode: matchedTitle ? "title" : "vibe",
      matched: matchedTitle,
      vibe: vibeQuery,
      recommendations,
      noMore,
    });
  }, [status, matchedTitle, vibeQuery, recommendations, noMore]);

  useEffect(() => {
    if (status !== "success") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        saveScroll(window.scrollY);
      }, 150);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timer) clearTimeout(timer);
    };
  }, [status]);

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
    <div className="relative flex min-h-screen flex-col items-center overflow-x-hidden px-4 pb-16 pt-[4.5rem] sm:px-8 lg:pt-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(ellipse_at_50%_0%,rgba(247,101,0,0.2),transparent_65%)]"
      />

      <h1 className="sr-only">Media Max: select your next watch</h1>
      <Image
        src="/brand/mediamax-strip.png"
        alt="Media Max"
        width={1800}
        height={249}
        priority
        unoptimized
        className="h-auto w-[min(820px,94vw)]"
      />
      {/* The tagline is real text (not part of the logo image) so it stays sharp and readable. */}
      <p className="mt-3 text-center font-[family-name:var(--font-display)] text-xl font-extrabold tracking-wide sm:text-2xl">
        Select your next watch.
      </p>
      <p className="mt-2 max-w-xl text-center text-base leading-7 text-muted sm:text-lg">
        Name a movie, show or anime you love, or describe a mood. Media Max picks what to watch next
        and shows where to stream it.
      </p>

      {/* The reel breaks out of the page padding so it runs edge to edge, tilted like a strip in motion. */}
      <div className="relative left-1/2 mt-6 w-[104vw] -translate-x-1/2 -rotate-[1.2deg] sm:mt-8">
        <PosterReel kind={reelKind} />
      </div>

      <div
        role="group"
        aria-label="Change the posters on the reel"
        className="mt-6 flex items-center gap-2"
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
            className={`min-h-9 min-w-[4.5rem] rounded-full border px-4 text-xs font-bold transition ${
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
        className="mt-6 grid w-full max-w-xl grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {[
          ["/community", "Community"],
          ["/trending", "Trending"],
          ["/browse", "Browse"],
          ["/dashboard", "Dashboard"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-12 items-center justify-center rounded-md border border-border bg-surface px-3 text-center font-[family-name:var(--font-display)] text-sm font-extrabold uppercase tracking-wide transition hover:border-accent-to hover:text-accent-from"
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

      {status === "idle" && (
        <RecentSearches
          onTitle={(r) =>
            void handleSelect({
              mediaType: r.mediaType,
              id: r.id,
              title: r.title,
              posterPath: r.posterPath,
              year: r.year ?? null,
            })
          }
          onVibe={(text) => {
            setMode("vibe");
            void handleVibeSearch(text);
          }}
        />
      )}
      <p className="mt-4 text-center text-sm text-muted">
        Just looking something up?{" "}
        <Link
          href="/search"
          className="font-semibold text-accent-from underline-offset-2 hover:underline"
        >
          Search without recommendations
        </Link>
      </p>

      {status === "idle" && <HowItWorks />}

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
          <div className="flex flex-col items-center">
            <GenreChips />
          </div>
        )}

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
            <SearchedPanel matched={matchedTitle} vibe={vibeQuery} />
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

      <UndoBar undo={undo} onDismiss={() => setUndo(null)} />

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

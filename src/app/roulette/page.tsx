"use client";

import { useState } from "react";
import Link from "next/link";
import RecommendationCard from "@/components/RecommendationCard";
import RouletteReel, { type ReelPoster } from "@/components/RouletteReel";
import { useJson } from "@/lib/useJson";
import { useSeen } from "@/lib/useSeen";
import type { Recommendation } from "@/types/media";

const KINDS = [
  ["all", "Everything"],
  ["movie", "Movies"],
  ["tv", "TV"],
  ["anime", "Anime"],
] as const;
type Kind = (typeof KINDS)[number][0];

interface SpinResponse {
  reel: ReelPoster[];
  winnerIndex: number;
  winner: Recommendation;
}

const chip = (active: boolean) =>
  `inline-flex min-h-10 items-center rounded-full border px-3 text-sm font-bold transition sm:px-5 disabled:cursor-not-allowed disabled:opacity-60 ${
    active
      ? "border-accent-to bg-accent-to text-[var(--on-accent)]"
      : "border-border bg-surface hover:border-accent-to hover:text-accent-from"
  }`;

export default function RoulettePage() {
  const { seen, markSeen } = useSeen();
  const [kind, setKind] = useState<Kind>("all");
  const [strip, setStrip] = useState<ReelPoster[]>([]);
  const [spinId, setSpinId] = useState(0);
  const [restIndex, setRestIndex] = useState(1);
  const [targetIndex, setTargetIndex] = useState(1);
  const [phase, setPhase] = useState<"idle" | "loading" | "spinning" | "done">("idle");
  const [pending, setPending] = useState<Recommendation | null>(null);
  const [winner, setWinner] = useState<Recommendation | null>(null);
  const [error, setError] = useState("");

  // Before the first spin (or after switching category) the reel shows a preview of real posters.
  const preview = useJson<{ results: ReelPoster[] }>(`/api/reel?kind=${kind}`);
  const items = strip.length > 0 ? strip : (preview.data?.results ?? []);
  const busy = phase === "loading" || phase === "spinning";

  function chooseKind(next: Kind) {
    if (busy || next === kind) return;
    setKind(next);
    setStrip([]);
    setSpinId(0);
    setRestIndex(1);
    setWinner(null);
    setPending(null);
    setError("");
    setPhase("idle");
  }

  async function spin() {
    if (busy) return;
    setPhase("loading");
    setError("");
    setWinner(null);
    try {
      const res = await fetch("/api/roulette", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, exclude: [...seen] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't spin the reel. Try again.");
      const spun = data as SpinResponse;

      // The three frames on screen stay at the top, so the reel carries on from where it stopped.
      const from = Math.max(0, restIndex - 1);
      const carry = items.slice(from, from + 3);
      setStrip([...carry, ...spun.reel]);
      setRestIndex(1);
      setTargetIndex(carry.length + spun.winnerIndex);
      setPending(spun.winner);
      setSpinId((n) => n + 1);
      setPhase("spinning");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't spin the reel. Try again.");
      setPhase(winner ? "done" : "idle");
    }
  }

  function landed() {
    setRestIndex(targetIndex);
    setWinner(pending);
    setPhase("done");
  }

  async function watchedAndSpin() {
    if (!winner) return;
    await markSeen(winner);
    void spin();
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-20 pt-24 sm:px-8">
      <Link href="/" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
        &larr; Back to home
      </Link>
      <h1 className="text-3xl font-extrabold tracking-tight text-accent-from sm:text-5xl">
        Media Roulette
      </h1>
      <p className="mt-3 max-w-xl text-base text-muted sm:text-lg">
        Can&apos;t decide? Spin the reel and we&apos;ll pick your next watch.
      </p>

      <div role="group" aria-label="What to spin for" className="mt-6 flex flex-wrap gap-2">
        {KINDS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={kind === value}
            disabled={busy}
            onClick={() => chooseKind(value)}
            className={chip(kind === value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-10 flex flex-col items-center gap-10 md:flex-row md:items-start md:justify-center md:gap-16">
        <div className="flex flex-col items-center gap-8">
          <div className="relative">
            <span aria-hidden className="roulette-pointer left" />
            <span aria-hidden className="roulette-pointer right" />
            <RouletteReel
              items={items}
              spinId={spinId}
              targetIndex={targetIndex}
              restIndex={restIndex}
              onDone={landed}
              flash={phase === "done" ? spinId : 0}
            />
          </div>

          <button
            type="button"
            onClick={spin}
            disabled={busy || items.length === 0}
            className="roulette-spin"
            aria-label={busy ? "Spinning" : winner ? "Spin again" : "Spin"}
          >
            {phase === "loading" ? "..." : phase === "spinning" ? "" : winner ? "AGAIN" : "SPIN"}
          </button>
        </div>

        <div className="w-full max-w-xs" aria-live="polite">
          {winner ? (
            <div className="animate-fade-up">
              <p className="mb-3 text-sm font-bold text-accent-from">
                Tonight, you&apos;re watching
              </p>
              <RecommendationCard item={winner} index={0} />
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={spin}
                  className="min-h-11 rounded-full bg-gradient-to-r from-accent-from to-accent-to px-6 text-sm font-bold"
                >
                  Spin again
                </button>
                <button
                  type="button"
                  onClick={watchedAndSpin}
                  className="min-h-11 rounded-full border border-border px-6 text-sm font-bold hover:border-accent-to"
                >
                  Already watched it, spin again
                </button>
                <Link
                  href={`/?like=${winner.mediaType}:${winner.id}`}
                  className="text-center text-sm font-semibold text-accent-from underline-offset-2 hover:underline"
                >
                  Get recommendations like this
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-surface p-5 text-sm leading-6 text-muted">
              <p className="font-bold text-foreground">How it works</p>
              <p className="mt-2">
                Pick what you&apos;re in the mood for, then press <strong>SPIN</strong>. The reel
                lands on something you haven&apos;t watched. Don&apos;t like it? Spin again, or mark
                it watched and it won&apos;t come back.
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-4 text-sm text-red-400">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { startMariachi, type Mariachi } from "@/lib/mariachi";

const SANDWICHES = ["🥪", "🍔", "🌭", "🥙", "🌯", "🌮", "🥖", "🥯"];
const BAND = ["🎺", "🎸", "🎻", "🎺"];
const COUNT = 46;
const LENGTH_MS = 15000;
const FAREWELL_MS = 2600;

// A small fixed-seed generator, so the shower looks random but renders the same every time.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(7);
const PIECES = Array.from({ length: COUNT }, (_, i) => {
  const spins = 1 + Math.floor(rand() * 3);
  return {
    emoji: SANDWICHES[i % SANDWICHES.length],
    x: `${Math.round(rand() * 96)}%`,
    y: `${Math.round(rand() * 85)}%`,
    size: `${Math.round(30 + rand() * 54)}px`,
    duration: `${(4.2 + rand() * 4.6).toFixed(2)}s`,
    delay: `-${(rand() * 9).toFixed(2)}s`,
    drift: `${Math.round((rand() - 0.5) * 220)}px`,
    spin: `${(rand() < 0.5 ? -1 : 1) * spins * 360}deg`,
  };
});

/**
 * A thank-you for our first tester. Sandwiches rain and spin while an original mariachi tune
 * plays. Click anywhere or press Escape to close it; it also ends itself with a sad trombone.
 */
export default function SandwichRain({ onClose }: { onClose: () => void }) {
  const [muted, setMuted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const music = useRef<Mariachi | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const finished = useRef(false);
  // The page behind re-renders while this is open; keeping the latest callback in a ref means the
  // music and timers below start once and are not restarted by those re-renders.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    music.current = startMariachi();
    closeButton.current?.focus();

    const wrapUp = setTimeout(() => {
      // Natural ending: the band stops with a sad trombone, then the overlay fades away.
      setLeaving(true);
      music.current?.stop(true);
      finished.current = true;
    }, LENGTH_MS);
    const remove = setTimeout(() => closeRef.current(), LENGTH_MS + FAREWELL_MS);

    return () => {
      clearTimeout(wrapUp);
      clearTimeout(remove);
      if (!finished.current) music.current?.stop(false);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Thank you, sandwichgodn7"
      onClick={onClose}
      className={`fixed inset-0 z-[100] cursor-pointer overflow-hidden bg-black/55 backdrop-blur-[1px] transition-opacity duration-700 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {PIECES.map((p, i) => (
          <span
            key={i}
            className="egg-piece"
            style={
              {
                "--x": p.x,
                "--y": p.y,
                "--size": p.size,
                "--dur": p.duration,
                "--delay": p.delay,
                "--drift": p.drift,
                "--spin": p.spin,
              } as React.CSSProperties
            }
          >
            {p.emoji}
          </span>
        ))}
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="egg-banner w-full max-w-3xl rounded-2xl border-2 border-accent-to bg-black/80 px-6 py-8 text-center shadow-2xl shadow-black/60 sm:px-10">
          <p className="text-lg font-extrabold sm:text-2xl">
            Thank you, number 1 tester and bug finder
          </p>
          <p className="egg-name mt-2 whitespace-nowrap font-[family-name:var(--font-display)] text-[clamp(1.6rem,8.4vw,3.75rem)] font-extrabold leading-tight">
            sandwichgodn7
          </p>
          <p className="mt-3 text-sm text-muted sm:text-base">
            You found the bugs. We owe you a sandwich. Several, actually.
          </p>
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-4 text-4xl sm:text-6xl"
      >
        {BAND.map((emoji, i) => (
          <span key={i} className="egg-band" style={{ animationDelay: `${i * 0.18}s` }}>
            {emoji}
          </span>
        ))}
      </div>

      <div
        className="absolute right-3 top-3 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => {
            music.current?.setMuted(!muted);
            setMuted(!muted);
          }}
          aria-pressed={muted}
          className="rounded-full border border-border bg-surface/90 px-4 py-2 text-sm font-bold hover:border-accent-to"
        >
          {muted ? "Unmute" : "Mute"}
        </button>
        <button
          ref={closeButton}
          type="button"
          onClick={onClose}
          className="rounded-full bg-accent-to px-4 py-2 text-sm font-bold text-[var(--on-accent)]"
        >
          Close
        </button>
      </div>
      <p className="pointer-events-none absolute inset-x-0 bottom-20 hidden text-center text-xs text-muted sm:block">
        Click anywhere to close
      </p>
    </div>
  );
}

"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import Image from "next/image";

export interface ReelPoster {
  mediaType: string;
  id: number;
  title: string;
  posterPath: string;
}

interface RouletteReelProps {
  items: ReelPoster[];
  /** Changes with every spin. The reel starts moving when this changes. */
  spinId: number;
  /** Index in `items` the reel lands on, in the middle of the window. */
  targetIndex: number;
  /** Frame that is in the middle of the window when the reel is at rest. */
  restIndex: number;
  onDone: () => void;
  /** Set to the spin number once the reel has landed, to flash the lit frame. 0 for no flash. */
  flash?: number;
}

const SPIN_MS = 5200;

// useLayoutEffect warns when the page is first built on the server, where it can't run anyway.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * A vertical strip of film. When it spins it starts fast and slows to a stop with the winner in the
 * lit frame in the middle, like a prize wheel. The motion is drawn by hand each frame, so the
 * blur can follow the speed.
 */
export default function RouletteReel({
  items,
  spinId,
  targetIndex,
  restIndex,
  onDone,
  flash = 0,
}: RouletteReelProps) {
  const strip = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const doneRef = useRef(onDone);
  const lastSpin = useRef(0);

  useEffect(() => {
    doneRef.current = onDone;
  });

  // At rest the reel sits with `restIndex` in the middle of the window.
  useIsoLayoutEffect(() => {
    const el = strip.current;
    if (!el || spinId === lastSpin.current) return;
    lastSpin.current = spinId;
    cancelAnimationFrame(frame.current);
    if (!spinId) return;

    const rowHeight = (el.firstElementChild as HTMLElement | null)?.offsetHeight ?? 190;
    const from = (restIndex - 1) * rowHeight;
    const to = (targetIndex - 1) * rowHeight;
    const set = (pos: number, blur = 0) => {
      el.style.transform = `translate3d(0, ${-pos}px, 0)`;
      el.style.filter = blur > 0.4 ? `blur(${blur.toFixed(1)}px)` : "none";
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      set(to);
      frame.current = requestAnimationFrame(() => doneRef.current());
      return;
    }

    const started = performance.now();
    const distance = to - from;
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / SPIN_MS);
      const eased = 1 - Math.pow(1 - t, 4); // fast at first, then slower and slower
      const speed = ((distance * 4 * Math.pow(1 - t, 3)) / SPIN_MS) * 1000; // pixels per second
      set(from + distance * eased, Math.min(4, speed / 1600));
      if (t < 1) frame.current = requestAnimationFrame(step);
      else doneRef.current();
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [spinId, targetIndex, restIndex]);

  // Whenever the frames change without a spin (a new category), park the reel at rest.
  useIsoLayoutEffect(() => {
    const el = strip.current;
    if (!el || spinId !== 0) return;
    const rowHeight = (el.firstElementChild as HTMLElement | null)?.offsetHeight ?? 190;
    el.style.transform = `translate3d(0, ${-(restIndex - 1) * rowHeight}px, 0)`;
    el.style.filter = "none";
  }, [items, restIndex, spinId]);

  return (
    <div className="roulette-window" aria-hidden>
      <div ref={strip} className="roulette-strip">
        {items.map((item, i) => (
          <div className="roulette-frame" key={`${item.mediaType}:${item.id}:${i}`}>
            <Image
              src={item.posterPath}
              alt=""
              width={150}
              height={225}
              loading="eager"
              className="roulette-poster"
            />
          </div>
        ))}
        {items.length === 0 &&
          Array.from({ length: 3 }).map((_, i) => (
            <div className="roulette-frame" key={i}>
              <span className="roulette-poster roulette-empty" />
            </div>
          ))}
      </div>
      <div key={flash} className={`roulette-payline${flash ? " roulette-win" : ""}`} />
    </div>
  );
}

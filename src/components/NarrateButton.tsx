"use client";

import { useEffect, useRef, useState } from "react";

type NarrateState = "idle" | "loading" | "playing";

interface NarrateButtonProps {
  script: string;
  autoPlayToken: number;
}

export default function NarrateButton({ script, autoPlayToken }: NarrateButtonProps) {
  const [state, setState] = useState<NarrateState>("idle");
  const [message, setMessage] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastAutoToken = useRef(0);

  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    setState("idle");
  }

  async function play() {
    setMessage("");
    setState("loading");
    try {
      const res = await fetch("/api/voice/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: script }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error ?? "Narration is unavailable right now.");
        setState("idle");
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setState("idle");
      };
      audioRef.current = audio;
      await audio.play();
      setState("playing");
    } catch {
      setMessage("Couldn't play the narration.");
      setState("idle");
    }
  }

  useEffect(() => {
    if (autoPlayToken > 0 && autoPlayToken !== lastAutoToken.current) {
      lastAutoToken.current = autoPlayToken;
      void play();
    }
    // Only a new token should trigger playback, not changes to play/script.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlayToken]);

  useEffect(() => () => audioRef.current?.pause(), []);

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={state === "idle" ? play : stop}
        disabled={state === "loading"}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium transition hover:border-accent-from disabled:opacity-60"
      >
        <span aria-hidden>{state === "playing" ? "■" : "🔊"}</span>
        {state === "loading"
          ? "Preparing audio..."
          : state === "playing"
            ? "Stop"
            : "Listen to my picks"}
      </button>
      {message && (
        <span role="status" className="text-[11px] text-muted">
          {message}
        </span>
      )}
    </div>
  );
}

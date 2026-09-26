"use client";

import { setVoiceReplies, useVoiceReplies } from "@/lib/voiceSetting";

export default function VoiceToggle() {
  const enabled = useVoiceReplies();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => setVoiceReplies(!enabled)}
      title={enabled ? "Voice replies are on" : "Turn on spoken replies"}
      className="flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-2 text-sm font-medium transition hover:border-accent-from"
    >
      <span aria-hidden>{enabled ? "🔊" : "🔈"}</span>
      <span className="hidden sm:inline">Voice replies</span>
      <span
        aria-hidden
        className={`relative h-5 w-9 rounded-full transition ${
          enabled ? "bg-gradient-to-r from-accent-from to-accent-to" : "bg-zinc-400/40"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
            enabled ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
      <span className="sr-only">{enabled ? "On" : "Off"}</span>
    </button>
  );
}

"use client";

import { useRef, useState, useSyncExternalStore } from "react";

const MAX_RECORDING_MS = 12000;

type MicState = "idle" | "recording" | "processing";

const subscribe = () => () => {};
const canRecord = () =>
  typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

function pickMimeType(): string | undefined {
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) =>
    MediaRecorder.isTypeSupported(t)
  );
}

interface MicButtonProps {
  onTranscript: (text: string) => void;
  disabled: boolean;
}

export default function MicButton({ onTranscript, disabled }: MicButtonProps) {
  const supported = useSyncExternalStore(subscribe, canRecord, () => false);
  const [state, setState] = useState<MicState>("idle");
  const [message, setMessage] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!supported) return null;

  async function upload(blob: Blob) {
    setState("processing");
    try {
      const form = new FormData();
      form.append("audio", blob);
      const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "Couldn't understand that. Try again.");
        return;
      }
      setMessage("");
      onTranscript(data.text);
    } catch {
      setMessage("Network error. Try again.");
    } finally {
      setState("idle");
    }
  }

  async function start() {
    setMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
        upload(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
      };

      recorderRef.current = recorder;
      recorder.start();
      setState("recording");
      stopTimerRef.current = setTimeout(() => recorder.stop(), MAX_RECORDING_MS);
    } catch {
      setMessage("Microphone access was blocked.");
      setState("idle");
    }
  }

  function stop() {
    recorderRef.current?.stop();
  }

  const recording = state === "recording";
  const processing = state === "processing";

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={disabled || processing}
        aria-label={recording ? "Stop recording" : "Search by voice"}
        title={recording ? "Tap to stop" : "Search by voice"}
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition active:scale-95 disabled:opacity-50 ${
          recording
            ? "animate-pulse border-red-500 bg-red-500 text-white"
            : "border-border bg-surface text-foreground hover:border-accent-from"
        }`}
      >
        {processing ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
          </svg>
        )}
      </button>
      {(message || recording) && (
        <span role="status" className="text-[11px] text-muted">
          {recording ? "Listening..." : message}
        </span>
      )}
    </div>
  );
}

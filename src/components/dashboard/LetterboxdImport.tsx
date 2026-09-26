"use client";

import { useRef, useState } from "react";

const SAMPLE_CSV = `Date,Name,Year,Letterboxd URI,Rating
2026-01-04,The Dark Knight,2008,,5
2026-01-09,Parasite,2019,,4.5
2026-01-15,Whiplash,2014,,4.5
2026-01-21,Blade Runner 2049,2017,,4
2026-02-02,Spirited Away,2001,,5
2026-02-11,Mad Max: Fury Road,2015,,4
2026-02-19,Everything Everywhere All at Once,2022,,4.5
2026-03-03,Get Out,2017,,4
2026-03-12,The Grand Budapest Hotel,2014,,3.5
2026-03-25,Arrival,2016,,4.5
2026-04-07,Knives Out,2019,,3.5
2026-04-18,Your Name.,2016,,4.5`;

interface Summary {
  imported: number;
  rated: number;
  unmatched: string[];
  truncated: boolean;
}

export default function LetterboxdImport({ onDone }: { onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function send(csv: string) {
    setBusy(true);
    setNote("");
    setError("");
    try {
      const res = await fetch("/api/watchlist/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Import failed. Try again.");
      const s = data as Summary;
      setNote(
        `Imported ${s.imported} films as watched (${s.rated} with your ratings).` +
          (s.unmatched.length ? ` Couldn't match: ${s.unmatched.slice(0, 5).join(", ")}.` : "") +
          (s.truncated ? " Some rows were skipped (import limit)." : ""),
      );
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    await send(await file.text());
    if (input.current) input.current.value = "";
  }

  return (
    <section className="mt-6 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">Import from Letterboxd</p>
          <p className="text-xs text-muted">
            In Letterboxd, go to Settings, Import &amp; Export, Export your data. Upload ratings.csv
            or watched.csv.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="rounded-full bg-gradient-to-r from-accent-from to-accent-to px-4 py-1.5 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Importing..." : "Choose CSV"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void send(SAMPLE_CSV)}
            className="rounded-full border border-border px-4 py-1.5 hover:border-accent-from disabled:opacity-50"
          >
            Try a sample
          </button>
        </div>
      </div>
      <div aria-live="polite">
        {note && <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{note}</p>}
        {error && (
          <p role="alert" className="mt-2 text-xs text-red-500">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

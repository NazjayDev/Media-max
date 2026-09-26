"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import RecommendationCard from "@/components/RecommendationCard";
import type { Recommendation } from "@/types/media";

interface Row {
  name: string;
  titles: string;
}

interface Result {
  people: { name: string; matched: string[]; unmatched: string[] }[];
  picks: (Recommendation & { fit: number[] })[];
  degraded: boolean;
}

const EXAMPLE: Row[] = [
  { name: "Alex", titles: "Inception, Interstellar, Dune" },
  { name: "Sam", titles: "Spirited Away, Your Name, Howl's Moving Castle" },
  { name: "Jo", titles: "Breaking Bad, Fargo, Better Call Saul" },
];
const BLANK: Row[] = [
  { name: "", titles: "" },
  { name: "", titles: "" },
];
const DOT_COLORS = ["bg-violet-500", "bg-sky-500", "bg-emerald-500", "bg-amber-500"];

const splitTitles = (text: string) =>
  text
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 4);

function parseShared(raw: string | null): Row[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { name?: unknown; titles?: unknown }[];
    const rows = parsed.slice(0, 4).map((p) => ({
      name: String(p.name ?? ""),
      titles: Array.isArray(p.titles) ? p.titles.join(", ") : "",
    }));
    return rows.length >= 2 ? rows : null;
  } catch {
    return null;
  }
}

function TogetherInner() {
  const router = useRouter();
  const params = useSearchParams();
  const shared = params.get("g");
  const [sharedRows] = useState(() => parseShared(shared));
  const [rows, setRows] = useState<Row[]>(sharedRows ?? BLANK);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const ranFor = useRef(false);

  const run = useCallback(
    async (input: Row[]) => {
      const people = input.map((r, i) => ({
        name: r.name.trim() || `Person ${i + 1}`,
        titles: splitTitles(r.titles),
      }));
      if (people.length < 2 || people.some((p) => p.titles.length === 0)) {
        setError("Give each person at least one favorite title.");
        return;
      }
      setBusy(true);
      setError("");
      setResult(null);
      router.replace(`/together?g=${encodeURIComponent(JSON.stringify(people))}`, {
        scroll: false,
      });
      try {
        const res = await fetch("/api/together", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ people }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
        setResult(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  // A shared link carries the group in ?g= and runs it once on load.
  useEffect(() => {
    if (!sharedRows || ranFor.current) return;
    ranFor.current = true;
    void run(sharedRows);
  }, [sharedRows, run]);

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the address bar already holds the link.
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-24 sm:px-8">
      <Link href="/" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
        &larr; Back to home
      </Link>
      <h1 className="bg-gradient-to-r from-accent-from to-accent-to bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
        Watch Together
      </h1>
      <p className="mt-2 max-w-xl text-muted">
        Everyone lists a few favorites. We find what the whole group will enjoy, ranked by the
        person it fits least, so nobody gets dragged along.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(rows);
        }}
        className="mt-6 flex flex-col gap-3"
      >
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3 sm:flex-row sm:items-center"
          >
            <div className="flex items-center gap-2 sm:w-40">
              <span aria-hidden className={`h-3 w-3 shrink-0 rounded-full ${DOT_COLORS[i]}`} />
              <input
                value={row.name}
                onChange={(e) => update(i, { name: e.target.value })}
                maxLength={24}
                placeholder={`Person ${i + 1}`}
                aria-label={`Name of person ${i + 1}`}
                className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-muted"
              />
            </div>
            <input
              value={row.titles}
              onChange={(e) => update(i, { titles: e.target.value })}
              placeholder="Favorites, separated by commas (up to 4)"
              aria-label={`Favorites of person ${i + 1}`}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent-from"
            />
            {rows.length > 2 && (
              <button
                type="button"
                onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                aria-label={`Remove person ${i + 1}`}
                className="self-end rounded-full px-2 text-muted hover:text-foreground sm:self-auto"
              >
                &times;
              </button>
            )}
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-2">
          {rows.length < 4 && (
            <button
              type="button"
              onClick={() => setRows((rs) => [...rs, { name: "", titles: "" }])}
              className="rounded-full border border-border px-4 py-2 text-sm hover:border-accent-from"
            >
              + Add person
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setRows(EXAMPLE);
              void run(EXAMPLE);
            }}
            className="rounded-full border border-border px-4 py-2 text-sm hover:border-accent-from"
          >
            Try an example group
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-gradient-to-r from-accent-from to-accent-to px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Blending..." : "Find our watch"}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-500">
          {error}
        </p>
      )}
      {busy && (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted" role="status">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent-from" />
          Blending everyone&apos;s taste...
        </p>
      )}

      {result && (
        <section className="mt-8" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold">Tonight, everyone will enjoy</h2>
            <button
              type="button"
              onClick={copyLink}
              className="rounded-full border border-border px-4 py-1.5 text-sm hover:border-accent-from"
            >
              {copied ? "Link copied" : "Copy shareable link"}
            </button>
          </div>
          {result.people.some((p) => p.unmatched.length > 0) && (
            <p className="mt-2 text-xs text-muted">
              Couldn&apos;t find: {result.people.flatMap((p) => p.unmatched).join(", ")}. Try the
              exact title.
            </p>
          )}
          {result.degraded && (
            <p className="mt-2 text-xs text-muted">
              Showing closest matches; explanations are unavailable right now.
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {result.picks.map((pick, i) => (
              <RecommendationCard
                key={`${pick.mediaType}:${pick.id}`}
                item={pick}
                index={i}
                footer={
                  <div className="mt-2 flex flex-col gap-1" aria-label="Fit for each person">
                    {result.people.map((p, n) => (
                      <div key={n} className="flex items-center gap-2 text-[11px] text-muted">
                        <span className="w-14 truncate">{p.name}</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-400/30">
                          <span
                            className={`block h-full rounded-full ${DOT_COLORS[n]}`}
                            style={{ width: `${pick.fit[n] ?? 0}%` }}
                          />
                        </span>
                        <span className="w-7 text-right">{pick.fit[n] ?? 0}</span>
                      </div>
                    ))}
                  </div>
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function TogetherPage() {
  return (
    <Suspense>
      <TogetherInner />
    </Suspense>
  );
}

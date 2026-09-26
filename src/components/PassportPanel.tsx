"use client";

import { useEffect, useState } from "react";

interface Stats {
  saved: number;
  watched: number;
  avgRating: number | null;
  topGenres: { name: string; count: number }[];
  archetype: string;
}

interface PassportInfo {
  asset: string;
  wallet: string;
  explorerUrl: string;
  txUrl: string | null;
  imageUrl: string;
  updatedAt: string;
}

interface PassportData {
  enabled: boolean;
  stats: Stats;
  minTitles: number;
  passport: PassportInfo | null;
}

interface InjectedSolana {
  connect: () => Promise<{ publicKey: { toString(): string } }>;
}

function injectedProvider(): InjectedSolana | null {
  const w = window as unknown as {
    phantom?: { solana?: InjectedSolana };
    solana?: InjectedSolana;
  };
  return w.phantom?.solana ?? w.solana ?? null;
}

const short = (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`;

export default function PassportPanel() {
  const [data, setData] = useState<PassportData | null>(null);
  const [failed, setFailed] = useState(false);
  const [wallet, setWallet] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/passport")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("passport failed"))))
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  async function connectWallet() {
    setMessage("");
    const provider = injectedProvider();
    if (!provider) {
      setMessage("No Solana wallet found. Install Phantom, or paste an address below.");
      return;
    }
    try {
      const res = await provider.connect();
      setWallet(res.publicKey.toString());
    } catch {
      setMessage("Wallet connection was cancelled.");
    }
  }

  async function act(url: string, body?: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(json.error ?? "Something went wrong. Try again.");
        return;
      }
      setNonce((n) => n + 1);
    } catch {
      setMessage("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (failed || !data) return null;

  const { stats, passport } = data;
  const ready = stats.saved >= data.minTitles;

  return (
    <section className="mt-14 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="passport-heading">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="passport-heading" className="text-xl font-bold">
            Taste Passport <span className="ml-1 rounded-md bg-accent-from/15 px-2 py-0.5 align-middle text-xs font-semibold text-accent-from dark:text-violet-300">Solana devnet</span>
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Mint a collectible to your own wallet that captures your taste from your watchlist:
            your archetype, top genres and viewing stats, stored as on-chain attributes.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          {passport ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={passport.imageUrl} alt={`Taste Passport: ${stats.archetype}`} className="w-full max-w-xs rounded-2xl border border-border" />
          ) : (
            <div className="rounded-xl border border-border p-4 text-sm">
              <p className="font-semibold">{stats.archetype}</p>
              <p className="mt-1 text-muted">
                {stats.saved} saved, {stats.watched} watched
                {stats.avgRating !== null ? `, ${stats.avgRating}/5 average rating` : ""}
              </p>
              {stats.topGenres.length > 0 && (
                <p className="mt-1 text-muted">Top genres: {stats.topGenres.map((g) => g.name).join(", ")}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 text-sm">
          {!data.enabled ? (
            <p className="text-muted">Minting isn&apos;t enabled on this deployment yet.</p>
          ) : passport ? (
            <>
              <p>
                Minted to <span className="font-mono">{short(passport.wallet)}</span>.
              </p>
              <div className="flex flex-wrap gap-2">
                <a href={passport.explorerUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-border px-4 py-2 font-medium hover:border-accent-from">
                  View on Solana Explorer
                </a>
                {passport.txUrl && (
                  <a href={passport.txUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-border px-4 py-2 font-medium hover:border-accent-from">
                    Mint transaction
                  </a>
                )}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => act("/api/passport/update")}
                className="self-start rounded-full bg-gradient-to-r from-accent-from to-accent-to px-5 py-2.5 font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Updating on-chain..." : "Update with my latest taste"}
              </button>
            </>
          ) : !ready ? (
            <p className="text-muted">
              Save at least {data.minTitles} titles to mint your passport. You have {stats.saved}.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={connectWallet}
                className="self-start rounded-full border border-border px-4 py-2 font-medium hover:border-accent-from"
              >
                Connect Phantom
              </button>
              <label className="flex flex-col gap-1">
                <span className="text-muted">Or paste a Solana address</span>
                <input
                  value={wallet}
                  onChange={(e) => setWallet(e.target.value.trim())}
                  placeholder="Your wallet address"
                  spellCheck={false}
                  className="rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-accent-from"
                />
              </label>
              <button
                type="button"
                disabled={busy || wallet.length < 32}
                onClick={() => act("/api/passport/mint", { wallet })}
                className="self-start rounded-full bg-gradient-to-r from-accent-from to-accent-to px-5 py-2.5 font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Minting on Solana..." : "Mint my Taste Passport"}
              </button>
              <p className="text-xs text-muted">
                Free: the app pays the devnet fee. Only your public address is used.
              </p>
            </>
          )}
          {message && (
            <p role="alert" className="text-red-600 dark:text-red-400">
              {message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

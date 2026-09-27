"use client";

import { useState } from "react";
import Image from "next/image";
import TitleCombobox from "@/components/TitleCombobox";
import { MAX_FAVORITES, type ProfileFavorite } from "@/lib/profileTypes";

interface FavoritesEditorProps {
  initial: ProfileFavorite[];
  onSaved: (favorites: ProfileFavorite[]) => void;
}

/** Lets someone pick up to 3 favorite titles for their profile, the same picker as Watch Together. */
export default function FavoritesEditor({ initial, onSaved }: FavoritesEditorProps) {
  const [favorites, setFavorites] = useState<ProfileFavorite[]>(initial);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(next: ProfileFavorite[]) {
    setFavorites(next);
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorites: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't save your favorites.");
      onSaved(data.favorites);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your favorites.");
    } finally {
      setSaving(false);
    }
  }

  const full = favorites.length >= MAX_FAVORITES;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold">
        Your top {MAX_FAVORITES}
        <span className="ml-2 font-normal text-muted">Shown on your profile</span>
      </p>
      {favorites.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {favorites.map((f, i) => (
            <li
              key={`${f.mediaType}:${f.id}`}
              className="flex items-center gap-2 rounded-md border border-border bg-surface py-1 pl-1 pr-2 text-sm"
            >
              <span className="relative h-12 w-8 shrink-0 overflow-hidden rounded-[2px] bg-zinc-800">
                {f.posterPath && (
                  <Image src={f.posterPath} alt="" fill sizes="32px" className="object-cover" />
                )}
              </span>
              <span className="max-w-[10rem] truncate">{f.title}</span>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save(favorites.filter((_, n) => n !== i))}
                aria-label={`Remove ${f.title} from favorites`}
                className="rounded-full px-1 text-muted hover:text-foreground"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}
      <TitleCombobox
        value={draft}
        onChange={setDraft}
        onPick={(t) => {
          setDraft("");
          void save(
            [
              ...favorites,
              { mediaType: t.mediaType, id: t.id, title: t.title, posterPath: t.posterPath },
            ].slice(0, MAX_FAVORITES),
          );
        }}
        disabled={full || saving}
        maxLength={80}
        placeholder={
          full ? `${MAX_FAVORITES} favorites added` : "Search a favorite movie, show or anime..."
        }
        ariaLabel="Add a favorite"
        className="w-full max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent-from disabled:opacity-60"
      />
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

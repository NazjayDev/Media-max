"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import FavoritesEditor from "@/components/FavoritesEditor";
import type { ProfileFavorite } from "@/lib/profileTypes";
import type { MediaType } from "@/types/media";

interface TopPost {
  id: string;
  body: string;
  spoiler: boolean;
  likes: number;
  createdAt: string;
  title: { mediaType: MediaType; id: number; title: string; posterPath: string | null };
}

interface ProfileData {
  username: string;
  favorites: ProfileFavorite[];
  memberSince: string;
  topPosts: TopPost[];
}

function Avatar({ name }: { name: string }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span
      aria-hidden
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white sm:h-20 sm:w-20"
      style={{ backgroundColor: `hsl(${hash} 55% 42%)` }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function PostBody({ post }: { post: TopPost }) {
  const [revealed, setRevealed] = useState(false);
  if (post.spoiler && !revealed) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
        <span aria-hidden>🙈</span>
        <span className="text-amber-300">This post contains spoilers.</span>
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="rounded-full border border-amber-500/60 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
        >
          Show anyway
        </button>
      </div>
    );
  }
  return <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{post.body}</p>;
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  // Keying by username remounts this on navigation between two profiles, so state starts fresh.
  return <ProfileView key={username} username={username} />;
}

function ProfileView({ username }: { username: string }) {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [ownUsername, setOwnUsername] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/users/${encodeURIComponent(username)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => !cancelled && setProfile(data))
      .catch(() => !cancelled && setNotFound(true));
    return () => {
      cancelled = true;
    };
  }, [username]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => !cancelled && setOwnUsername(data?.username ?? null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [status]);

  const isOwn = !!ownUsername && ownUsername.toLowerCase() === username.toLowerCase();

  if (notFound) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-24 text-center sm:px-8">
        <Link href="/people" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
          &larr; Back to search
        </Link>
        <p className="rounded-lg border border-border bg-surface px-6 py-10">
          No one goes by <strong>{username}</strong> here.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-24 sm:px-8">
      <Link href="/people" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
        &larr; Find people
      </Link>

      {!profile ? (
        <div className="animate-pulse">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-surface sm:h-20 sm:w-20" />
            <div className="h-6 w-40 rounded bg-surface" />
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Avatar name={profile.username} />
            <div>
              <h1 className="text-2xl font-extrabold sm:text-3xl">{profile.username}</h1>
              <p className="text-sm text-muted">
                Member since{" "}
                {new Date(profile.memberSince).toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          <section className="mt-8">
            <h2 className="text-lg font-extrabold">Top picks</h2>
            {isOwn ? (
              <div className="mt-3">
                <FavoritesEditor
                  initial={profile.favorites}
                  onSaved={(favorites) => setProfile((p) => (p ? { ...p, favorites } : p))}
                />
              </div>
            ) : profile.favorites.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Hasn&apos;t picked any favorites yet.</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-3">
                {profile.favorites.map((f) => (
                  <li key={`${f.mediaType}:${f.id}`}>
                    <Link
                      href={`/title/${f.mediaType}/${f.id}`}
                      className="group block w-24 sm:w-28"
                      aria-label={f.title}
                      title={f.title}
                    >
                      <span className="relative block aspect-[2/3] overflow-hidden rounded-md bg-zinc-800 ring-1 ring-border transition group-hover:ring-2 group-hover:ring-accent-to">
                        {f.posterPath && (
                          <Image
                            src={f.posterPath}
                            alt=""
                            fill
                            sizes="112px"
                            className="object-cover"
                          />
                        )}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted">{f.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-extrabold">Top posts</h2>
            {profile.topPosts.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Hasn&apos;t posted in any discussions yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-4">
                {profile.topPosts.map((post) => (
                  <li
                    key={post.id}
                    className="flex gap-3 rounded-lg border border-border bg-surface p-3"
                  >
                    <Link
                      href={`/title/${post.title.mediaType}/${post.title.id}`}
                      className="relative block h-16 w-11 shrink-0 overflow-hidden rounded-[2px] bg-zinc-800 ring-1 ring-border"
                      aria-label={`Open ${post.title.title}`}
                    >
                      {post.title.posterPath && (
                        <Image
                          src={post.title.posterPath}
                          alt=""
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/title/${post.title.mediaType}/${post.title.id}`}
                        className="text-sm font-semibold hover:underline"
                      >
                        {post.title.title}
                      </Link>
                      <PostBody post={post} />
                      <p className="mt-1 text-xs text-muted">
                        {post.likes} {post.likes === 1 ? "like" : "likes"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {isOwn && session?.user?.email && (
            <p className="mt-8 text-xs text-muted">
              Only you can see and edit your favorites here. Everyone else sees this page exactly as
              shown above.
            </p>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useWatchlist } from "@/components/Providers";

export default function AuthButton() {
  const { data: session, status } = useSession();
  const { items } = useWatchlist();

  if (status === "loading") {
    return <div className="h-9 w-24" aria-hidden />;
  }

  if (!session?.user) {
    return (
      <button
        type="button"
        onClick={() => signIn("google")}
        className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium transition hover:border-accent-from"
      >
        Sign in with Google
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <Link
        href="/watchlist"
        className="rounded-full border border-border bg-surface px-4 py-2 font-medium transition hover:border-accent-from"
      >
        My watchlist{items.length > 0 ? ` (${items.length})` : ""}
      </Link>
      {session.user.image && (
        <Image
          src={session.user.image}
          alt={session.user.name ?? "Your profile"}
          width={32}
          height={32}
          referrerPolicy="no-referrer"
          className="rounded-full ring-1 ring-border"
        />
      )}
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="text-muted underline-offset-2 hover:text-foreground hover:underline"
      >
        Sign out
      </button>
    </div>
  );
}

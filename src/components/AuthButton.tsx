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
    <div className="flex items-center gap-2 text-sm sm:gap-3">
      <Link
        href="/dashboard"
        className="whitespace-nowrap rounded-full border border-border bg-surface px-2.5 py-2 font-medium transition hover:border-accent-from sm:px-4"
      >
        <span className="sm:hidden">Dashboard</span>
        <span className="hidden sm:inline">My dashboard</span>
        {items.length > 0 && <span className="hidden sm:inline"> ({items.length})</span>}
      </Link>
      {session.user.image && (
        <Image
          src={session.user.image}
          alt={session.user.name ?? "Your profile"}
          width={32}
          height={32}
          referrerPolicy="no-referrer"
          className="hidden rounded-full ring-1 ring-border sm:block"
        />
      )}
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="whitespace-nowrap text-muted underline-offset-2 hover:text-foreground hover:underline"
      >
        Sign out
      </button>
    </div>
  );
}

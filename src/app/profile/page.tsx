"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import UsernameForm from "@/components/discussion/UsernameForm";

/** "My profile": resolves your username and takes you to it, or asks you to pick one first. */
export default function MyProfilePage() {
  const router = useRouter();
  const { status } = useSession();
  const [username, setUsername] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : { username: null }))
      .then((data) => !cancelled && setUsername(data.username))
      .catch(() => !cancelled && setUsername(null));
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (username) router.replace(`/u/${encodeURIComponent(username)}`);
  }, [username, router]);

  if (status === "loading" || (status === "authenticated" && username === undefined)) {
    return <div className="mx-auto w-full max-w-md px-4 pb-16 pt-24 sm:px-8" />;
  }

  if (status !== "authenticated") {
    return (
      <div className="mx-auto w-full max-w-md px-4 pb-16 pt-24 text-center sm:px-8">
        <p className="text-muted">Sign in to set up your profile.</p>
        <button
          type="button"
          onClick={() => signIn("google")}
          className="mt-4 rounded-full bg-gradient-to-r from-accent-from to-accent-to px-6 py-2.5 font-semibold"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-16 pt-24 sm:px-8">
      <Link href="/" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
        &larr; Back to home
      </Link>
      <h1 className="text-2xl font-extrabold">Choose a username</h1>
      <p className="mt-2 text-sm text-muted">
        It&apos;s the only name people see on your profile and your discussion posts.
      </p>
      <div className="mt-5">
        <UsernameForm
          initial=""
          submitLabel="Save username"
          onSaved={(name) => router.replace(`/u/${encodeURIComponent(name)}`)}
        />
      </div>
    </div>
  );
}

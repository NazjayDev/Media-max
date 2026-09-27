"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import UsernameForm from "@/components/discussion/UsernameForm";

/**
 * Prompts a signed-in person to pick a username, as part of finishing sign-up, not only when they
 * open a discussion. Skipped on pages that already ask for it themselves (a title's discussion,
 * or the dedicated /profile setup page), so nobody sees the prompt twice.
 */
export default function GlobalUsernamePrompt() {
  const { status } = useSession();
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const checked = useRef(false);
  const [needsUsername, setNeedsUsername] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || checked.current) return;
    checked.current = true;
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setNeedsUsername(data?.username === null))
      .catch(() => {});
  }, [status]);

  const skipHere = pathname.startsWith("/title/") || pathname.startsWith("/profile");

  useEffect(() => {
    if (needsUsername && !skipHere) dialog.current?.showModal();
    else dialog.current?.close();
  }, [needsUsername, skipHere]);

  if (!needsUsername || skipHere) return null;

  return (
    <dialog
      ref={dialog}
      aria-labelledby="username-setup-title"
      onClose={() => setNeedsUsername(false)}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-6 text-foreground shadow-2xl backdrop:bg-black/70"
    >
      <h2 id="username-setup-title" className="text-xl font-extrabold">
        Welcome to Media Max
      </h2>
      <p className="mt-1 text-sm text-muted">
        Pick a username to finish setting up your profile. It&apos;s the only name shown on your
        posts and profile, never the name on your Google account.
      </p>
      <div className="mt-4">
        <UsernameForm
          initial=""
          submitLabel="Save username"
          onSaved={() => setNeedsUsername(false)}
          onCancel={() => dialog.current?.close()}
        />
      </div>
    </dialog>
  );
}

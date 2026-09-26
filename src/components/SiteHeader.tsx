"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { useWatchlist } from "@/components/Providers";
import VoiceToggle from "@/components/VoiceToggle";

const LINKS = [
  { href: "/ask", label: "Ask Media Max" },
  { href: "/together", label: "Watch Together" },
  { href: "/community", label: "Community" },
  { href: "/trending", label: "Trending" },
  { href: "/dashboard", label: "My dashboard" },
];

const iconButton =
  "flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface/80 backdrop-blur transition hover:border-accent-from";

function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M4.5 20c.9-3.6 3.9-5.5 7.5-5.5s6.6 1.9 7.5 5.5" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

/** Logo on the left; profile and menu on the right. Every page sits under this bar. */
export default function SiteHeader() {
  const { data: session, status } = useSession();
  const { items } = useWatchlist();
  const pathname = usePathname();
  // The menu is open only for the page it was opened on, so navigating closes it without an effect.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpenFor(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onPointer = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const user = session?.user;

  return (
    <header className="absolute inset-x-0 top-0 z-40 flex items-start justify-between px-4 py-4 sm:px-8">
      <Link href="/" aria-label="Media Max home" className="shrink-0 rounded-xl">
        <Image
          src="/brand/mediamax-icon-128.png"
          alt="Media Max"
          width={56}
          height={56}
          priority
          unoptimized
          className="h-12 w-12 sm:h-14 sm:w-14"
        />
      </Link>

      <div ref={wrapper} className="relative flex items-center gap-2">
        {status !== "loading" &&
          (user ? (
            <Link
              href="/dashboard"
              aria-label="Your dashboard"
              className={`${iconButton} overflow-hidden p-0`}
            >
              {user.image ? (
                <Image
                  src={user.image}
                  alt=""
                  width={44}
                  height={44}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserIcon />
              )}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => signIn("google")}
              aria-label="Sign in with Google"
              title="Sign in"
              className={iconButton}
            >
              <UserIcon />
            </button>
          ))}

        <button
          type="button"
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label="Menu"
          onClick={() => setOpenFor(open ? null : pathname)}
          className={iconButton}
        >
          <MenuIcon />
        </button>

        {open && (
          <nav
            id="site-menu"
            aria-label="Site"
            className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border bg-surface p-2 shadow-2xl shadow-black/60"
          >
            <ul className="flex flex-col">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition hover:bg-accent-from/15"
                  >
                    {link.label}
                    {link.href === "/dashboard" && items.length > 0 && (
                      <span className="text-xs font-medium text-muted">{items.length}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
              <VoiceToggle />
              {user ? (
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="rounded-lg px-3 py-2.5 text-left text-sm text-muted transition hover:bg-accent-from/15 hover:text-foreground"
                >
                  Sign out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => signIn("google")}
                  className="rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-accent-from/15"
                >
                  Sign in with Google
                </button>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}

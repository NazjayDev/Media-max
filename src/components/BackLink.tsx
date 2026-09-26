"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBackLabel } from "@/lib/lastSearch";

/**
 * Goes back to whatever page you came from, so coming back from a title reopens your search results
 * (or the Browse list) exactly as you left them. If there's nothing to go back to, it opens home.
 */
export default function BackLink({ className }: { className?: string }) {
  const router = useRouter();
  const label = useBackLabel();
  return (
    <Link
      href="/"
      onClick={(e) => {
        if (window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
      className={className}
    >
      &larr; {label}
    </Link>
  );
}

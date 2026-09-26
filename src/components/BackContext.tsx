"use client";

import { useEffect } from "react";
import { loadLastSearch, setBackLabel } from "@/lib/lastSearch";

/** Where a title's Back button leads, by the page the title was opened from. */
function labelFor(path: string): string {
  if (path === "/") return loadLastSearch() ? "Back to results" : "Back to home";
  if (path.startsWith("/browse")) return "Back to Browse";
  if (path.startsWith("/search")) return "Back to search";
  if (path.startsWith("/community")) return "Back to Community";
  if (path.startsWith("/trending")) return "Back to Trending";
  if (path.startsWith("/dashboard")) return "Back to your dashboard";
  if (path.startsWith("/together")) return "Back to Watch Together";
  return "Back";
}

/** Notes which page a title is opened from, so its Back button can name where it returns to. */
export default function BackContext() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href^="/title/"]');
      if (link) setBackLabel(labelFor(window.location.pathname));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}

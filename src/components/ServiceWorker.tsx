"use client";

import { useEffect } from "react";

/** Registers the offline-page service worker that lets phones install the site as an app. */
export default function ServiceWorker() {
  useEffect(() => {
    // Only in the deployed site, so local development never sees a service worker.
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // The site works fine without it; installing just becomes a plain shortcut.
    });
  }, []);
  return null;
}

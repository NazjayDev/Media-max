"use client";

import { useEffect } from "react";
import { captureInstallPrompt } from "@/lib/installPrompt";

/** Registers the offline-page service worker and catches the browser's "can be installed" signal. */
export default function ServiceWorker() {
  useEffect(() => {
    // Always listen for the browser's install signal, in development too.
    captureInstallPrompt();
  }, []);

  useEffect(() => {
    // Only in the deployed site, so local development never sees a service worker.
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // The site works fine without it; installing just becomes a plain shortcut.
    });
  }, []);
  return null;
}

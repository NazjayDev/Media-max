"use client";

import { useSyncExternalStore } from "react";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

/**
 * Browsers send one "this site can be installed" signal shortly after the page loads. It has to be
 * caught right then and kept, because the menu that offers the install button usually opens later.
 */
let deferred: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Starts listening for the install signal. Call once, from something that is always mounted. */
export function captureInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export type Platform = "installed" | "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone || installed) return "installed";
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return "ios";
  if (/Android/.test(navigator.userAgent)) return "android";
  return "desktop";
}

/** What the install menu item should do on this device. `canPrompt` means one tap installs it. */
export function useInstallState(): { platform: Platform; canPrompt: boolean; install: () => void } {
  const platform = useSyncExternalStore(subscribe, detectPlatform, () => "desktop" as Platform);
  const canPrompt = useSyncExternalStore(
    subscribe,
    () => deferred !== null,
    () => false,
  );
  return { platform, canPrompt, install: () => void deferred?.prompt() };
}

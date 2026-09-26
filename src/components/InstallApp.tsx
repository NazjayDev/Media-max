"use client";

import { useEffect, useState } from "react";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

/**
 * Menu item that installs the site as a phone app. Android and desktop Chrome offer a real
 * install prompt; iPhones do not, so they get instructions. Hidden once already installed.
 */
export default function InstallApp() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "other" | "installed">("other");

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    // Set once on load from browser facts that can't be known during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(standalone ? "installed" : ios ? "ios" : "other");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    };
    const onInstalled = () => setPlatform("installed");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (platform === "installed") return null;

  if (installEvent) {
    return (
      <button
        type="button"
        onClick={() => void installEvent.prompt()}
        className="rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-accent-from/15"
      >
        Install app
      </button>
    );
  }

  if (platform === "ios") {
    return (
      <div className="px-3 py-2">
        <button
          type="button"
          aria-expanded={showHelp}
          onClick={() => setShowHelp((v) => !v)}
          className="text-left text-sm font-semibold"
        >
          Add to Home Screen
        </button>
        {showHelp && (
          <p className="mt-1 text-xs leading-5 text-muted">
            In Safari, tap the Share button, then choose Add to Home Screen.
          </p>
        )}
      </div>
    );
  }

  return null;
}

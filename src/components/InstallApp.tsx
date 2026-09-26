"use client";

import { useState } from "react";
import { useInstallState, type Platform } from "@/lib/installPrompt";

const HELP: Record<Exclude<Platform, "installed">, string> = {
  ios: "In Safari, tap the Share button, then choose Add to Home Screen.",
  android: "Open your browser menu (the three dots), then tap Install app or Add to Home screen.",
  desktop:
    "In Chrome or Edge, click the install icon at the right end of the address bar, or open the browser menu and choose Install.",
};

/**
 * Menu item that puts Media Max on the home screen. Where the browser allows a one-tap install it
 * does that; otherwise it shows short steps for the device. Hidden once the app is installed.
 */
export default function InstallApp() {
  const { platform, canPrompt, install } = useInstallState();
  const [showHelp, setShowHelp] = useState(false);

  if (platform === "installed") return null;

  return (
    <div>
      <button
        type="button"
        aria-expanded={canPrompt ? undefined : showHelp}
        onClick={() => (canPrompt ? install() : setShowHelp((v) => !v))}
        className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-accent-from/15"
      >
        Install app
      </button>
      {!canPrompt && showHelp && (
        <p className="px-3 pb-2 text-xs leading-5 text-muted">{HELP[platform]}</p>
      )}
    </div>
  );
}

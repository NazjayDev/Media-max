import { useSyncExternalStore } from "react";

const STORAGE_KEY = "mediamax:voice-replies";
const CHANGE_EVENT = "mediamax:voice-replies-change";

function read(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function setVoiceReplies(enabled: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Storage can be blocked; the setting then just won't persist.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Whether spoken replies are enabled. Off by default and on the server. */
export function useVoiceReplies(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

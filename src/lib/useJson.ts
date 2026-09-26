import { useEffect, useState } from "react";

interface JsonState<T> {
  key: string;
  data: T | null;
  failed: boolean;
}

/**
 * Fetches JSON for a client component. Pass null to skip fetching. Bumping `refreshKey` refetches
 * (bypassing the browser cache), and stale results from a previous URL are never returned.
 */
export function useJson<T>(url: string | null, refreshKey = 0) {
  const key = `${url}#${refreshKey}`;
  const [state, setState] = useState<JsonState<T> | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url, refreshKey > 0 ? { cache: "no-store" } : undefined)
      .then((res) =>
        res.ok ? (res.json() as Promise<T>) : Promise.reject(new Error(String(res.status))),
      )
      .then((data) => {
        if (!cancelled) setState({ key, data, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ key, data: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [url, refreshKey, key]);

  const current = state?.key === key ? state : null;
  return {
    data: current?.data ?? null,
    failed: current?.failed ?? false,
    loading: !!url && !current,
  };
}

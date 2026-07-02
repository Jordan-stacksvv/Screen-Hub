import { useCallback, useEffect, useState } from "react";

// Per-machine recents / favorites, stored in localStorage. Renderer-only.
function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function write<T>(key: string, val: T) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* noop */ }
}

export function useRecent(key: string, max = 8) {
  const [items, setItems] = useState<string[]>(() => read<string[]>(`screenhub.recent.${key}`, []));
  const push = useCallback((id: string) => {
    setItems((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, max);
      write(`screenhub.recent.${key}`, next);
      return next;
    });
  }, [key, max]);
  const clear = useCallback(() => { write(`screenhub.recent.${key}`, []); setItems([]); }, [key]);
  return { items, push, clear };
}

export function useFavorites(key: string) {
  const storageKey = `screenhub.fav.${key}`;
  const [items, setItems] = useState<string[]>(() => read<string[]>(storageKey, []));
  const toggle = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      write(storageKey, next);
      return next;
    });
  }, [storageKey]);
  const has = useCallback((id: string) => items.includes(id), [items]);
  return { items, toggle, has };
}

// Bridge for online/offline transitions with query invalidation.
export function useNetworkStatus(onOnline?: () => void) {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const up = () => { setOnline(true); onOnline?.(); };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, [onOnline]);
  return online;
}

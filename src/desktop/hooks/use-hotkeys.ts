import { useEffect } from "react";

// Bind Ctrl/Cmd-based shortcuts. Ignores when typing in inputs.
export function useHotkeys(map: Record<string, () => void>) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = `${mod ? "mod+" : ""}${e.shiftKey ? "shift+" : ""}${e.key.toLowerCase()}`;
      const fn = map[key];
      if (fn) { e.preventDefault(); fn(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [map]);
}

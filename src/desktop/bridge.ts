// Typed wrapper around window.screenhub with a no-op browser shim so
// desktop routes render identically in dev and packaged builds.
export type NativeFile = { path: string; name: string; size: number };

type Bridge = {
  isDesktop: boolean;
  platform: string;
  pickFiles: (opts?: { title?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<NativeFile[]>;
  notify: (p: { title: string; body?: string }) => void;
  openExternal: (url: string) => void;
  contextMenu: (items: { id?: string; label?: string; type?: "separator"; enabled?: boolean }[]) => Promise<string | null>;
  tray: { setStatus: (status: "online" | "offline" | "degraded", count?: number) => void };
  onNavigate: (cb: (path: string) => void) => () => void;
};

declare global { interface Window { screenhub?: Bridge } }

const shim: Bridge = {
  isDesktop: false,
  platform: typeof navigator !== "undefined" ? navigator.platform : "web",
  pickFiles: async () => [],
  notify: () => undefined,
  openExternal: (url) => { if (typeof window !== "undefined") window.open(url, "_blank"); },
  contextMenu: async () => null,
  tray: { setStatus: () => undefined },
  onNavigate: () => () => undefined,
};

export function bridge(): Bridge {
  if (typeof window === "undefined") return shim;
  const b = window.screenhub;
  return b ? { ...b, isDesktop: true } : shim;
}

export const isDesktopApp = typeof window !== "undefined" && !!window.screenhub;

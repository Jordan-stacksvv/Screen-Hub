// Production browser-based device client.
// - Persistent identity in localStorage; pairing flow when unprovisioned.
// - Fullscreen playback for Images, Videos, PDFs, URLs, and Playlists.
// - Idle state shows the ScreenHub logo, device name, online/heartbeat status.
// - Handles: open_url, show_image, play_video, show_pdf, play_playlist,
//   stop_playback, refresh_device, reload_content, reboot.
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2, Maximize2, MonitorPlay, RefreshCcw, Tv, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/client")({ component: ClientPage });

type Identity = { device_id: string; device_name: string; registration_token: string };
type Cmd = { id: string; command_type: string; payload: Record<string, unknown> };
type ContentType = "url" | "image" | "video" | "pdf";
type PlayItem = { url: string; type: ContentType; duration_seconds: number; title?: string };
type Playlist = {
  id: string; name: string; loop_enabled: boolean;
  playlist_items: { id: string; position: number; duration_seconds: number; content: { id: string; title: string; content_type: ContentType; file_url: string } }[];
} | null;

const LS_IDENTITY = "screenhub.client.identity";
const LS_LAST_CONTENT = "screenhub.client.lastContent";

function loadIdentity(): Identity | null {
  try { const raw = localStorage.getItem(LS_IDENTITY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveIdentity(i: Identity) { localStorage.setItem(LS_IDENTITY, JSON.stringify(i)); }
function genCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function ClientPage() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [lastBeat, setLastBeat] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [content, setContent] = useState<PlayItem | null>(null);
  const [playlist, setPlaylist] = useState<Playlist>(null);
  const [playlistIdx, setPlaylistIdx] = useState(0);
  const [contentError, setContentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const backoffRef = useRef(1000);
  const onlineRef = useRef(false);

  useEffect(() => { setIdentity(loadIdentity()); }, []);
  useEffect(() => { onlineRef.current = online; }, [online]);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  // Restore last content across reloads (SSR-safe: run in effect only)
  useEffect(() => {
    try { const raw = localStorage.getItem(LS_LAST_CONTENT); if (raw) setContent(JSON.parse(raw)); } catch { /* noop */ }
  }, []);

  const setNextContent = useCallback((next: PlayItem | null) => {
    setContentError(null);
    setContent(next);
    if (next) localStorage.setItem(LS_LAST_CONTENT, JSON.stringify(next));
    else localStorage.removeItem(LS_LAST_CONTENT);
  }, []);

  const ack = useCallback(async (cmdId: string, success: boolean) => {
    if (!identity) return;
    try {
      await fetch("/api/public/devices/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${identity.registration_token}` },
        body: JSON.stringify({ command_id: cmdId, success }),
      });
    } catch { /* retry on next heartbeat */ }
  }, [identity]);

  const loadPlaylistById = useCallback(async (playlistId: string) => {
    const { data } = await supabase
      .from("playlists")
      .select("id, name, loop_enabled, playlist_items(id, position, duration_seconds, content(id, title, content_type, file_url))")
      .eq("id", playlistId).maybeSingle();
    if (data) { setPlaylist(data as Playlist); setPlaylistIdx(0); }
  }, []);

  const applyCommand = useCallback(async (c: Cmd) => {
    const target = (c.payload?.target as string) ?? "";
    const typeMap: Record<string, ContentType> = { open_url: "url", show_image: "image", play_video: "video", show_pdf: "pdf" };
    const t = typeMap[c.command_type];
    if (t && target) {
      setPlaylist(null);
      setNextContent({ type: t, url: target, duration_seconds: 0 });
    } else if (c.command_type === "play_playlist" && c.payload?.playlist_id) {
      await loadPlaylistById(String(c.payload.playlist_id));
    } else if (c.command_type === "stop_playback") {
      setPlaylist(null); setNextContent(null);
    } else if (c.command_type === "reload_content") {
      setContent((prev) => (prev ? { ...prev } : prev));
    } else if (c.command_type === "refresh_device" || c.command_type === "reboot") {
      setTimeout(() => window.location.reload(), 400);
    }
    ack(c.id, true);
  }, [ack, loadPlaylistById, setNextContent]);

  // Heartbeat loop
  useEffect(() => {
    if (!identity) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const beat = async () => {
      try {
        const res = await fetch("/api/public/devices/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${identity.registration_token}` },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json() as {
          commands: Cmd[]; playlist: Playlist;
          scheduled_content: { id: string; content_type: ContentType; file_url: string } | null;
        };
        setOnline(true);
        setLastBeat(new Date());
        backoffRef.current = 1000;
        for (const c of data.commands ?? []) await applyCommand(c);
        if (data.scheduled_content) {
          setPlaylist(null);
          setNextContent({ type: data.scheduled_content.content_type, url: data.scheduled_content.file_url, duration_seconds: 0 });
        } else if (data.playlist && data.playlist.playlist_items?.length) {
          setPlaylist(data.playlist);
        }
      } catch {
        setOnline(false);
        backoffRef.current = Math.min(backoffRef.current * 2, 30000);
      }
      if (!cancelled) timer = setTimeout(beat, onlineRef.current ? 30000 : backoffRef.current);
    };

    beat();
    return () => { cancelled = true; clearTimeout(timer!); };
  }, [identity, applyCommand, setNextContent]);

  // Realtime command channel (instant delivery)
  useEffect(() => {
    if (!identity) return;
    const ch = supabase.channel(`client-${identity.device_id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "commands", filter: `device_id=eq.${identity.device_id}` },
        (p) => applyCommand(p.new as unknown as Cmd))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [identity, applyCommand]);

  // Playlist rotation
  useEffect(() => {
    if (!playlist || !playlist.playlist_items.length) return;
    const items = [...playlist.playlist_items].sort((a, b) => a.position - b.position);
    const item = items[playlistIdx % items.length];
    if (!item) return;
    setNextContent({
      type: item.content.content_type, url: item.content.file_url,
      duration_seconds: Math.max(2, item.duration_seconds), title: item.content.title,
    });
    const t = setTimeout(() => {
      const nextIdx = playlistIdx + 1;
      if (!playlist.loop_enabled && nextIdx >= items.length) return;
      setPlaylistIdx(nextIdx);
    }, Math.max(2, item.duration_seconds) * 1000);
    return () => clearTimeout(t);
  }, [playlist, playlistIdx, setNextContent]);

  // Pairing flow
  useEffect(() => {
    if (identity || pairCode) return;
    setPairCode(genCode());
  }, [identity, pairCode]);
  useEffect(() => {
    if (identity || !pairCode) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/public/devices/pair", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: pairCode, device_name: `Browser ${navigator.platform}`, device_type: "other", operating_system: navigator.userAgent.slice(0, 100) }),
        });
        const data = await res.json();
        if (data.status === "claimed") {
          const id = { device_id: data.device_id, device_name: data.device_name, registration_token: data.registration_token };
          saveIdentity(id); if (!cancelled) setIdentity(id); return;
        }
      } catch { /* keep polling */ }
      if (!cancelled) setTimeout(poll, 3000);
    };
    poll();
    return () => { cancelled = true; };
  }, [pairCode, identity]);

  const fullscreen = () => { document.documentElement.requestFullscreen?.().catch(() => undefined); };
  const reset = () => { localStorage.removeItem(LS_IDENTITY); localStorage.removeItem(LS_LAST_CONTENT); window.location.reload(); };

  const timeText = useMemo(() => now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), [now]);
  const dateText = useMemo(() => now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }), [now]);

  if (!identity) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-center">
        <Tv className="mb-4 h-12 w-12 text-primary" />
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">ScreenHub · Pairing code</p>
        <p className="my-6 text-7xl font-bold tracking-[0.3em] text-primary">{pairCode}</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Open the admin dashboard → Devices → Claim, and enter this code to provision this screen.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => setPairCode(genCode())}>
          <RefreshCcw className="mr-2 h-4 w-4" />New code
        </Button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black text-white">
      {content ? (
        <>
          {contentError && (
            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-2 bg-destructive/90 px-4 py-2 text-xs">
              <AlertCircle className="h-3.5 w-3.5" /> {contentError}
            </div>
          )}
          {loading && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {content.type === "url" ? (
            <iframe key={content.url} src={content.url} className="absolute inset-0 h-full w-full border-0" title="content"
              onLoad={() => setLoading(false)} onError={() => setContentError("Failed to load URL")} />
          ) : content.type === "image" ? (
            <img key={content.url} src={content.url} alt={content.title ?? ""} className="absolute inset-0 h-full w-full object-contain"
              onLoad={() => setLoading(false)} onError={() => { setLoading(false); setContentError("Failed to load image"); }} />
          ) : content.type === "video" ? (
            <video key={content.url} src={content.url} className="absolute inset-0 h-full w-full object-contain"
              autoPlay muted loop playsInline
              onLoadedData={() => setLoading(false)} onError={() => { setLoading(false); setContentError("Failed to load video"); }} />
          ) : (
            <iframe key={content.url} src={content.url} className="absolute inset-0 h-full w-full border-0" title="pdf"
              onLoad={() => setLoading(false)} />
          )}
        </>
      ) : (
        <IdleScreen identity={identity} online={online} lastBeat={lastBeat} timeText={timeText} dateText={dateText} />
      )}

      <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2">
        <span className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs backdrop-blur ${online ? "border-primary/30 bg-primary/20 text-primary" : "border-destructive/30 bg-destructive/20 text-destructive"}`}>
          {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />} {online ? "online" : "offline"}
        </span>
        <Button size="icon" variant="outline" className="pointer-events-auto h-8 w-8 bg-black/40 backdrop-blur" onClick={fullscreen} title="Fullscreen"><Maximize2 className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="outline" className="pointer-events-auto h-8 w-8 bg-black/40 backdrop-blur" onClick={reset} title="Reset pairing"><RefreshCcw className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

function IdleScreen({ identity, online, lastBeat, timeText, dateText }: {
  identity: Identity; online: boolean; lastBeat: Date | null; timeText: string; dateText: string;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-black via-zinc-950 to-black text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(56,189,248,0.15),_transparent_60%)]" />
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
            <MonitorPlay className="h-6 w-6 text-primary" />
          </div>
          <p className="text-2xl font-semibold tracking-tight">ScreenHub</p>
        </div>
        <div className="mt-6">
          <p className="text-5xl font-light tabular-nums tracking-tight text-white/90">{timeText}</p>
          <p className="mt-1 text-sm text-white/50">{dateText}</p>
        </div>
        <div className="mt-8 max-w-sm rounded-xl border border-white/10 bg-white/5 p-4 text-left backdrop-blur">
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>Device</span>
            <span className={`inline-flex items-center gap-1 ${online ? "text-primary" : "text-destructive"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-primary animate-pulse" : "bg-destructive"}`} /> {online ? "Online" : "Offline"}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-white">{identity.device_name}</p>
          <p className="mt-2 font-mono text-[10px] text-white/40 break-all">{identity.device_id}</p>
          <p className="mt-2 text-[10px] text-white/40">
            Last heartbeat: {lastBeat ? lastBeat.toLocaleTimeString() : "—"}
          </p>
        </div>
        <p className="mt-6 text-xs text-white/40">Waiting for content…</p>
      </div>
    </div>
  );
}

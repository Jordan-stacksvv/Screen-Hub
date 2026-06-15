// Production browser-based device client. Designed to run fullscreen on any
// device with a browser (Android TV browser, mini PC, tablet, kiosk PC).
// Persistent identity in localStorage; pairing flow when unprovisioned.
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, RefreshCcw, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/client")({ component: ClientPage });

type Identity = { device_id: string; device_name: string; registration_token: string };
type Cmd = { id: string; command_type: string; payload: Record<string, unknown> };
type PlaylistItem = { id: string; position: number; duration_seconds: number; content: { id: string; title: string; content_type: string; file_url: string } };
type Playlist = { id: string; name: string; loop_enabled: boolean; playlist_items: PlaylistItem[] } | null;

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
  const [content, setContent] = useState<{ type: string; url: string } | null>(null);
  const [playlist, setPlaylist] = useState<Playlist>(null);
  const [playlistIdx, setPlaylistIdx] = useState(0);
  const backoffRef = useRef(1000);

  useEffect(() => { setIdentity(loadIdentity()); }, []);

  // Restore last content
  useEffect(() => {
    try { const raw = localStorage.getItem(LS_LAST_CONTENT); if (raw) setContent(JSON.parse(raw)); } catch { /* noop */ }
  }, []);

  const ack = useCallback(async (cmdId: string, success: boolean) => {
    if (!identity) return;
    try {
      await fetch("/api/public/devices/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${identity.registration_token}` },
        body: JSON.stringify({ command_id: cmdId, success }),
      });
    } catch { /* will retry on next heartbeat */ }
  }, [identity]);

  const applyCommand = useCallback((c: Cmd) => {
    const target = (c.payload?.target as string) ?? "";
    const typeMap: Record<string, string> = { open_url: "url", show_image: "image", play_video: "video", show_pdf: "pdf" };
    const t = typeMap[c.command_type];
    if (t && target) {
      const next = { type: t, url: target };
      setContent(next);
      localStorage.setItem(LS_LAST_CONTENT, JSON.stringify(next));
      setPlaylist(null);
    }
    if (c.command_type === "reboot") {
      setTimeout(() => window.location.reload(), 500);
    }
    ack(c.id, true);
  }, [ack]);

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
          scheduled_content: { id: string; content_type: string; file_url: string } | null;
        };
        setOnline(true);
        backoffRef.current = 1000;
        for (const c of data.commands ?? []) applyCommand(c);
        // Scheduled content takes precedence over a playlist
        if (data.scheduled_content) {
          const sc = data.scheduled_content;
          const next = { type: sc.content_type, url: sc.file_url };
          setContent(next);
          localStorage.setItem(LS_LAST_CONTENT, JSON.stringify(next));
          setPlaylist(null);
        } else if (data.playlist && data.playlist.playlist_items?.length) {
          setPlaylist(data.playlist);
        }
      } catch {
        setOnline(false);
        backoffRef.current = Math.min(backoffRef.current * 2, 30000);
      }
      if (!cancelled) timer = setTimeout(beat, online ? 30000 : backoffRef.current);
    };

    beat();
    return () => { cancelled = true; clearTimeout(timer!); };
  }, [identity, applyCommand, online]);

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
    const typeMap: Record<string, string> = { url: "url", image: "image", video: "video", pdf: "pdf" };
    const next = { type: typeMap[item.content.content_type] ?? "url", url: item.content.file_url };
    setContent(next);
    localStorage.setItem(LS_LAST_CONTENT, JSON.stringify(next));
    const t = setTimeout(() => setPlaylistIdx((i) => i + 1), Math.max(2, item.duration_seconds) * 1000);
    return () => clearTimeout(t);
  }, [playlist, playlistIdx]);

  // Pairing flow when no identity
  useEffect(() => {
    if (identity || pairCode) return;
    const code = genCode();
    setPairCode(code);
  }, [identity, pairCode]);

  useEffect(() => {
    if (identity || !pairCode) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/public/devices/pair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: pairCode, device_name: `Browser ${navigator.platform}`, device_type: "other", operating_system: navigator.userAgent.slice(0, 100) }),
        });
        const data = await res.json();
        if (data.status === "claimed") {
          const id = { device_id: data.device_id, device_name: data.device_name, registration_token: data.registration_token };
          saveIdentity(id);
          if (!cancelled) setIdentity(id);
          return;
        }
      } catch { /* keep polling */ }
      if (!cancelled) setTimeout(poll, 3000);
    };
    poll();
    return () => { cancelled = true; };
  }, [pairCode, identity]);

  const fullscreen = () => { document.documentElement.requestFullscreen?.().catch(() => undefined); };
  const reset = () => { localStorage.removeItem(LS_IDENTITY); localStorage.removeItem(LS_LAST_CONTENT); window.location.reload(); };

  if (!identity) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-center">
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Pairing code</p>
        <p className="my-6 text-7xl font-bold tracking-[0.3em] text-primary">{pairCode}</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Open the admin dashboard → Devices → Claim, enter this code to provision this screen.
          The code refreshes every 15 minutes.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => { setPairCode(genCode()); }}>
          <RefreshCcw className="mr-2 h-4 w-4" />New code
        </Button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black">
      {content ? (
        content.type === "url" ? (
          <iframe src={content.url} className="absolute inset-0 h-full w-full border-0" title="content" />
        ) : content.type === "image" ? (
          <img src={content.url} alt="" className="absolute inset-0 h-full w-full object-contain" />
        ) : content.type === "video" ? (
          <video src={content.url} className="absolute inset-0 h-full w-full object-contain" autoPlay muted loop playsInline />
        ) : (
          <iframe src={content.url} className="absolute inset-0 h-full w-full border-0" title="pdf" />
        )
      ) : (
        <div className="flex min-h-screen flex-col items-center justify-center text-center text-muted-foreground">
          <p className="text-lg">{identity.device_name}</p>
          <p className="mt-1 text-xs font-mono">{identity.device_id}</p>
          <p className="mt-6 text-xs">Waiting for content…</p>
        </div>
      )}
      <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2">
        <span className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${online ? "border-primary/30 bg-primary/10 text-primary" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
          {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />} {online ? "online" : "offline"}
        </span>
        <Button size="icon" variant="outline" className="pointer-events-auto h-8 w-8" onClick={fullscreen} title="Fullscreen"><Maximize2 className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="outline" className="pointer-events-auto h-8 w-8" onClick={reset} title="Reset pairing"><RefreshCcw className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

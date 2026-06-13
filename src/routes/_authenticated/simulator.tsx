import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { Power, RefreshCw, Tv, Wifi, WifiOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { DEVICE_TYPES, type DeviceType, COMMAND_TYPES } from "@/lib/screenhub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/simulator")({ component: SimulatorPage });

type SimSession = {
  device_id: string;
  device_name: string;
  unique_identifier: string;
  registration_token: string;
  device_type: DeviceType;
};

type LogEntry = {
  id: string;
  command_id: string;
  command_type: string;
  payload: Record<string, unknown>;
  status: "received" | "executing" | "acknowledged" | "failed";
  at: string;
};

type ActiveContent =
  | { kind: "open_url"; url: string }
  | { kind: "show_image"; url: string }
  | { kind: "play_video"; url: string }
  | { kind: "show_pdf"; url: string }
  | null;

const STORAGE_KEY = "screenhub:simulator:session";
const HEARTBEAT_MS = 30_000;

function SimulatorPage() {
  const [name, setName] = useState("Simulator TV");
  const [deviceType, setDeviceType] = useState<DeviceType>("android_tv");
  const [session, setSession] = useState<SimSession | null>(null);
  const [online, setOnline] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [content, setContent] = useState<ActiveContent>(null);
  const [busy, setBusy] = useState(false);

  // restore session
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSession(JSON.parse(raw));
    } catch {}
  }, []);

  const persist = (s: SimSession | null) => {
    setSession(s);
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  };

  const handleCommand = useCallback(async (cmd: { id: string; command_type: string; payload: Record<string, unknown> }, token: string) => {
    const entry: LogEntry = {
      id: crypto.randomUUID(), command_id: cmd.id, command_type: cmd.command_type,
      payload: cmd.payload, status: "executing", at: new Date().toISOString(),
    };
    setLog(l => [entry, ...l].slice(0, 100));

    try {
      const target = String(cmd.payload?.target ?? "");
      if (cmd.command_type === "open_url" && target) setContent({ kind: "open_url", url: target });
      else if (cmd.command_type === "show_image" && target) setContent({ kind: "show_image", url: target });
      else if (cmd.command_type === "play_video" && target) setContent({ kind: "play_video", url: target });
      else if (cmd.command_type === "show_pdf" && target) setContent({ kind: "show_pdf", url: target });

      const res = await fetch("/api/public/devices/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ command_id: cmd.id, success: true, result: { rendered: true } }),
      });
      if (!res.ok) throw new Error(`ack ${res.status}`);
      setLog(l => l.map(e => e.id === entry.id ? { ...e, status: "acknowledged" } : e));
    } catch (e) {
      setLog(l => l.map(en => en.id === entry.id ? { ...en, status: "failed" } : en));
      toast.error(`Ack failed: ${(e as Error).message}`);
    }
  }, []);

  // heartbeat + realtime command subscription
  useEffect(() => {
    if (!session) { setOnline(false); return; }

    let cancelled = false;
    const beat = async () => {
      try {
        const res = await fetch("/api/public/devices/heartbeat", {
          method: "POST", headers: { Authorization: `Bearer ${session.registration_token}` },
        });
        if (!res.ok) throw new Error(`heartbeat ${res.status}`);
        const j = await res.json();
        if (cancelled) return;
        setOnline(true);
        // process any pending commands surfaced by the heartbeat poll
        for (const c of j.commands ?? []) await handleCommand(c, session.registration_token);
      } catch {
        if (!cancelled) setOnline(false);
      }
    };
    beat();
    const iv = setInterval(beat, HEARTBEAT_MS);

    // realtime: new pending commands → handle immediately
    const channel = supabase
      .channel(`sim-${session.device_id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "commands", filter: `device_id=eq.${session.device_id}` },
        (payload) => {
          const c = payload.new as { id: string; command_type: string; payload: Record<string, unknown> };
          handleCommand(c, session.registration_token);
        })
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(iv);
      supabase.removeChannel(channel);
    };
  }, [session, handleCommand]);

  const connect = async () => {
    if (!name.trim()) return toast.error("Enter a device name");
    setBusy(true);
    try {
      const identifier = `sim_${crypto.randomUUID().slice(0, 16)}`;
      const { data: device, error } = await supabase.from("devices").insert({
        device_name: name, device_type: deviceType,
        unique_identifier: identifier, status: "unregistered",
        operating_system: "Simulator (web)",
      }).select("id").single();
      if (error) throw error;

      const res = await fetch("/api/public/devices/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unique_identifier: identifier, operating_system: "Simulator (web)" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "register failed");

      persist({
        device_id: device.id, device_name: name, unique_identifier: identifier,
        registration_token: j.registration_token, device_type: deviceType,
      });
      toast.success("Simulator connected");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    if (session) {
      await supabase.from("devices").update({ status: "offline" }).eq("id", session.device_id);
    }
    persist(null); setOnline(false); setLog([]); setContent(null);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Client</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Device Simulator</h1>
          <p className="mt-1 text-sm text-muted-foreground">Simulates an Android/Windows client: registers, heartbeats every {HEARTBEAT_MS / 1000}s, and executes commands in real time.</p>
        </div>
        {session && (
          <Badge variant="outline" className={online ? "border-primary/30 bg-primary/10 text-primary gap-1.5" : "border-destructive/30 bg-destructive/10 text-destructive gap-1.5"}>
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {online ? "Online" : "Disconnected"}
          </Badge>
        )}
      </header>

      {!session ? (
        <div className="rounded-xl border border-border bg-card p-6 max-w-lg space-y-4">
          <div className="space-y-2"><Label>Device name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lobby Simulator" /></div>
          <div className="space-y-2"><Label>Device type</Label>
            <Select value={deviceType} onValueChange={(v) => setDeviceType(v as DeviceType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DEVICE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={connect} disabled={busy} className="glow w-full">
            <Power className="mr-2 h-4 w-4" />{busy ? "Connecting…" : "Connect simulator"}
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Tv className="h-3.5 w-3.5" /> Display preview
                </div>
                {content && <Button variant="ghost" size="sm" onClick={() => setContent(null)}>Clear</Button>}
              </div>
              <div className="aspect-video bg-black flex items-center justify-center">
                {!content ? (
                  <p className="text-xs text-muted-foreground">Waiting for content…</p>
                ) : content.kind === "show_image" ? (
                  <img src={content.url} alt="" className="max-h-full max-w-full object-contain" />
                ) : content.kind === "play_video" ? (
                  <video src={content.url} controls autoPlay className="max-h-full max-w-full" />
                ) : (
                  <iframe src={content.url} title="content" className="h-full w-full border-0 bg-white" />
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-sm font-medium">Console</p>
                <Button variant="ghost" size="sm" onClick={() => setLog([])}><Trash2 className="mr-1 h-3 w-3" />Clear</Button>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-border">
                {log.length === 0 ? (
                  <p className="p-6 text-center text-xs text-muted-foreground">No commands yet</p>
                ) : log.map(e => (
                  <div key={e.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-4 py-2.5 text-xs">
                    <span className="font-mono text-muted-foreground">{new Date(e.at).toLocaleTimeString()}</span>
                    <div className="min-w-0">
                      <p className="font-medium">{COMMAND_TYPES.find(t => t.value === e.command_type)?.label ?? e.command_type}</p>
                      <p className="font-mono text-[10px] text-muted-foreground truncate">{JSON.stringify(e.payload)}</p>
                    </div>
                    <Badge variant="outline" className={
                      e.status === "acknowledged" ? "border-primary/30 bg-primary/10 text-primary" :
                      e.status === "failed" ? "border-destructive/30 bg-destructive/10 text-destructive" :
                      "border-warning/30 bg-warning/10 text-warning"
                    }>{e.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3 text-sm">
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Device</p>
              <Field label="Name" value={session.device_name} />
              <Field label="Type" value={DEVICE_TYPES.find(t => t.value === session.device_type)?.label ?? session.device_type} />
              <Field label="ID" value={session.unique_identifier} mono />
              <Field label="Device UUID" value={session.device_id} mono />
            </div>
            <Button variant="outline" className="w-full" onClick={disconnect}>
              <RefreshCw className="mr-2 h-4 w-4" />Disconnect & forget
            </Button>
          </aside>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={mono ? "font-mono text-xs break-all" : "text-sm"}>{value}</p>
    </div>
  );
}

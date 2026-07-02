import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Wifi, Play, Square, RefreshCw, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useHotkeys } from "@/desktop/hooks/use-hotkeys";
import { bridge } from "@/desktop/bridge";

export const Route = createFileRoute("/_authenticated/desktop/live-control")({ component: LiveControl });

function LiveControl() {
  const [focus, setFocus] = useState<string | null>(null);

  const { data: devices } = useQuery({
    queryKey: ["desktop-live"],
    queryFn: async () => (await supabase.from("devices").select("id, device_name, status, last_seen_at, current_content_id, current_playlist_id, playback_status")).data ?? [],
    refetchInterval: 5000,
  });

  const send = async (device_id: string, command_type: string, payload: Record<string, string> = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("commands").insert({ device_id, command_type, payload, issued_by: user?.id ?? null, status: "pending" } as any);
    if (error) toast.error(error.message);
    else { toast.success(`${command_type} → ${device_id.slice(0, 8)}`); bridge().notify({ title: command_type, body: "Command sent" }); }
  };

  useHotkeys({
    "s": () => focus && send(focus, "stop_playback"),
    "r": () => focus && send(focus, "refresh_device"),
    "p": () => focus && send(focus, "reload_content"),
  });

  const online = (devices ?? []).filter(d => d.status === "online");
  const offline = (devices ?? []).filter(d => d.status !== "online");

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6">
      <header>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Live Control</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Now playing</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Click a tile to focus, then use <kbd className="rounded bg-muted px-1 text-[10px]">P</kbd> play · <kbd className="rounded bg-muted px-1 text-[10px]">S</kbd> stop · <kbd className="rounded bg-muted px-1 text-[10px]">R</kbd> refresh.
        </p>
      </header>

      <section>
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Wifi className="h-3 w-3 text-primary" />Online · {online.length}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {online.map((d) => (
            <button
              key={d.id}
              onClick={() => setFocus(d.id)}
              className={`rounded-xl border p-3 text-left transition-all ${focus === d.id ? "border-primary bg-primary/5 ring-2 ring-primary/40" : "border-border bg-card hover:border-border/80"}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{d.device_name}</p>
                  <p className="text-[10px] text-muted-foreground">{d.playback_status ?? "idle"}</p>
                </div>
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">Last: {d.last_seen_at ? formatDistanceToNow(new Date(d.last_seen_at), { addSuffix: true }) : "—"}</p>
              <div className="mt-2 flex gap-1">
                <Button size="sm" variant="outline" className="h-6 flex-1 text-[10px]" onClick={(e) => { e.stopPropagation(); send(d.id, "reload_content"); }}><Play className="mr-1 h-2.5 w-2.5" />Play</Button>
                <Button size="sm" variant="outline" className="h-6 flex-1 text-[10px]" onClick={(e) => { e.stopPropagation(); send(d.id, "stop_playback"); }}><Square className="mr-1 h-2.5 w-2.5" />Stop</Button>
                <Button size="sm" variant="outline" className="h-6 flex-1 text-[10px]" onClick={(e) => { e.stopPropagation(); send(d.id, "refresh_device"); }}><RefreshCw className="mr-1 h-2.5 w-2.5" /></Button>
              </div>
            </button>
          ))}
          {online.length === 0 && <p className="col-span-full rounded-xl border border-border bg-card p-8 text-center text-xs text-muted-foreground">No devices online right now.</p>}
        </div>
      </section>

      {offline.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">Offline · {offline.length}</div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {offline.map(d => (
              <div key={d.id} className="rounded-lg border border-border/50 bg-muted/20 p-2 text-xs opacity-60">
                {d.device_name}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

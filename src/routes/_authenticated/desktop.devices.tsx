import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Wifi, WifiOff, Search, Filter, Play, Radio, Square, RefreshCw, Trash2, Star, StarOff, MoreVertical, MonitorSmartphone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFavorites } from "@/desktop/hooks/use-recent";
import { bridge } from "@/desktop/bridge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/desktop/devices")({ component: DesktopDevices });

type Device = {
  id: string; device_name: string; status: string; device_type: string;
  last_seen: string | null; current_content_id: string | null; group_id: string | null;
};

function quality(lastSeen: string | null): { label: string; color: string } {
  if (!lastSeen) return { label: "offline", color: "text-muted-foreground" };
  const age = (Date.now() - new Date(lastSeen).getTime()) / 1000;
  if (age < 45) return { label: "good", color: "text-primary" };
  if (age < 90) return { label: "degraded", color: "text-warning" };
  return { label: "offline", color: "text-muted-foreground" };
}

function DesktopDevices() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fav = useFavorites("devices");

  const { data: devices } = useQuery({
    queryKey: ["desktop-devices"],
    queryFn: async () => (await supabase.from("devices").select("*").order("device_name")).data as Device[] | null ?? [],
    refetchInterval: 8000,
  });

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return (devices ?? []).filter((d) =>
      (statusFilter === "all" || d.status === statusFilter) &&
      (!s || d.device_name.toLowerCase().includes(s))
    );
  }, [devices, q, statusFilter]);

  const toggle = (id: string) => {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const selectAll = () => setSelected(new Set(filtered.map((d) => d.id)));
  const clearSel = () => setSelected(new Set());

  const bulkCommand = async (command_type: string, payload: Record<string, string> = {}) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const { data: { user } } = await supabase.auth.getUser();
    const rows = ids.map((device_id) => ({ device_id, command_type, payload, issued_by: user?.id ?? null, status: "pending" as const }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("commands").insert(rows as any);
    if (error) { toast.error(error.message); return; }
    bridge().notify({ title: `${command_type} sent`, body: `${ids.length} devices` });
    toast.success(`Queued for ${ids.length} devices`);
  };

  const bulkRemove = async () => {
    const ids = Array.from(selected);
    if (!ids.length || !confirm(`Remove ${ids.length} device(s)?`)) return;
    const { error } = await supabase.from("devices").delete().in("id", ids);
    if (error) toast.error(error.message);
    else { toast.success("Removed"); clearSel(); qc.invalidateQueries({ queryKey: ["desktop-devices"] }); }
  };

  const contextMenu = async (deviceId: string) => {
    const id = await bridge().contextMenu([
      { id: "open", label: "Open detail" },
      { id: "stop", label: "Stop playback" },
      { id: "refresh", label: "Refresh device" },
      { type: "separator" },
      { id: "fav", label: fav.has(deviceId) ? "Unfavorite" : "Favorite" },
      { id: "remove", label: "Remove device" },
    ]);
    if (!id) return;
    setSelected(new Set([deviceId]));
    if (id === "stop") await bulkCommand("stop_playback");
    if (id === "refresh") await bulkCommand("refresh_device");
    if (id === "remove") await bulkRemove();
    if (id === "fav") fav.toggle(deviceId);
    if (id === "open") window.location.href = `/devices/${deviceId}`;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Devices</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Fleet</h1>
        </div>
        <Badge variant="outline">{filtered.length} shown · {selected.size} selected</Badge>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search devices…" className="h-8 pl-8 text-xs" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-36 text-xs"><Filter className="mr-1 h-3 w-3" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={selectAll} className="h-8 text-xs">Select all</Button>
        {selected.size > 0 && <Button size="sm" variant="ghost" onClick={clearSel} className="h-8 text-xs">Clear</Button>}
      </div>

      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-2 backdrop-blur">
          <span className="ml-2 text-xs">{selected.size} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => bulkCommand("refresh_device")}><RefreshCw className="mr-1 h-3 w-3" />Refresh</Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => bulkCommand("stop_playback")}><Square className="mr-1 h-3 w-3" />Stop</Button>
          <Link to="/desktop/broadcasts"><Button size="sm" className="h-7 text-xs"><Radio className="mr-1 h-3 w-3" />Broadcast</Button></Link>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={bulkRemove}><Trash2 className="mr-1 h-3 w-3" />Remove</Button>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((d) => {
          const sel = selected.has(d.id);
          const online = d.status === "online";
          const qy = quality(d.last_seen);
          const starred = fav.has(d.id);
          return (
            <div
              key={d.id}
              onContextMenu={(e) => { e.preventDefault(); contextMenu(d.id); }}
              className={cn("group relative rounded-xl border bg-card p-3 transition-colors", sel ? "border-primary/60 bg-primary/5" : "border-border hover:border-border/80")}
            >
              <div className="flex items-start gap-2">
                <Checkbox checked={sel} onCheckedChange={() => toggle(d.id)} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {online ? <Wifi className="h-3 w-3 text-primary" /> : <WifiOff className="h-3 w-3 text-muted-foreground" />}
                    <Link to="/devices/$deviceId" params={{ deviceId: d.id }} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary">
                      {d.device_name}
                    </Link>
                    <button onClick={() => fav.toggle(d.id)} title="Favorite">
                      {starred ? <Star className="h-3 w-3 text-warning" /> : <StarOff className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />}
                    </button>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{d.device_type}</p>
                  <div className="mt-2 flex items-center gap-2 text-[10px]">
                    <span className={qy.color}>● {qy.label}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{d.last_seen ? formatDistanceToNow(new Date(d.last_seen), { addSuffix: true }) : "never"}</span>
                  </div>
                </div>
                <button onClick={() => contextMenu(d.id)} className="opacity-0 transition-opacity group-hover:opacity-100" title="More">
                  <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
              <div className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button size="sm" variant="outline" className="h-6 flex-1 text-[10px]" onClick={() => { setSelected(new Set([d.id])); bulkCommand("stop_playback"); }}>
                  <Square className="mr-1 h-2.5 w-2.5" />Stop
                </Button>
                <Button size="sm" variant="outline" className="h-6 flex-1 text-[10px]" onClick={() => { setSelected(new Set([d.id])); bulkCommand("refresh_device"); }}>
                  <RefreshCw className="mr-1 h-2.5 w-2.5" />Refresh
                </Button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-xl border border-border bg-card p-12 text-center">
            <MonitorSmartphone className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-xs text-muted-foreground">No devices match your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

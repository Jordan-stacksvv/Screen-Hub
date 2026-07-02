import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { MonitorSmartphone, Radio, ListVideo, HardDrive, Wifi, WifiOff, ArrowRight, Zap, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBytes } from "@/lib/screenhub";

export const Route = createFileRoute("/_authenticated/desktop/")({ component: DesktopDashboard });

function DesktopDashboard() {
  const { data } = useQuery({
    queryKey: ["desktop-dashboard"],
    queryFn: async () => {
      const [devices, broadcasts, playlists, media] = await Promise.all([
        supabase.from("devices").select("id, device_name, status, last_seen_at, device_type"),
        supabase.from("broadcasts").select("id, name, command_type, created_at, total_targets, status").order("created_at", { ascending: false }).limit(6),
        supabase.from("playlists").select("id"),
        supabase.from("content").select("id, file_size"),
      ]);
      const rows = devices.data ?? [];
      const online = rows.filter(d => d.status === "online").length;
      const storage = (media.data ?? []).reduce((n, m) => n + (m.file_size ?? 0), 0);
      return {
        devices: rows, online, total: rows.length,
        broadcasts: broadcasts.data ?? [], playlists: (playlists.data ?? []).length,
        mediaCount: (media.data ?? []).length, storage,
      };
    },
    refetchInterval: 15000,
  });

  const online = data?.online ?? 0;
  const total = data?.total ?? 0;
  const health = total === 0 ? 0 : Math.round((online / total) * 100);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Control Center</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-xs text-muted-foreground">Desktop-optimized overview · press ⌘K for the command palette</p>
        </div>
        <div className="flex gap-2">
          <Link to="/desktop/media" className="rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted/40 inline-flex items-center gap-1.5"><Upload className="h-3 w-3" />Upload</Link>
          <Link to="/desktop/broadcasts" className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 inline-flex items-center gap-1.5"><Radio className="h-3 w-3" />Broadcast</Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile icon={Wifi} label="Online" value={online} sub={`of ${total} devices`} pct={health} />
        <Tile icon={ListVideo} label="Playlists" value={data?.playlists ?? 0} />
        <Tile icon={MonitorSmartphone} label="Media items" value={data?.mediaCount ?? 0} />
        <Tile icon={HardDrive} label="Storage" value={formatBytes(data?.storage ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-xs font-medium">Devices</span>
            <Link to="/desktop/devices" className="text-[11px] text-primary hover:underline flex items-center gap-1">Manage <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <ul className="divide-y divide-border">
            {(data?.devices ?? []).slice(0, 6).map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                {d.status === "online" ? <Wifi className="h-3.5 w-3.5 text-primary" /> : <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />}
                <Link to="/devices/$deviceId" params={{ deviceId: d.id }} className="min-w-0 flex-1 truncate text-xs hover:text-primary">{d.device_name}</Link>
                <span className="text-[10px] text-muted-foreground">{d.last_seen_at ? formatDistanceToNow(new Date(d.last_seen_at), { addSuffix: true }) : "never"}</span>
              </li>
            ))}
            {(data?.devices ?? []).length === 0 && <li className="p-6 text-center text-xs text-muted-foreground">No devices yet.</li>}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-xs font-medium">Recent broadcasts</span>
            <Link to="/desktop/broadcasts" className="text-[11px] text-primary hover:underline flex items-center gap-1">All <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <ul className="divide-y divide-border">
            {(data?.broadcasts ?? []).map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-2.5">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                <Link to="/broadcasts/$broadcastId" params={{ broadcastId: b.id }} className="min-w-0 flex-1 truncate text-xs hover:text-primary">
                  {b.name ?? b.command_type}
                </Link>
                <span className="text-[10px] text-muted-foreground">{b.total_targets} targets</span>
                <span className="text-[10px] text-muted-foreground/70">{formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}</span>
              </li>
            ))}
            {(data?.broadcasts ?? []).length === 0 && <li className="p-6 text-center text-xs text-muted-foreground">No broadcasts yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Tile({ icon: Icon, label, value, sub, pct }: { icon: typeof Wifi; label: string; value: number | string; sub?: string; pct?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <p className="mt-1.5 font-mono text-xl">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      {typeof pct === "number" && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
      )}
    </div>
  );
}

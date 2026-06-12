import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MonitorSmartphone, Wifi, WifiOff, Layers, Terminal, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [devices, groups, commands] = await Promise.all([
        supabase.from("devices").select("id, status, last_seen"),
        supabase.from("device_groups").select("id"),
        supabase.from("commands").select("id, command_type, status, created_at, devices(device_name)").order("created_at", { ascending: false }).limit(8),
      ]);
      const all = devices.data ?? [];
      return {
        total: all.length,
        online: all.filter(d => d.status === "online").length,
        offline: all.filter(d => d.status === "offline").length,
        unregistered: all.filter(d => d.status === "unregistered").length,
        groups: groups.data?.length ?? 0,
        commands: commands.data ?? [],
      };
    },
  });

  // realtime: refetch on device or command changes
  const [, force] = useState(0);
  useEffect(() => {
    const ch = supabase
      .channel("dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "devices" }, () => force(n => n+1))
      .on("postgres_changes", { event: "*", schema: "public", table: "commands" }, () => force(n => n+1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const stats = [
    { label: "Total Devices", value: data?.total ?? 0, icon: MonitorSmartphone, accent: "text-foreground" },
    { label: "Online", value: data?.online ?? 0, icon: Wifi, accent: "text-primary" },
    { label: "Offline", value: data?.offline ?? 0, icon: WifiOff, accent: "text-destructive" },
    { label: "Groups", value: data?.groups ?? 0, icon: Layers, accent: "text-foreground" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Overview</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Dashboard</h1>
        </div>
        <Link to="/devices" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          Manage devices <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{label}</span>
              <Icon className={`h-4 w-4 ${accent}`} />
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">
              {isLoading ? <Skeleton className="h-8 w-12" /> : value}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold">Recent commands</h2>
            <Link to="/commands" className="text-xs text-muted-foreground hover:text-foreground">View all</Link>
          </div>
          <div className="divide-y divide-border">
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4"><Skeleton className="h-8 w-8 rounded-md" /><Skeleton className="h-4 flex-1" /></div>
            )) : data?.commands.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No commands yet.</div>
            ) : data?.commands.map((c) => (
              <div key={c.id} className="flex items-center gap-4 p-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Terminal className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.command_type.replace(/_/g, " ")}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {(c as any).devices?.device_name ?? "—"} · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Fleet health</h2>
          <p className="mt-1 text-xs text-muted-foreground">Live snapshot from your devices.</p>
          <div className="mt-6 space-y-4">
            {[
              { label: "Online", value: data?.online ?? 0, total: data?.total ?? 0, color: "bg-primary" },
              { label: "Offline", value: data?.offline ?? 0, total: data?.total ?? 0, color: "bg-destructive" },
              { label: "Unregistered", value: data?.unregistered ?? 0, total: data?.total ?? 0, color: "bg-muted-foreground/60" },
            ].map(({ label, value, total, color }) => {
              const pct = total ? (value / total) * 100 : 0;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono">{value}/{total}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-warning/15 text-warning border-warning/30",
    delivered: "bg-primary/15 text-primary border-primary/30",
    acknowledged: "bg-primary/15 text-primary border-primary/30",
    failed: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return <Badge variant="outline" className={`${map[status] ?? ""} text-xs`}>{status}</Badge>;
}

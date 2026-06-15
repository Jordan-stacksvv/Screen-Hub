import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Wifi, WifiOff, CheckCircle2, Clock, AlertCircle, Truck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { COMMAND_TYPES } from "@/lib/screenhub";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/broadcasts/$broadcastId")({
  component: BroadcastDetailPage,
});

function BroadcastDetailPage() {
  const { broadcastId } = Route.useParams();
  const { data: broadcast, isLoading } = useQuery({
    queryKey: ["broadcast", broadcastId],
    queryFn: async () => (await supabase.from("broadcasts").select("*").eq("id", broadcastId).maybeSingle()).data,
  });
  const { data: rows } = useQuery({
    queryKey: ["broadcast-deliveries", broadcastId],
    queryFn: async () => (await supabase.from("commands")
      .select("id, status, created_at, delivered_at, acknowledged_at, device_id, devices(device_name, status)")
      .eq("broadcast_id", broadcastId).order("created_at")).data ?? [],
    refetchInterval: 4000,
  });

  if (isLoading) return <div className="p-8"><Skeleton className="h-40 w-full" /></div>;
  if (!broadcast) return <div className="p-8 text-sm text-muted-foreground">Broadcast not found</div>;

  const counts = { pending: 0, delivered: 0, acknowledged: 0, failed: 0 };
  for (const r of rows ?? []) counts[r.status as keyof typeof counts]++;
  const total = (rows ?? []).length || 1;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
          <Link to="/broadcasts"><ArrowLeft className="mr-1 h-4 w-4" />All broadcasts</Link>
        </Button>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Broadcast</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{broadcast.name ?? COMMAND_TYPES.find(t => t.value === broadcast.command_type)?.label}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {broadcast.target_type} · {broadcast.total_targets} targets · created {formatDistanceToNow(new Date(broadcast.created_at), { addSuffix: true })}
            </p>
          </div>
          <Badge variant="outline">{broadcast.command_type}</Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Tile icon={Clock} label="Pending" value={counts.pending} pct={(counts.pending / total) * 100} c="text-warning" />
        <Tile icon={Truck} label="Delivered" value={counts.delivered} pct={(counts.delivered / total) * 100} c="text-primary" />
        <Tile icon={CheckCircle2} label="Acknowledged" value={counts.acknowledged} pct={(counts.acknowledged / total) * 100} c="text-primary" />
        <Tile icon={AlertCircle} label="Failed" value={counts.failed} pct={(counts.failed / total) * 100} c="text-destructive" />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Payload</p>
        <pre className="mt-2 overflow-auto rounded-md bg-muted/30 p-3 text-xs">{JSON.stringify(broadcast.payload, null, 2)}</pre>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border bg-muted/30 px-4 py-3 text-sm font-medium">Per-device delivery</div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-2 font-medium">Device</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Delivered</th><th className="px-4 py-2 font-medium">Acknowledged</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows?.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-xs text-muted-foreground">No deliveries</td></tr>}
            {rows?.map(r => {
              const d = r.devices as { device_name?: string; status?: string } | null;
              const online = d?.status === "online";
              return (
                <tr key={r.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2">
                    <Link to="/devices/$deviceId" params={{ deviceId: r.device_id }} className="flex items-center gap-2 font-medium hover:text-primary">
                      {online ? <Wifi className="h-3 w-3 text-primary" /> : <WifiOff className="h-3 w-3 text-muted-foreground" />}
                      {d?.device_name ?? r.device_id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-2"><Badge variant="outline">{r.status}</Badge></td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{r.delivered_at ? formatDistanceToNow(new Date(r.delivered_at), { addSuffix: true }) : "—"}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{r.acknowledged_at ? formatDistanceToNow(new Date(r.acknowledged_at), { addSuffix: true }) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ icon: Icon, label, value, pct, c }: { icon: typeof Wifi; label: string; value: number; pct: number; c: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><Icon className={`h-3.5 w-3.5 ${c}`} /></div>
      <p className={`mt-2 text-2xl font-mono ${c}`}>{value}</p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><div className={`h-full ${c === "text-destructive" ? "bg-destructive" : c === "text-warning" ? "bg-warning" : "bg-primary"}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

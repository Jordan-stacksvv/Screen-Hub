import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowLeft, Wifi, WifiOff, Activity, ListVideo, CalendarClock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { DEVICE_TYPES, COMMAND_TYPES } from "@/lib/screenhub";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/devices/$deviceId")({
  component: DeviceDetailPage,
});

function DeviceDetailPage() {
  const { deviceId } = Route.useParams();
  const qc = useQueryClient();

  const { data: device, isLoading } = useQuery({
    queryKey: ["device", deviceId],
    queryFn: async () => {
      const { data, error } = await supabase.from("devices")
        .select("*, device_groups(id, name), playlists:current_playlist_id(id, name, loop_enabled, playlist_items(id))")
        .eq("id", deviceId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: commands } = useQuery({
    queryKey: ["device-commands", deviceId],
    queryFn: async () => {
      const { data, error } = await supabase.from("commands")
        .select("*").eq("device_id", deviceId)
        .order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: schedules } = useQuery({
    queryKey: ["device-schedules", deviceId, device?.group_id],
    queryFn: async () => {
      const { data } = await supabase.from("schedules")
        .select("id, name, target_type, target_id, playlist_id, content_id, priority, starts_at, ends_at, enabled, playlists(name), content(title)")
        .eq("enabled", true)
        .order("priority", { ascending: false });
      const all = data ?? [];
      return all.filter(s =>
        s.target_type === "all" ||
        (s.target_type === "device" && s.target_id === deviceId) ||
        (s.target_type === "group" && device?.group_id && s.target_id === device.group_id)
      );
    },
    enabled: !!device,
  });

  useEffect(() => {
    const ch = supabase.channel(`device-detail-${deviceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "devices", filter: `id=eq.${deviceId}` },
        () => qc.invalidateQueries({ queryKey: ["device", deviceId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "commands", filter: `device_id=eq.${deviceId}` },
        () => qc.invalidateQueries({ queryKey: ["device-commands", deviceId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [deviceId, qc]);

  if (isLoading) return <div className="p-8"><Skeleton className="h-40 w-full" /></div>;
  if (!device) return <div className="p-8 text-sm text-muted-foreground">Device not found</div>;

  const lastCmd = commands?.[0];
  const lastAcked = commands?.find(c => c.status === "acknowledged");
  const online = device.status === "online";
  const playlist = device.playlists as { id: string; name: string; loop_enabled: boolean; playlist_items: { id: string }[] } | null;
  const group = device.device_groups as { id: string; name: string } | null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
          <Link to="/devices"><ArrowLeft className="mr-1 h-4 w-4" />All devices</Link>
        </Button>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{DEVICE_TYPES.find(t => t.value === device.device_type)?.label}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{device.device_name}</h1>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{device.unique_identifier}</p>
          </div>
          <Badge variant="outline" className={online ? "border-primary/30 bg-primary/10 text-primary gap-1.5" : "border-destructive/30 bg-destructive/10 text-destructive gap-1.5"}>
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}{device.status}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Status" value={device.status} />
        <Stat label="Last heartbeat" value={device.last_seen ? formatDistanceToNow(new Date(device.last_seen), { addSuffix: true }) : "Never"} />
        <Stat label="Last command" value={lastCmd ? formatDistanceToNow(new Date(lastCmd.created_at), { addSuffix: true }) : "—"} />
        <Stat label="Group" value={group?.name ?? "—"} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2"><ListVideo className="h-4 w-4 text-muted-foreground" /><p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Current playlist</p></div>
          {playlist ? (
            <>
              <p className="mt-2 text-sm font-medium">{playlist.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{playlist.playlist_items?.length ?? 0} items · {playlist.loop_enabled ? "looping" : "play once"}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No playlist assigned</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Current content</p>
          {lastAcked ? (
            <>
              <p className="mt-2 text-sm font-medium">{COMMAND_TYPES.find(t => t.value === lastAcked.command_type)?.label}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground break-all line-clamp-2">{JSON.stringify(lastAcked.payload)}</p>
              <p className="mt-2 text-xs text-muted-foreground">Acknowledged {lastAcked.acknowledged_at ? formatDistanceToNow(new Date(lastAcked.acknowledged_at), { addSuffix: true }) : "—"}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No content delivered yet</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Assigned schedules</p>
        </div>
        {(schedules ?? []).length === 0 ? (
          <p className="p-6 text-center text-xs text-muted-foreground">No active schedules target this device</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Target</th><th className="px-4 py-2 font-medium">Plays</th><th className="px-4 py-2 font-medium">Priority</th><th className="px-4 py-2 font-medium">Window</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {schedules?.map((s) => (
                <tr key={s.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2 font-medium">{s.name}</td>
                  <td className="px-4 py-2"><Badge variant="outline">{s.target_type}</Badge></td>
                  <td className="px-4 py-2 text-muted-foreground">{(s.playlists as { name?: string } | null)?.name ?? (s.content as { title?: string } | null)?.title ?? "—"}</td>
                  <td className="px-4 py-2 font-mono">{s.priority}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(s.starts_at), { addSuffix: true })}
                    {s.ends_at && <> → {formatDistanceToNow(new Date(s.ends_at), { addSuffix: true })}</>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Command history</p>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-2 font-medium">Command</th><th className="px-4 py-2 font-medium">Payload</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Issued</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {commands?.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-xs text-muted-foreground">No commands yet</td></tr>
            ) : commands?.map(c => (
              <tr key={c.id} className="hover:bg-muted/20">
                <td className="px-4 py-2 font-medium">{COMMAND_TYPES.find(t => t.value === c.command_type)?.label}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground truncate max-w-sm">{JSON.stringify(c.payload)}</td>
                <td className="px-4 py-2"><Badge variant="outline">{c.status}</Badge></td>
                <td className="px-4 py-2 text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-medium capitalize">{value}</p>
    </div>
  );
}

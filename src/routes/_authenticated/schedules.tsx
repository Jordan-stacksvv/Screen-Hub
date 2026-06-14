import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/schedules")({ component: SchedulesPage });

function SchedulesPage() {
  const qc = useQueryClient();
  const { data: schedules } = useQuery({
    queryKey: ["schedules"],
    queryFn: async () => (await supabase.from("schedules").select("*, playlists(name), content(title)").order("priority", { ascending: false })).data ?? [],
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("schedules").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["schedules"] }); },
  });
  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => { await supabase.from("schedules").update({ enabled }).eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Time-based</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Schedules</h1>
        </div>
        <NewScheduleDialog />
      </header>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">Content</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Window</th><th className="px-4 py-3">Enabled</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(schedules ?? []).length === 0 && (
              <tr><td colSpan={7}>
                <div className="flex flex-col items-center gap-3 p-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><CalendarClock className="h-5 w-5 text-primary" /></div>
                  <p className="text-sm font-medium">No schedules yet</p>
                </div>
              </td></tr>
            )}
            {schedules?.map((s: any) => (
              <tr key={s.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3"><Badge variant="outline">{s.target_type}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">{s.playlists?.name ?? s.content?.title ?? "—"}</td>
                <td className="px-4 py-3 font-mono">{s.priority}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  starts {formatDistanceToNow(new Date(s.starts_at), { addSuffix: true })}
                  {s.ends_at && <> · ends {formatDistanceToNow(new Date(s.ends_at), { addSuffix: true })}</>}
                </td>
                <td className="px-4 py-3"><Switch checked={s.enabled} onCheckedChange={(v) => toggle.mutate({ id: s.id, enabled: v })} /></td>
                <td className="px-4 py-3"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => del.mutate(s.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewScheduleDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [targetType, setTargetType] = useState<"device" | "group" | "all">("all");
  const [targetId, setTargetId] = useState("");
  const [playlistId, setPlaylistId] = useState("");
  const [priority, setPriority] = useState(0);
  const [endsAt, setEndsAt] = useState("");

  const { data: opts } = useQuery({
    queryKey: ["sched-opts"],
    queryFn: async () => {
      const [d, g, p] = await Promise.all([
        supabase.from("devices").select("id, device_name"),
        supabase.from("device_groups").select("id, name"),
        supabase.from("playlists").select("id, name"),
      ]);
      return { devices: d.data ?? [], groups: g.data ?? [], playlists: p.data ?? [] };
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("schedules").insert({
        name, target_type: targetType, target_id: targetType === "all" ? null : targetId,
        playlist_id: playlistId || null, priority,
        ends_at: endsAt || null, created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Scheduled"); qc.invalidateQueries({ queryKey: ["schedules"] }); setOpen(false); setName(""); setPlaylistId(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="glow"><Plus className="mr-2 h-4 w-4" />New schedule</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New schedule</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Morning rotation" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2"><Label>Target</Label>
              <Select value={targetType} onValueChange={(v) => setTargetType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All devices</SelectItem>
                  <SelectItem value="device">Single device</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Priority</Label><Input type="number" value={priority} onChange={(e) => setPriority(parseInt(e.target.value) || 0)} /></div>
          </div>
          {targetType !== "all" && (
            <div className="space-y-2"><Label>Pick {targetType}</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(targetType === "device" ? opts?.devices : opts?.groups)?.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.device_name ?? t.name}</SelectItem>
                ))}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2"><Label>Playlist</Label>
            <Select value={playlistId} onValueChange={setPlaylistId}>
              <SelectTrigger><SelectValue placeholder="Pick a playlist" /></SelectTrigger>
              <SelectContent>{opts?.playlists.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Ends at (optional)</Label><Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></div>
        </div>
        <DialogFooter><Button disabled={!name || !playlistId || create.isPending} onClick={() => create.mutate()}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

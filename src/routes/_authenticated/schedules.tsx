import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Trash2, CalendarClock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { describeRecurrence, parseRecurrence, type Recurrence } from "@/lib/screenhub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/schedules")({ component: SchedulesPage });

const DAYS = [
  { v: 0, l: "S" }, { v: 1, l: "M" }, { v: 2, l: "T" }, { v: 3, l: "W" },
  { v: 4, l: "T" }, { v: 5, l: "F" }, { v: 6, l: "S" },
];

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

  // Simple conflict detection: same target, overlapping windows/recurrence, same day-of-week for weekly.
  const conflicts = useMemo(() => {
    const set = new Set<string>();
    const list = (schedules ?? []).filter(s => s.enabled);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.target_type !== b.target_type) continue;
        if (a.target_type !== "all" && a.target_id !== b.target_id) continue;
        const ra = parseRecurrence(a.recurrence);
        const rb = parseRecurrence(b.recurrence);
        // Weekly with disjoint days = no conflict
        if (ra.kind === "weekly" && rb.kind === "weekly") {
          const overlap = ra.days_of_week.some(d => rb.days_of_week.includes(d));
          if (!overlap) continue;
        }
        set.add(a.id); set.add(b.id);
      }
    }
    return set;
  }, [schedules]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Time-based</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Schedules</h1>
          <p className="mt-1 text-sm text-muted-foreground">Automatically switch content by date, time and day-of-week.</p>
        </div>
        <NewScheduleDialog />
      </header>

      {conflicts.size > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{conflicts.size} schedules overlap for the same targets — the higher-priority one will win.</span>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">Content</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Recurrence</th><th className="px-4 py-3">Window</th><th className="px-4 py-3">Enabled</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(schedules ?? []).length === 0 && (
              <tr><td colSpan={8}>
                <div className="flex flex-col items-center gap-3 p-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><CalendarClock className="h-5 w-5 text-primary" /></div>
                  <p className="text-sm font-medium">No schedules yet</p>
                </div>
              </td></tr>
            )}
            {schedules?.map((s) => (
              <tr key={s.id} className={`hover:bg-muted/20 ${conflicts.has(s.id) ? "bg-warning/5" : ""}`}>
                <td className="px-4 py-3 font-medium">
                  {s.name}
                  {conflicts.has(s.id) && <AlertTriangle className="ml-1 inline h-3 w-3 text-warning" />}
                </td>
                <td className="px-4 py-3"><Badge variant="outline">{s.target_type}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">{s.playlists?.name ?? s.content?.title ?? "—"}</td>
                <td className="px-4 py-3 font-mono">{s.priority}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{describeRecurrence(parseRecurrence(s.recurrence))}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(s.starts_at), { addSuffix: true })}
                  {s.ends_at && <> → {formatDistanceToNow(new Date(s.ends_at), { addSuffix: true })}</>}
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
  const [source, setSource] = useState<"playlist" | "content">("playlist");
  const [playlistId, setPlaylistId] = useState("");
  const [contentId, setContentId] = useState("");
  const [priority, setPriority] = useState(0);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [recKind, setRecKind] = useState<"none" | "daily" | "weekly">("none");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const { data: opts } = useQuery({
    queryKey: ["sched-opts"],
    queryFn: async () => {
      const [d, g, p, c] = await Promise.all([
        supabase.from("devices").select("id, device_name"),
        supabase.from("device_groups").select("id, name"),
        supabase.from("playlists").select("id, name"),
        supabase.from("content").select("id, title, content_type"),
      ]);
      return { devices: d.data ?? [], groups: g.data ?? [], playlists: p.data ?? [], content: c.data ?? [] };
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const recurrence: Recurrence =
        recKind === "none" ? { kind: "none" }
        : recKind === "daily" ? { kind: "daily", time_start: timeStart || undefined, time_end: timeEnd || undefined }
        : { kind: "weekly", days_of_week: days, time_start: timeStart || undefined, time_end: timeEnd || undefined };
      const { error } = await supabase.from("schedules").insert({
        name, target_type: targetType, target_id: targetType === "all" ? null : targetId,
        playlist_id: source === "playlist" ? (playlistId || null) : null,
        content_id: source === "content" ? (contentId || null) : null,
        priority, starts_at: startsAt ? new Date(startsAt).toISOString() : new Date().toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        recurrence: recurrence as unknown as Json,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Scheduled");
      qc.invalidateQueries({ queryKey: ["schedules"] });
      setOpen(false); setName(""); setPlaylistId(""); setContentId(""); setStartsAt(""); setEndsAt("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid = name && (source === "playlist" ? playlistId : contentId) && (recKind !== "weekly" || days.length > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="glow"><Plus className="mr-2 h-4 w-4" />New schedule</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New schedule</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Morning rotation" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2"><Label>Target</Label>
              <Select value={targetType} onValueChange={(v) => setTargetType(v as "device" | "group" | "all")}>
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
                <SelectContent>{(targetType === "device" ? opts?.devices : opts?.groups)?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{"device_name" in t ? t.device_name : t.name}</SelectItem>
                ))}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2"><Label>Display</Label>
            <Select value={source} onValueChange={(v) => setSource(v as "playlist" | "content")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="playlist">Playlist</SelectItem>
                <SelectItem value="content">Single content item</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {source === "playlist" ? (
            <Select value={playlistId} onValueChange={setPlaylistId}>
              <SelectTrigger><SelectValue placeholder="Pick a playlist" /></SelectTrigger>
              <SelectContent>{opts?.playlists.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <Select value={contentId} onValueChange={setContentId}>
              <SelectTrigger><SelectValue placeholder="Pick content" /></SelectTrigger>
              <SelectContent>{opts?.content.map((c) => <SelectItem key={c.id} value={c.id}>{c.title} · {c.content_type}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2"><Label>Starts at</Label><Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></div>
            <div className="space-y-2"><Label>Ends at (optional)</Label><Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></div>
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
            <Label className="text-xs">Recurrence</Label>
            <Tabs value={recKind} onValueChange={(v) => setRecKind(v as typeof recKind)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="none">One-time</TabsTrigger>
                <TabsTrigger value="daily">Daily</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
              </TabsList>
            </Tabs>
            {recKind !== "none" && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="space-y-1"><Label className="text-xs">Time start</Label><Input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Time end</Label><Input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} /></div>
              </div>
            )}
            {recKind === "weekly" && (
              <div className="pt-2">
                <Label className="text-xs">Days of week</Label>
                <div className="mt-1 flex gap-1">
                  {DAYS.map(d => {
                    const active = days.includes(d.v);
                    return (
                      <button key={d.v} type="button" onClick={() => setDays(active ? days.filter(x => x !== d.v) : [...days, d.v])}
                        className={`h-8 w-8 rounded-md border text-xs ${active ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                        {d.l}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter><Button disabled={!valid || create.isPending} onClick={() => create.mutate()}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

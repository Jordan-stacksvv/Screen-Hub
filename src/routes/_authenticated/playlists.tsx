import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Trash2, ListVideo, ChevronUp, ChevronDown, Copy, Repeat, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatDuration } from "@/lib/screenhub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/playlists")({ component: PlaylistsPage });

function PlaylistsPage() {
  const qc = useQueryClient();
  const [active, setActive] = useState<string | null>(null);

  const { data: playlists } = useQuery({
    queryKey: ["playlists"],
    queryFn: async () => (await supabase.from("playlists").select("*, playlist_items(id, duration_seconds)").order("created_at", { ascending: false })).data ?? [],
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Content rotation</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Playlists</h1>
          <p className="mt-1 text-sm text-muted-foreground">Mix images, videos, PDFs and URLs into a looping rotation.</p>
        </div>
        <NewPlaylistDialog onCreated={(id) => { qc.invalidateQueries({ queryKey: ["playlists"] }); setActive(id); }} />
      </header>

      <div className="grid gap-4 md:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          {(playlists ?? []).length === 0 && (
            <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">No playlists yet</div>
          )}
          {playlists?.map((p) => {
            const total = (p.playlist_items ?? []).reduce((s: number, i: { duration_seconds: number }) => s + (i.duration_seconds ?? 0), 0);
            return (
              <button key={p.id} onClick={() => setActive(p.id)}
                className={`block w-full rounded-xl border p-4 text-left transition-colors ${active === p.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}>
                <div className="flex items-center gap-2"><ListVideo className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{p.name}</span></div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{p.playlist_items?.length ?? 0} items</span>
                  <span>·</span>
                  <span>{formatDuration(total)}</span>
                  {p.loop_enabled && <Badge variant="outline" className="ml-1 h-4 gap-1 px-1 text-[10px]"><Repeat className="h-2.5 w-2.5" />loop</Badge>}
                </div>
              </button>
            );
          })}
        </div>
        <div>{active ? <PlaylistEditor playlistId={active} onDeleted={() => { setActive(null); qc.invalidateQueries({ queryKey: ["playlists"] }); }} /> : (
          <div className="flex h-full min-h-64 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            Select a playlist to edit
          </div>
        )}</div>
      </div>
    </div>
  );
}

type Item = { id: string; position: number; duration_seconds: number; content_id: string; content: { title: string; content_type: string } };

function PlaylistEditor({ playlistId, onDeleted }: { playlistId: string; onDeleted: () => void }) {
  const qc = useQueryClient();
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const { data: playlist } = useQuery({
    queryKey: ["playlist", playlistId],
    queryFn: async () => (await supabase.from("playlists").select("*").eq("id", playlistId).maybeSingle()).data,
  });
  const { data: items } = useQuery({
    queryKey: ["playlist-items", playlistId],
    queryFn: async () => (await supabase.from("playlist_items").select("*, content(title, content_type)").eq("playlist_id", playlistId).order("position")).data as Item[] | null ?? [],
  });
  const { data: content } = useQuery({
    queryKey: ["content-brief"],
    queryFn: async () => (await supabase.from("content").select("id, title, content_type")).data ?? [],
  });
  const { data: targets } = useQuery({
    queryKey: ["assign-targets"],
    queryFn: async () => {
      const [devices, groups] = await Promise.all([
        supabase.from("devices").select("id, device_name"),
        supabase.from("device_groups").select("id, name"),
      ]);
      return { devices: devices.data ?? [], groups: groups.data ?? [] };
    },
  });

  const [contentId, setContentId] = useState("");
  const [duration, setDuration] = useState(10);
  const [assignScope, setAssignScope] = useState<"device" | "group" | "all">("device");
  const [assignId, setAssignId] = useState("");

  const totalDuration = useMemo(() => (items ?? []).reduce((s, i) => s + (i.duration_seconds || 0), 0), [items]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["playlist-items", playlistId] });
    qc.invalidateQueries({ queryKey: ["playlists"] });
  };

  const add = useMutation({
    mutationFn: async () => {
      const pos = items?.length ?? 0;
      const { error } = await supabase.from("playlist_items").insert({ playlist_id: playlistId, content_id: contentId, position: pos, duration_seconds: duration });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Added"); invalidate(); setContentId(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("playlist_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: invalidate,
  });
  const duplicate = useMutation({
    mutationFn: async (item: Item) => {
      const pos = items?.length ?? 0;
      const { error } = await supabase.from("playlist_items").insert({ playlist_id: playlistId, content_id: item.content_id, position: pos, duration_seconds: item.duration_seconds });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const move = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: 1 | -1 }) => {
      const list = items ?? [];
      const idx = list.findIndex((i) => i.id === id);
      const swap = list[idx + dir];
      if (!swap) return;
      await supabase.from("playlist_items").update({ position: swap.position }).eq("id", id);
      await supabase.from("playlist_items").update({ position: list[idx].position }).eq("id", swap.id);
    },
    onSuccess: invalidate,
  });
  const reorderMutation = useMutation({
    mutationFn: async (ordered: string[]) => {
      // Assign fresh sequential positions in one pass.
      for (let i = 0; i < ordered.length; i++) {
        await supabase.from("playlist_items").update({ position: i }).eq("id", ordered[i]);
      }
    },
    onSuccess: invalidate,
  });
  const setDurationOn = useMutation({
    mutationFn: async ({ id, seconds }: { id: string; seconds: number }) => {
      await supabase.from("playlist_items").update({ duration_seconds: Math.max(2, seconds) }).eq("id", id);
    },
    onSuccess: invalidate,
  });
  const toggleLoop = useMutation({
    mutationFn: async (v: boolean) => { await supabase.from("playlists").update({ loop_enabled: v }).eq("id", playlistId); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["playlist", playlistId] }); qc.invalidateQueries({ queryKey: ["playlists"] }); },
  });
  const deletePl = useMutation({
    mutationFn: async () => { await supabase.from("playlist_items").delete().eq("playlist_id", playlistId); await supabase.from("playlists").delete().eq("id", playlistId); },
    onSuccess: () => { toast.success("Playlist deleted"); onDeleted(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const assign = useMutation({
    mutationFn: async () => {
      if (assignScope === "device") {
        await supabase.from("devices").update({ current_playlist_id: playlistId }).eq("id", assignId);
      } else if (assignScope === "group") {
        await supabase.from("devices").update({ current_playlist_id: playlistId }).eq("group_id", assignId);
      } else {
        await supabase.from("devices").update({ current_playlist_id: playlistId }).not("id", "is", null);
      }
    },
    onSuccess: () => toast.success("Playlist assigned"),
    onError: (e: Error) => toast.error(e.message),
  });

  const onDragStart = (i: number) => setDragIdx(i);
  const onDrop = (i: number) => {
    if (dragIdx == null || dragIdx === i || !items) { setDragIdx(null); return; }
    const reordered = [...items];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(i, 0, moved);
    reorderMutation.mutate(reordered.map(r => r.id));
    setDragIdx(null);
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{playlist?.name}</h2>
          <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> {formatDuration(totalDuration)} total · {items?.length ?? 0} items
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Repeat className="h-3.5 w-3.5" /> Loop
            <Switch checked={!!playlist?.loop_enabled} onCheckedChange={(v) => toggleLoop.mutate(v)} />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (confirm("Delete this playlist?")) deletePl.mutate(); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-3">
        {(content ?? []).length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-background/50 p-4 text-center text-xs text-muted-foreground">
            No content available. <a href="/content" className="text-primary underline-offset-2 hover:underline">Create content first.</a>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 space-y-1"><Label className="text-xs">Content</Label>
              <Select value={contentId} onValueChange={setContentId}>
                <SelectTrigger><SelectValue placeholder="Pick content" /></SelectTrigger>
                <SelectContent>{content?.map((c) => <SelectItem key={c.id} value={c.id}>{c.title} <span className="text-muted-foreground">· {c.content_type}</span></SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="w-28 space-y-1"><Label className="text-xs">Seconds</Label>
              <Input type="number" min={2} value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 10)} />
            </div>
            <Button disabled={!contentId || add.isPending} onClick={() => add.mutate()}><Plus className="mr-1 h-4 w-4" />Add</Button>
          </div>
        )}
      </div>

      <div className="divide-y divide-border rounded-lg border border-border">
        {(items ?? []).length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">No items yet</div>}
        {items?.map((it, i) => (
          <div key={it.id}
            draggable onDragStart={() => onDragStart(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(i)}
            className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors ${dragIdx === i ? "opacity-40" : ""} hover:bg-muted/20`}>
            <span className="w-6 cursor-grab select-none text-xs font-mono text-muted-foreground">≡ {i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{it.content?.title}</p>
              <p className="text-xs text-muted-foreground">{it.content?.content_type}</p>
            </div>
            <Input type="number" min={2} value={it.duration_seconds}
              onChange={(e) => setDurationOn.mutate({ id: it.id, seconds: parseInt(e.target.value) || 2 })}
              className="h-7 w-16 text-xs" />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move.mutate({ id: it.id, dir: -1 })} title="Move up"><ChevronUp className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move.mutate({ id: it.id, dir: 1 })} title="Move down"><ChevronDown className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => duplicate.mutate(it)} title="Duplicate"><Copy className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => del.mutate(it.id)} title="Remove"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-muted/10 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Assign playback</p>
        <div className="grid grid-cols-[130px_1fr_auto] gap-2">
          <Select value={assignScope} onValueChange={(v) => { setAssignScope(v as typeof assignScope); setAssignId(""); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="device">Device</SelectItem>
              <SelectItem value="group">Group</SelectItem>
              <SelectItem value="all">All devices</SelectItem>
            </SelectContent>
          </Select>
          {assignScope === "all" ? (
            <div className="flex items-center px-3 text-xs text-muted-foreground">Assigns this playlist as the fallback on every device.</div>
          ) : (
            <Select value={assignId} onValueChange={setAssignId}>
              <SelectTrigger><SelectValue placeholder={`Pick ${assignScope}`} /></SelectTrigger>
              <SelectContent>
                {(assignScope === "device" ? targets?.devices : targets?.groups)?.map(t => (
                  <SelectItem key={t.id} value={t.id}>{"device_name" in t ? t.device_name : t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button disabled={(assignScope !== "all" && !assignId) || assign.isPending} onClick={() => assign.mutate()}>Assign</Button>
        </div>
      </div>
    </div>
  );
}

function NewPlaylistDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const create = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("playlists").insert({ name, description: desc || null, created_by: user?.id ?? null }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => { toast.success("Created"); setOpen(false); setName(""); setDesc(""); onCreated(id); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="glow"><Plus className="mr-2 h-4 w-4" />New playlist</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create playlist</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-2"><Label>Description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        </div>
        <DialogFooter><Button disabled={!name || create.isPending} onClick={() => create.mutate()}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

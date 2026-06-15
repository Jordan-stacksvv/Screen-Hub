import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, ListVideo, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/playlists")({ component: PlaylistsPage });

function PlaylistsPage() {
  const qc = useQueryClient();
  const [active, setActive] = useState<string | null>(null);

  const { data: playlists } = useQuery({
    queryKey: ["playlists"],
    queryFn: async () => (await supabase.from("playlists").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Content rotation</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Playlists</h1>
        </div>
        <NewPlaylistDialog onCreated={(id) => { qc.invalidateQueries({ queryKey: ["playlists"] }); setActive(id); }} />
      </header>

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {(playlists ?? []).length === 0 && (
            <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">No playlists yet</div>
          )}
          {playlists?.map((p) => (
            <button key={p.id} onClick={() => setActive(p.id)}
              className={`block w-full rounded-xl border p-4 text-left transition-colors ${active === p.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}>
              <div className="flex items-center gap-2"><ListVideo className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{p.name}</span></div>
              {p.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
            </button>
          ))}
        </div>
        <div>{active ? <PlaylistEditor playlistId={active} /> : (
          <div className="flex h-full min-h-64 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            Select a playlist to edit
          </div>
        )}</div>
      </div>
    </div>
  );
}

function PlaylistEditor({ playlistId }: { playlistId: string }) {
  const qc = useQueryClient();
  const { data: items } = useQuery({
    queryKey: ["playlist-items", playlistId],
    queryFn: async () => (await supabase.from("playlist_items").select("*, content(title, content_type)").eq("playlist_id", playlistId).order("position")).data ?? [],
  });
  const { data: content } = useQuery({
    queryKey: ["content"],
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
  const [assignDevice, setAssignDevice] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const pos = (items?.length ?? 0);
      const { error } = await supabase.from("playlist_items").insert({ playlist_id: playlistId, content_id: contentId, position: pos, duration_seconds: duration });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Added"); qc.invalidateQueries({ queryKey: ["playlist-items", playlistId] }); setContentId(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("playlist_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlist-items", playlistId] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlist-items", playlistId] }),
  });
  const assign = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("devices").update({ current_playlist_id: playlistId }).eq("id", assignDevice);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Assigned to device"),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
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
        {items?.map((it: any, i: number) => (
          <div key={it.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="w-6 text-xs font-mono text-muted-foreground">{i + 1}</span>
            <div className="flex-1"><p className="font-medium">{it.content?.title}</p><p className="text-xs text-muted-foreground">{it.content?.content_type} · {it.duration_seconds}s</p></div>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move.mutate({ id: it.id, dir: -1 })}><ChevronUp className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move.mutate({ id: it.id, dir: 1 })}><ChevronDown className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => del.mutate(it.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-muted/10 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Assign to device</p>
        <div className="flex items-end gap-2">
          <div className="flex-1"><Select value={assignDevice} onValueChange={setAssignDevice}>
            <SelectTrigger><SelectValue placeholder="Pick device" /></SelectTrigger>
            <SelectContent>{targets?.devices.map((d) => <SelectItem key={d.id} value={d.id}>{d.device_name}</SelectItem>)}</SelectContent>
          </Select></div>
          <Button disabled={!assignDevice || assign.isPending} onClick={() => assign.mutate()}>Assign</Button>
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

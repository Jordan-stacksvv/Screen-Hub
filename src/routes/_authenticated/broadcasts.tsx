import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Radio, Send, Trash2, RefreshCw, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { COMMAND_TYPES, type CommandType } from "@/lib/screenhub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/broadcasts")({ component: BroadcastsPage });

type BroadcastRow = {
  id: string; name: string | null; target_type: string; target_id: string | null;
  command_type: CommandType; payload: Record<string, unknown>;
  total_targets: number; issued_by: string | null; created_at: string;
};

function BroadcastsPage() {
  const qc = useQueryClient();
  const { data: broadcasts } = useQuery({
    queryKey: ["broadcasts"],
    queryFn: async () => (await supabase.from("broadcasts").select("*").order("created_at", { ascending: false }).limit(50)).data as BroadcastRow[] | null ?? [],
  });

  useEffect(() => {
    const ch = supabase.channel("bc-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "broadcasts" }, () => qc.invalidateQueries({ queryKey: ["broadcasts"] }))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "commands" }, () => qc.invalidateQueries({ queryKey: ["broadcasts"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Fan-out</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Broadcasts</h1>
        </div>
        <NewBroadcastDialog />
      </header>

      <div className="space-y-3">
        {(broadcasts ?? []).length === 0 && (
          <div className="rounded-xl border border-border bg-card p-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><Radio className="h-5 w-5 text-primary" /></div>
            <p className="mt-4 text-sm font-medium">No broadcasts yet</p>
          </div>
        )}
        {broadcasts?.map((b) => <BroadcastRow key={b.id} broadcast={b} />)}
      </div>
    </div>
  );
}

function BroadcastRow({ broadcast }: { broadcast: BroadcastRow }) {
  const qc = useQueryClient();
  const { data: stats } = useQuery({
    queryKey: ["bc-stats", broadcast.id],
    queryFn: async () => {
      const { data } = await supabase.from("commands").select("status").eq("broadcast_id", broadcast.id);
      const counts = { pending: 0, delivered: 0, acknowledged: 0, failed: 0 };
      for (const c of data ?? []) counts[c.status as keyof typeof counts]++;
      return counts;
    },
  });

  const total = (stats?.pending ?? 0) + (stats?.delivered ?? 0) + (stats?.acknowledged ?? 0) + (stats?.failed ?? 0);
  const ackedPct = total ? Math.round(((stats?.acknowledged ?? 0) / total) * 100) : 0;

  const del = useMutation({
    mutationFn: async () => {
      await supabase.from("commands").delete().eq("broadcast_id", broadcast.id);
      const { error } = await supabase.from("broadcasts").delete().eq("id", broadcast.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["broadcasts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const retry = useMutation({
    mutationFn: async () => {
      // Re-issue failed + pending commands as new pending rows targeting the same devices.
      const { data: failed } = await supabase.from("commands").select("device_id").eq("broadcast_id", broadcast.id).in("status", ["failed", "pending"]);
      const targets = failed?.map(c => c.device_id) ?? [];
      if (!targets.length) throw new Error("Nothing to retry");
      const { data: { user } } = await supabase.auth.getUser();
      const rows = targets.map(id => ({
        device_id: id, command_type: broadcast.command_type, payload: broadcast.payload,
        issued_by: user?.id ?? null, status: "pending" as const, broadcast_id: broadcast.id,
      }));
      const { error } = await supabase.from("commands").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Retry queued"); qc.invalidateQueries({ queryKey: ["bc-stats", broadcast.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <Link to="/broadcasts/$broadcastId" params={{ broadcastId: broadcast.id }} className="group min-w-0 flex-1">
          <p className="font-medium group-hover:text-primary">{broadcast.name ?? COMMAND_TYPES.find(t => t.value === broadcast.command_type)?.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {broadcast.target_type} · {broadcast.total_targets} devices · {formatDistanceToNow(new Date(broadcast.created_at), { addSuffix: true })}
          </p>
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{broadcast.command_type}</Badge>
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Retry failed/pending" onClick={() => retry.mutate()} disabled={retry.isPending}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Delete" onClick={() => del.mutate()} disabled={del.isPending}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
          <Link to="/broadcasts/$broadcastId" params={{ broadcastId: broadcast.id }} className="text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
        <Stat label="Pending" value={stats?.pending ?? 0} c="text-warning" />
        <Stat label="Delivered" value={stats?.delivered ?? 0} c="text-primary" />
        <Stat label="Acked" value={stats?.acknowledged ?? 0} c="text-primary" />
        <Stat label="Failed" value={stats?.failed ?? 0} c="text-destructive" />
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${ackedPct}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">{ackedPct}% acknowledged</p>
    </div>
  );
}
function Stat({ label, value, c }: { label: string; value: number; c: string }) {
  return <div className="rounded-md border border-border bg-muted/20 p-2"><p className="text-[10px] uppercase text-muted-foreground">{label}</p><p className={`mt-1 text-lg font-mono ${c}`}>{value}</p></div>;
}

function NewBroadcastDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState<"device" | "group" | "all">("all");
  const [targetId, setTargetId] = useState("");
  const [type, setType] = useState<CommandType>("open_url");
  const [payload, setPayload] = useState("");
  const [contentId, setContentId] = useState("");
  const [useLibrary, setUseLibrary] = useState(true);

  const { data: opts } = useQuery({
    queryKey: ["bc-opts"],
    queryFn: async () => {
      const [d, g, c] = await Promise.all([
        supabase.from("devices").select("id, device_name"),
        supabase.from("device_groups").select("id, name"),
        supabase.from("content").select("id, title, content_type, file_url"),
      ]);
      return { devices: d.data ?? [], groups: g.data ?? [], content: c.data ?? [] };
    },
  });

  const matchingContent = (opts?.content ?? []).filter(c => {
    if (type === "open_url") return c.content_type === "url";
    if (type === "show_image") return c.content_type === "image";
    if (type === "play_video") return c.content_type === "video";
    if (type === "show_pdf") return c.content_type === "pdf";
    return false;
  });

  const send = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let deviceIds: string[] = [];
      if (target === "all") {
        deviceIds = (await supabase.from("devices").select("id")).data?.map((d) => d.id) ?? [];
      } else if (target === "device") {
        deviceIds = [targetId];
      } else {
        deviceIds = (await supabase.from("devices").select("id").eq("group_id", targetId)).data?.map((d) => d.id) ?? [];
      }
      if (!deviceIds.length) throw new Error("No devices in target");

      let resolvedPayload: Record<string, unknown> = {};
      if (["open_url", "show_image", "play_video", "show_pdf"].includes(type)) {
        if (useLibrary && contentId) {
          const item = matchingContent.find(c => c.id === contentId);
          if (!item) throw new Error("Pick content");
          resolvedPayload = { target: item.file_url, content_id: item.id };
        } else if (payload) {
          resolvedPayload = { target: payload };
        } else {
          throw new Error("Pick content or enter a URL");
        }
      }

      const { data: bc, error: bcErr } = await supabase.from("broadcasts").insert({
        name: name || null, target_type: target, target_id: target === "all" ? null : targetId,
        command_type: type, payload: resolvedPayload,
        total_targets: deviceIds.length, issued_by: user?.id ?? null,
      }).select("id").single();
      if (bcErr) throw bcErr;

      const rows = deviceIds.map((id) => ({
        device_id: id, command_type: type, payload: resolvedPayload,
        issued_by: user?.id ?? null, status: "pending" as const, broadcast_id: bc.id,
      }));
      const { error } = await supabase.from("commands").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Broadcast queued"); qc.invalidateQueries({ queryKey: ["broadcasts"] }); setOpen(false); setName(""); setPayload(""); setContentId(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const needsTarget = ["open_url", "show_image", "play_video", "show_pdf"].includes(type);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="glow"><Send className="mr-2 h-4 w-4" />New broadcast</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Broadcast command</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Name (optional)</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2"><Label>Target</Label>
              <Select value={target} onValueChange={(v) => setTarget(v as "device" | "group" | "all")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All devices</SelectItem>
                  <SelectItem value="device">Single device</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Command</Label>
              <Select value={type} onValueChange={(v) => setType(v as CommandType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COMMAND_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {target !== "all" && (
            <div className="space-y-2"><Label>Pick</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(target === "device" ? opts?.devices : opts?.groups)?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{"device_name" in t ? t.device_name : t.name}</SelectItem>
                ))}</SelectContent>
              </Select>
            </div>
          )}
          {needsTarget && (
            <>
              <div className="flex gap-2 rounded-md border border-border bg-muted/20 p-1 text-xs">
                <button type="button" onClick={() => setUseLibrary(true)} className={`flex-1 rounded px-2 py-1 transition-colors ${useLibrary ? "bg-card font-medium" : "text-muted-foreground"}`}>From library</button>
                <button type="button" onClick={() => setUseLibrary(false)} className={`flex-1 rounded px-2 py-1 transition-colors ${!useLibrary ? "bg-card font-medium" : "text-muted-foreground"}`}>Direct URL</button>
              </div>
              {useLibrary ? (
                matchingContent.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No matching content. <a href="/content" className="text-primary hover:underline">Create content first.</a></p>
                ) : (
                  <div className="space-y-2"><Label>Content</Label>
                    <Select value={contentId} onValueChange={setContentId}>
                      <SelectTrigger><SelectValue placeholder="Pick from library" /></SelectTrigger>
                      <SelectContent>{matchingContent.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )
              ) : (
                <div className="space-y-2"><Label>URL</Label><Input value={payload} onChange={(e) => setPayload(e.target.value)} placeholder="https://…" /></div>
              )}
            </>
          )}
        </div>
        <DialogFooter><Button disabled={send.isPending} onClick={() => send.mutate()}>Send</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

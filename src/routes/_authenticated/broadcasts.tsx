import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Radio, Send, Trash2, RefreshCw, ChevronRight, Copy, XCircle, Play, Terminal, Square, RotateCw, Power } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { CONTROL_COMMANDS, type CommandType, type LibrarySelection, selectionToCommand, labelForCommand } from "@/lib/screenhub";
import { ContentPicker } from "@/components/ContentPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/broadcasts")({ component: BroadcastsPage });

const CONTROL_ICONS: Record<string, typeof Square> = {
  stop_playback: Square, refresh_device: RefreshCw, reload_content: RotateCw, reboot: Power,
};

type BroadcastRow = {
  id: string; name: string | null; target_type: "device" | "group" | "all"; target_id: string | null;
  command_type: CommandType; payload: Record<string, string>;
  total_targets: number; issued_by: string | null; created_at: string; status: string;
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
          <p className="mt-1 text-sm text-muted-foreground">Push content or control actions to multiple devices at once.</p>
        </div>
        <NewBroadcastDialog />
      </header>

      <div className="space-y-3">
        {(broadcasts ?? []).length === 0 && (
          <div className="rounded-xl border border-border bg-card p-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><Radio className="h-5 w-5 text-primary" /></div>
            <p className="mt-4 text-sm font-medium">No broadcasts yet</p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">Broadcasts let you push the same content to every device in a group at once.</p>
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
      const { data } = await supabase.from("commands").select("status, delivered_at, acknowledged_at").eq("broadcast_id", broadcast.id);
      const counts = { pending: 0, delivered: 0, acknowledged: 0, failed: 0 };
      let last: number | null = null;
      for (const c of data ?? []) {
        counts[c.status as keyof typeof counts]++;
        const t = c.acknowledged_at ?? c.delivered_at;
        if (t) { const ts = new Date(t).getTime(); if (last == null || ts > last) last = ts; }
      }
      return { ...counts, last_delivery: last };
    },
  });

  const total = (stats?.pending ?? 0) + (stats?.delivered ?? 0) + (stats?.acknowledged ?? 0) + (stats?.failed ?? 0);
  const done = (stats?.delivered ?? 0) + (stats?.acknowledged ?? 0);
  const successPct = total ? Math.round((done / total) * 100) : 0;
  const cancelled = broadcast.status === "cancelled";

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

  const cancelPending = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("commands").update({ status: "failed", result: { cancelled: true } }).eq("broadcast_id", broadcast.id).eq("status", "pending");
      if (error) throw error;
      await supabase.from("broadcasts").update({ status: "cancelled" }).eq("id", broadcast.id);
    },
    onSuccess: () => { toast.success("Pending commands cancelled"); qc.invalidateQueries({ queryKey: ["broadcasts"] }); qc.invalidateQueries({ queryKey: ["bc-stats", broadcast.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let deviceIds: string[] = [];
      if (broadcast.target_type === "all") {
        deviceIds = (await supabase.from("devices").select("id")).data?.map(d => d.id) ?? [];
      } else if (broadcast.target_type === "device") {
        deviceIds = broadcast.target_id ? [broadcast.target_id] : [];
      } else {
        deviceIds = (await supabase.from("devices").select("id").eq("group_id", broadcast.target_id!)).data?.map(d => d.id) ?? [];
      }
      if (!deviceIds.length) throw new Error("No devices for this target");
      const { data: bc, error } = await supabase.from("broadcasts").insert({
        name: broadcast.name ? `${broadcast.name} (copy)` : null,
        target_type: broadcast.target_type, target_id: broadcast.target_id,
        command_type: broadcast.command_type, payload: broadcast.payload,
        total_targets: deviceIds.length, issued_by: user?.id ?? null,
      }).select("id").single();
      if (error) throw error;
      const rows = deviceIds.map(id => ({
        device_id: id, command_type: broadcast.command_type, payload: broadcast.payload,
        issued_by: user?.id ?? null, status: "pending" as const, broadcast_id: bc.id,
      }));
      await supabase.from("commands").insert(rows);
    },
    onSuccess: () => { toast.success("Broadcast duplicated"); qc.invalidateQueries({ queryKey: ["broadcasts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <Link to="/broadcasts/$broadcastId" params={{ broadcastId: broadcast.id }} className="group min-w-0 flex-1">
          <p className="font-medium group-hover:text-primary">{broadcast.name ?? labelForCommand(broadcast.command_type)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {broadcast.target_type} · {broadcast.total_targets} devices · {formatDistanceToNow(new Date(broadcast.created_at), { addSuffix: true })}
            {stats?.last_delivery && <> · last delivery {formatDistanceToNow(new Date(stats.last_delivery), { addSuffix: true })}</>}
          </p>
        </Link>
        <div className="flex items-center gap-1">
          <Badge variant="outline">{labelForCommand(broadcast.command_type)}</Badge>
          {cancelled && <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">cancelled</Badge>}
          {(stats?.pending ?? 0) > 0 && !cancelled && (
            <Button size="icon" variant="ghost" className="h-7 w-7" title="Cancel pending" onClick={() => cancelPending.mutate()} disabled={cancelPending.isPending}>
              <XCircle className="h-3.5 w-3.5 text-warning" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Duplicate" onClick={() => duplicate.mutate()} disabled={duplicate.isPending}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
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
      <div className="mt-3 grid grid-cols-5 gap-2 text-xs">
        <Stat label="Pending" value={stats?.pending ?? 0} c="text-warning" />
        <Stat label="Delivered" value={stats?.delivered ?? 0} c="text-primary" />
        <Stat label="Acked" value={stats?.acknowledged ?? 0} c="text-primary" />
        <Stat label="Failed" value={stats?.failed ?? 0} c="text-destructive" />
        <Stat label="Success %" value={`${successPct}%`} c="text-foreground" />
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${successPct}%` }} />
      </div>
    </div>
  );
}

function Stat({ label, value, c }: { label: string; value: number | string; c: string }) {
  return <div className="rounded-md border border-border bg-muted/20 p-2"><p className="text-[10px] uppercase text-muted-foreground">{label}</p><p className={`mt-1 text-lg font-mono ${c}`}>{value}</p></div>;
}

function NewBroadcastDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState<"device" | "group" | "all">("all");
  const [targetId, setTargetId] = useState("");
  const [mode, setMode] = useState<"content" | "control">("content");
  const [selection, setSelection] = useState<LibrarySelection | null>(null);
  const [control, setControl] = useState<CommandType>("stop_playback");

  const { data: opts } = useQuery({
    queryKey: ["bc-opts"],
    queryFn: async () => {
      const [d, g] = await Promise.all([
        supabase.from("devices").select("id, device_name"),
        supabase.from("device_groups").select("id, name"),
      ]);
      return { devices: d.data ?? [], groups: g.data ?? [] };
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let deviceIds: string[] = [];
      if (target === "all") deviceIds = (await supabase.from("devices").select("id")).data?.map((d) => d.id) ?? [];
      else if (target === "device") deviceIds = targetId ? [targetId] : [];
      else deviceIds = (await supabase.from("devices").select("id").eq("group_id", targetId)).data?.map((d) => d.id) ?? [];
      if (!deviceIds.length) throw new Error("No devices in target");

      let command_type: CommandType;
      let payload: Record<string, string> = {};
      if (mode === "content") {
        if (!selection) throw new Error("Pick something from the library");
        ({ command_type, payload } = selectionToCommand(selection));
      } else {
        command_type = control;
      }

      const { data: bc, error: bcErr } = await supabase.from("broadcasts").insert({
        name: name || null, target_type: target, target_id: target === "all" ? null : targetId,
        command_type, payload, total_targets: deviceIds.length, issued_by: user?.id ?? null,
      }).select("id").single();
      if (bcErr) throw bcErr;

      const rows = deviceIds.map((id) => ({
        device_id: id, command_type, payload,
        issued_by: user?.id ?? null, status: "pending" as const, broadcast_id: bc.id,
      }));
      const { error } = await supabase.from("commands").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Broadcast queued");
      qc.invalidateQueries({ queryKey: ["broadcasts"] });
      setOpen(false); setName(""); setSelection(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="glow"><Send className="mr-2 h-4 w-4" />New broadcast</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Broadcast to devices</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Name (optional)</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Monday lunch menu" /></div>
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
            {target !== "all" && (
              <div className="space-y-2"><Label>Pick {target}</Label>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(target === "device" ? opts?.devices : opts?.groups)?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{"device_name" in t ? t.device_name : t.name}</SelectItem>
                  ))}</SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "content" | "control")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="content"><Play className="mr-1.5 h-3.5 w-3.5" />Content</TabsTrigger>
              <TabsTrigger value="control"><Terminal className="mr-1.5 h-3.5 w-3.5" />Action</TabsTrigger>
            </TabsList>
            <TabsContent value="content" className="mt-3 space-y-2">
              <ContentPicker value={selection} onChange={setSelection} />
              {selection && (
                <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                  Will broadcast <span className="font-medium text-primary">{labelForCommand(selectionToCommand(selection).command_type)}</span> → {selection.title}
                </p>
              )}
            </TabsContent>
            <TabsContent value="control" className="mt-3">
              <div className="grid grid-cols-2 gap-2">
                {CONTROL_COMMANDS.map(c => {
                  const Icon = CONTROL_ICONS[c.value] ?? Terminal;
                  const active = control === c.value;
                  return (
                    <button key={c.value} type="button" onClick={() => setControl(c.value)}
                      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{c.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{c.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={send.isPending || (mode === "content" && !selection) || (target !== "all" && !targetId)} onClick={() => send.mutate()}>
            <Send className="mr-2 h-4 w-4" />Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Radio, Send } from "lucide-react";
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

function BroadcastsPage() {
  const qc = useQueryClient();
  const { data: broadcasts } = useQuery({
    queryKey: ["broadcasts"],
    queryFn: async () => (await supabase.from("broadcasts").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [],
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
        {broadcasts?.map((b: any) => <BroadcastRow key={b.id} broadcast={b} />)}
      </div>
    </div>
  );
}

function BroadcastRow({ broadcast }: { broadcast: any }) {
  const { data: stats } = useQuery({
    queryKey: ["bc-stats", broadcast.id],
    queryFn: async () => {
      const { data } = await supabase.from("commands").select("status").eq("broadcast_id", broadcast.id);
      const counts = { pending: 0, delivered: 0, acknowledged: 0, failed: 0 };
      for (const c of data ?? []) counts[c.status as keyof typeof counts]++;
      return counts;
    },
  });
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium">{broadcast.name ?? COMMAND_TYPES.find(t => t.value === broadcast.command_type)?.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {broadcast.target_type} · {broadcast.total_targets} devices · {formatDistanceToNow(new Date(broadcast.created_at), { addSuffix: true })}
          </p>
        </div>
        <Badge variant="outline">{broadcast.command_type}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
        <Stat label="Pending" value={stats?.pending ?? 0} c="text-warning" />
        <Stat label="Delivered" value={stats?.delivered ?? 0} c="text-primary" />
        <Stat label="Acked" value={stats?.acknowledged ?? 0} c="text-primary" />
        <Stat label="Failed" value={stats?.failed ?? 0} c="text-destructive" />
      </div>
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
      // Resolve target devices
      let deviceIds: string[] = [];
      if (target === "all") {
        deviceIds = (await supabase.from("devices").select("id")).data?.map((d) => d.id) ?? [];
      } else if (target === "device") {
        deviceIds = [targetId];
      } else {
        deviceIds = (await supabase.from("devices").select("id").eq("group_id", targetId)).data?.map((d) => d.id) ?? [];
      }
      if (!deviceIds.length) throw new Error("No devices in target");

      const { data: bc, error: bcErr } = await supabase.from("broadcasts").insert({
        name: name || null, target_type: target, target_id: target === "all" ? null : targetId,
        command_type: type, payload: payload ? { target: payload } : {},
        total_targets: deviceIds.length, issued_by: user?.id ?? null,
      }).select("id").single();
      if (bcErr) throw bcErr;

      const rows = deviceIds.map((id) => ({
        device_id: id, command_type: type, payload: payload ? { target: payload } : {},
        issued_by: user?.id ?? null, status: "pending" as const, broadcast_id: bc.id,
      }));
      const { error } = await supabase.from("commands").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Broadcast queued"); qc.invalidateQueries({ queryKey: ["broadcasts"] }); setOpen(false); setName(""); setPayload(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="glow"><Send className="mr-2 h-4 w-4" />New broadcast</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Broadcast command</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Name (optional)</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2"><Label>Target</Label>
              <Select value={target} onValueChange={(v) => setTarget(v as any)}>
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
                <SelectContent>{(target === "device" ? opts?.devices : opts?.groups)?.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.device_name ?? t.name}</SelectItem>
                ))}</SelectContent>
              </Select>
            </div>
          )}
          {["open_url", "show_image", "play_video", "show_pdf"].includes(type) && (
            <div className="space-y-2"><Label>URL</Label><Input value={payload} onChange={(e) => setPayload(e.target.value)} placeholder="https://…" /></div>
          )}
        </div>
        <DialogFooter><Button disabled={send.isPending} onClick={() => send.mutate()}>Send</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

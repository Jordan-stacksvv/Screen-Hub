import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Layers, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { COMMAND_TYPES, type CommandType } from "@/lib/screenhub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/groups")({ component: GroupsPage });

function GroupsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["groups-detail"],
    queryFn: async () => {
      const { data: groups } = await supabase.from("device_groups").select("*").order("created_at", { ascending: false });
      const { data: devices } = await supabase.from("devices").select("id, group_id, status");
      return (groups ?? []).map((g) => {
        const members = (devices ?? []).filter((d) => d.group_id === g.id);
        return { ...g, total: members.length, online: members.filter((m) => m.status === "online").length };
      });
    },
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("device_groups").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Group deleted"); qc.invalidateQueries({ queryKey: ["groups-detail"] }); },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Organization</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Groups</h1>
        </div>
        <NewGroupDialog />
      </header>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><Layers className="h-5 w-5 text-primary" /></div>
          <p className="mt-4 text-sm font-medium">No groups yet</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data?.map((g) => (
            <div key={g.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{g.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{g.description ?? "—"}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => del.mutate(g.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
                <div><p className="text-muted-foreground">Devices</p><p className="font-mono text-base">{g.total}</p></div>
                <div><p className="text-muted-foreground">Online</p><p className="font-mono text-base text-primary">{g.online}</p></div>
              </div>
              <BroadcastButton groupId={g.id} groupName={g.name} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BroadcastButton({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CommandType>("open_url");
  const [payload, setPayload] = useState("");
  const send = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const devices = (await supabase.from("devices").select("id").eq("group_id", groupId)).data ?? [];
      if (!devices.length) throw new Error("No devices in group");
      const { data: bc } = await supabase.from("broadcasts").insert({
        name: `Group: ${groupName}`, target_type: "group", target_id: groupId,
        command_type: type, payload: payload ? { target: payload } : {},
        total_targets: devices.length, issued_by: user?.id ?? null,
      }).select("id").single();
      await supabase.from("commands").insert(devices.map((d) => ({
        device_id: d.id, command_type: type, payload: payload ? { target: payload } : {},
        issued_by: user?.id ?? null, status: "pending" as const, broadcast_id: bc!.id,
      })));
    },
    onSuccess: () => { toast.success("Broadcast sent"); setOpen(false); setPayload(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm" className="mt-3 w-full"><Send className="mr-2 h-3.5 w-3.5" />Broadcast</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Broadcast to {groupName}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Command</Label>
            <Select value={type} onValueChange={(v) => setType(v as CommandType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{COMMAND_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {["open_url", "show_image", "play_video", "show_pdf"].includes(type) && (
            <div className="space-y-2"><Label>URL</Label><Input value={payload} onChange={(e) => setPayload(e.target.value)} placeholder="https://…" /></div>
          )}
        </div>
        <DialogFooter><Button disabled={send.isPending} onClick={() => send.mutate()}>Send</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewGroupDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const create = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("device_groups").insert({ name, description: desc || null, created_by: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Group created"); qc.invalidateQueries({ queryKey: ["groups-detail"] }); setOpen(false); setName(""); setDesc(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="glow"><Plus className="mr-2 h-4 w-4" />New group</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create group</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        </div>
        <DialogFooter><Button disabled={!name || create.isPending} onClick={() => create.mutate()}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

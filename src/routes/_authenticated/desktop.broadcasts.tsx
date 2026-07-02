import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Radio, Send, Copy, XCircle, RefreshCw, Users, MonitorSmartphone, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { selectionToCommand, type LibrarySelection, type CommandType } from "@/lib/screenhub";
import { ContentPicker } from "@/components/ContentPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useRecent } from "@/desktop/hooks/use-recent";
import { bridge } from "@/desktop/bridge";

export const Route = createFileRoute("/_authenticated/desktop/broadcasts")({ component: DesktopBroadcasts });

function DesktopBroadcasts() {
  const qc = useQueryClient();
  const [selection, setSelection] = useState<LibrarySelection | null>(null);
  const [name, setName] = useState("");
  const [tab, setTab] = useState<"all" | "devices" | "groups">("all");
  const [targetDevices, setTargetDevices] = useState<Set<string>>(new Set());
  const [targetGroups, setTargetGroups] = useState<Set<string>>(new Set());
  const recentTargets = useRecent("broadcast-targets", 6);

  const { data: devices } = useQuery({
    queryKey: ["desktop-bc-devices"],
    queryFn: async () => (await supabase.from("devices").select("id, device_name, status, group_id").order("device_name")).data ?? [],
  });
  const { data: groups } = useQuery({
    queryKey: ["desktop-bc-groups"],
    queryFn: async () => (await supabase.from("device_groups").select("id, name")).data ?? [],
  });
  const { data: history } = useQuery({
    queryKey: ["desktop-bc-history"],
    queryFn: async () => (await supabase.from("broadcasts").select("id, name, command_type, created_at, total_targets, status, target_type, payload").order("created_at", { ascending: false }).limit(20)).data ?? [],
    refetchInterval: 8000,
  });

  const targetCount = tab === "all" ? (devices ?? []).length : tab === "devices" ? targetDevices.size : (devices ?? []).filter(d => d.group_id && targetGroups.has(d.group_id as string)).length;

  const send = async () => {
    if (!selection) { toast.error("Pick something from the library."); return; }
    const { command_type, payload } = selectionToCommand(selection);
    const { data: { user } } = await supabase.auth.getUser();

    let deviceIds: string[] = [];
    let target_type: "device" | "group" | "all" = "all";
    let target_id: string | null = null;

    if (tab === "all") {
      deviceIds = (devices ?? []).map(d => d.id);
      target_type = "all";
    } else if (tab === "devices") {
      deviceIds = Array.from(targetDevices);
      target_type = "device";
    } else {
      const ids = Array.from(targetGroups);
      const { data: rows } = await supabase.from("devices").select("id, group_id").in("group_id", ids);
      deviceIds = (rows ?? []).map(r => r.id);
      target_type = "group";
      if (ids.length === 1) target_id = ids[0];
    }
    if (!deviceIds.length) { toast.error("No target devices."); return; }

    const { data: bc, error: bcErr } = await supabase.from("broadcasts").insert({
      name: name || selection.title, target_type, target_id,
      command_type: command_type as CommandType, payload,
      total_targets: deviceIds.length, issued_by: user?.id ?? null, status: "active",
    }).select("id").maybeSingle();
    if (bcErr) { toast.error(bcErr.message); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = deviceIds.map(device_id => ({ device_id, command_type, payload, issued_by: user?.id ?? null, status: "pending" as const, broadcast_id: bc?.id })) as any;
    const { error } = await supabase.from("commands").insert(rows);
    if (error) { toast.error(error.message); return; }

    toast.success(`Broadcast sent to ${deviceIds.length} device(s)`);
    bridge().notify({ title: "Broadcast sent", body: `${deviceIds.length} device(s)` });
    for (const d of deviceIds.slice(0, 3)) recentTargets.push(d);
    setSelection(null); setName("");
    qc.invalidateQueries({ queryKey: ["desktop-bc-history"] });
  };

  const duplicate = async (b: { id: string; name: string | null; command_type: string; payload: unknown; target_type: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const deviceIds = (devices ?? []).map(d => d.id);
    const { data: bc } = await supabase.from("broadcasts").insert({
      name: `${b.name ?? b.command_type} (copy)`, target_type: b.target_type as "device" | "group" | "all",
      command_type: b.command_type as CommandType, payload: b.payload,
      total_targets: deviceIds.length, issued_by: user?.id ?? null, status: "active",
    }).select("id").maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from("commands").insert(deviceIds.map(id => ({ device_id: id, command_type: b.command_type, payload: b.payload, issued_by: user?.id ?? null, status: "pending", broadcast_id: bc?.id })) as any);
    toast.success("Broadcast duplicated");
    qc.invalidateQueries({ queryKey: ["desktop-bc-history"] });
  };

  const cancel = async (id: string) => {
    await supabase.from("broadcasts").update({ status: "cancelled" }).eq("id", id);
    await supabase.from("commands").update({ status: "failed" }).eq("broadcast_id", id).eq("status", "pending");
    toast.success("Cancelled");
    qc.invalidateQueries({ queryKey: ["desktop-bc-history"] });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <header>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Broadcasts</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">New broadcast</h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 text-xs font-medium">1 · Content</h2>
          <ContentPicker value={selection} onChange={setSelection} />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional label" className="mt-2 h-8 text-xs" />
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 text-xs font-medium">2 · Targets</h2>
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all"><Globe className="mr-1 h-3 w-3" />All</TabsTrigger>
              <TabsTrigger value="devices"><MonitorSmartphone className="mr-1 h-3 w-3" />Devices</TabsTrigger>
              <TabsTrigger value="groups"><Users className="mr-1 h-3 w-3" />Groups</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="mt-3 rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              Send to every device ({(devices ?? []).length} total).
            </TabsContent>
            <TabsContent value="devices" className="mt-3">
              <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
                {(devices ?? []).map(d => (
                  <li key={d.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                    <Checkbox checked={targetDevices.has(d.id)} onCheckedChange={() => { setTargetDevices(prev => { const n = new Set(prev); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; }); }} />
                    <span className="flex-1 truncate">{d.device_name}</span>
                    <span className="text-[10px] text-muted-foreground">{d.status}</span>
                  </li>
                ))}
              </ul>
            </TabsContent>
            <TabsContent value="groups" className="mt-3">
              <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
                {(groups ?? []).map(g => (
                  <li key={g.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                    <Checkbox checked={targetGroups.has(g.id)} onCheckedChange={() => { setTargetGroups(prev => { const n = new Set(prev); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; }); }} />
                    <span className="flex-1 truncate">{g.name}</span>
                  </li>
                ))}
                {(groups ?? []).length === 0 && <li className="p-4 text-center text-xs text-muted-foreground">No groups.</li>}
              </ul>
            </TabsContent>
          </Tabs>
          {recentTargets.items.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Recent</p>
              <div className="flex flex-wrap gap-1">
                {recentTargets.items.map((id) => {
                  const d = (devices ?? []).find(x => x.id === id);
                  if (!d) return null;
                  return <Badge key={id} variant="outline" className="cursor-pointer text-[10px]" onClick={() => { setTab("devices"); setTargetDevices(prev => new Set(prev).add(id)); }}>{d.device_name}</Badge>;
                })}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 text-xs font-medium">3 · Review & send</h2>
          <div className="space-y-2 text-xs">
            <Row label="Content" value={selection ? selection.title : <span className="text-muted-foreground">Nothing selected</span>} />
            <Row label="Targets" value={<>{targetCount} device(s) · {tab}</>} />
            <Row label="Name" value={name || <span className="text-muted-foreground">Auto</span>} />
          </div>
          <Button className="mt-4 w-full" disabled={!selection || targetCount === 0} onClick={send}>
            <Send className="mr-1 h-3.5 w-3.5" />Send broadcast
          </Button>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <Radio className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">History</span>
        </div>
        <ul className="divide-y divide-border">
          {(history ?? []).map(b => (
            <li key={b.id} className="flex items-center gap-3 px-4 py-2 text-xs">
              <Link to="/broadcasts/$broadcastId" params={{ broadcastId: b.id }} className="min-w-0 flex-1 truncate hover:text-primary">
                {b.name ?? b.command_type}
              </Link>
              <span className="text-[10px] text-muted-foreground">{b.total_targets} targets</span>
              <Badge variant="outline" className="text-[10px]">{b.status}</Badge>
              <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}</span>
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => duplicate(b)} title="Duplicate"><Copy className="h-3 w-3" /></Button>
              {b.status === "active" && <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={() => cancel(b.id)} title="Cancel"><XCircle className="h-3 w-3" /></Button>}
            </li>
          ))}
          {(history ?? []).length === 0 && <li className="p-6 text-center text-xs text-muted-foreground">No broadcasts yet.</li>}
        </ul>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-1"><span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span><span className="truncate">{value}</span></div>;
}

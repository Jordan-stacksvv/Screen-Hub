import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, MoreVertical, Trash2, Pencil, MonitorSmartphone, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { DEVICE_TYPES, type DeviceType } from "@/lib/screenhub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/devices")({
  component: DevicesPage,
});

function DevicesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["devices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devices")
        .select("*, device_groups(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const ch = supabase.channel("devices-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "devices" }, () => qc.invalidateQueries({ queryKey: ["devices"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const filtered = (data ?? []).filter(d => {
    const matchSearch = !search || d.device_name.toLowerCase().includes(search.toLowerCase()) || d.unique_identifier.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || d.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Fleet</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Devices</h1>
        </div>
        <div className="flex gap-2">
          <ClaimCodeDialog />
          <AddDeviceDialog />
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search by name or identifier…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
            <SelectItem value="unregistered">Unregistered</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Device</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Group</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last seen</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? Array.from({ length: 4 }).map((_, i) => (
              <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td></tr>
            )) : filtered.length === 0 ? (
              <tr><td colSpan={6}>
                <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <MonitorSmartphone className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium">No devices yet</p>
                  <p className="max-w-xs text-xs text-muted-foreground">Register your first device to start streaming content. You'll get a unique identifier to enroll the client app.</p>
                </div>
              </td></tr>
            ) : filtered.map((d) => (
              <DeviceRow key={d.id} device={d} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeviceRow({ device }: { device: any }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("devices").delete().eq("id", device.id); if (error) throw error; },
    onSuccess: () => { toast.success("Device deleted"); qc.invalidateQueries({ queryKey: ["devices"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <tr className="hover:bg-muted/20">
      <td className="px-4 py-3">
        <Link to="/devices/$deviceId" params={{ deviceId: device.id }} className="block hover:text-primary">
          <p className="font-medium">{device.device_name}</p>
          <p className="font-mono text-xs text-muted-foreground">{device.unique_identifier}</p>
        </Link>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{DEVICE_TYPES.find(t => t.value === device.device_type)?.label}</td>
      <td className="px-4 py-3 text-muted-foreground">{device.device_groups?.name ?? "—"}</td>
      <td className="px-4 py-3"><StatusPill status={device.status} /></td>
      <td className="px-4 py-3 text-muted-foreground">{device.last_seen ? formatDistanceToNow(new Date(device.last_seen), { addSuffix: true }) : "Never"}</td>
      <td className="px-4 py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => del.mutate()} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { c: string; dot: string }> = {
    online: { c: "border-primary/30 bg-primary/10 text-primary", dot: "bg-primary" },
    offline: { c: "border-destructive/30 bg-destructive/10 text-destructive", dot: "bg-destructive" },
    unregistered: { c: "border-border bg-muted/40 text-muted-foreground", dot: "bg-muted-foreground" },
  };
  const s = map[status] ?? map.unregistered;
  return (
    <Badge variant="outline" className={`gap-1.5 ${s.c}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${status === "online" ? "animate-pulse" : ""}`} />
      {status}
    </Badge>
  );
}

function AddDeviceDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<DeviceType>("android_tv");
  const [os, setOs] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const identifier = `sh_${crypto.randomUUID().slice(0, 12)}`;
      const { error } = await supabase.from("devices").insert({
        device_name: name, device_type: type, operating_system: os || null,
        unique_identifier: identifier, status: "unregistered",
      });
      if (error) throw error;
      return identifier;
    },
    onSuccess: (id) => {
      toast.success(`Device registered. ID: ${id}`);
      qc.invalidateQueries({ queryKey: ["devices"] });
      setOpen(false); setName(""); setOs("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="glow"><Plus className="mr-2 h-4 w-4" />Register device</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register a new device</DialogTitle>
          <DialogDescription>You'll get a unique identifier to enroll the client app on this screen.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Device name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lobby TV" /></div>
          <div className="space-y-2"><Label>Device type</Label>
            <Select value={type} onValueChange={(v) => setType(v as DeviceType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DEVICE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Operating system <span className="text-muted-foreground">(optional)</span></Label><Input value={os} onChange={(e) => setOs(e.target.value)} placeholder="Android 13" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!name || create.isPending} onClick={() => create.mutate()}>Register</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClaimCodeDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<DeviceType>("android_tv");

  const claim = useMutation({
    mutationFn: async () => {
      const upper = code.trim().toUpperCase();
      const { data: pc, error: pcErr } = await supabase.from("pairing_codes")
        .select("id, device_id, expires_at, metadata").eq("code", upper).maybeSingle();
      if (pcErr) throw pcErr;
      if (!pc) throw new Error("Code not found. The client must show the code first.");
      if (new Date(pc.expires_at).getTime() < Date.now()) throw new Error("Code expired");
      if (pc.device_id) throw new Error("Code already claimed");

      const identifier = `sh_${crypto.randomUUID().slice(0, 12)}`;
      const { data: { user } } = await supabase.auth.getUser();
      const { data: dev, error: devErr } = await supabase.from("devices").insert({
        device_name: name, device_type: type, unique_identifier: identifier,
        status: "unregistered", created_by: user?.id ?? null,
      }).select("id").single();
      if (devErr) throw devErr;

      const { error: upErr } = await supabase.from("pairing_codes").update({
        device_id: dev.id, claimed_at: new Date().toISOString(), claimed_by: user?.id ?? null,
      }).eq("id", pc.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      toast.success("Claimed — client will provision in a few seconds");
      qc.invalidateQueries({ queryKey: ["devices"] });
      setOpen(false); setCode(""); setName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><KeyRound className="mr-2 h-4 w-4" />Claim code</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Claim pairing code</DialogTitle>
          <DialogDescription>Enter the 6-character code shown on the device's screen.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Pairing code</Label><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" className="font-mono tracking-widest" maxLength={8} /></div>
          <div className="space-y-2"><Label>Device name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lobby TV" /></div>
          <div className="space-y-2"><Label>Device type</Label>
            <Select value={type} onValueChange={(v) => setType(v as DeviceType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DEVICE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!code || !name || claim.isPending} onClick={() => claim.mutate()}>Claim</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

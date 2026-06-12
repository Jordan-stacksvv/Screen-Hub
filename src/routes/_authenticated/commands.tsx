import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Send, Terminal } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { COMMAND_TYPES, type CommandType } from "@/lib/screenhub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/commands")({ component: CommandsPage });

function CommandsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["commands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commands")
        .select("*, devices(device_name, device_type)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const ch = supabase.channel("cmd-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "commands" }, () => qc.invalidateQueries({ queryKey: ["commands"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Control</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Commands</h1>
        </div>
        <SendCommandDialog />
      </header>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Command</th>
              <th className="px-4 py-3 font-medium">Target device</th>
              <th className="px-4 py-3 font-medium">Payload</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Issued</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}><td colSpan={5} className="px-4 py-3"><Skeleton className="h-6 w-full" /></td></tr>
            )) : data?.length === 0 ? (
              <tr><td colSpan={5}>
                <div className="flex flex-col items-center gap-3 p-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><Terminal className="h-5 w-5 text-primary" /></div>
                  <p className="text-sm font-medium">No commands yet</p>
                  <p className="max-w-xs text-xs text-muted-foreground">Send a command to display content on a device.</p>
                </div>
              </td></tr>
            ) : data?.map((c: any) => (
              <tr key={c.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{COMMAND_TYPES.find(t => t.value === c.command_type)?.label}</td>
                <td className="px-4 py-3">{c.devices?.device_name ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-xs">{JSON.stringify(c.payload)}</td>
                <td className="px-4 py-3"><CommandStatus status={c.status} /></td>
                <td className="px-4 py-3 text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CommandStatus({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "border-warning/30 bg-warning/10 text-warning",
    delivered: "border-primary/30 bg-primary/10 text-primary",
    acknowledged: "border-primary/30 bg-primary/10 text-primary",
    failed: "border-destructive/30 bg-destructive/10 text-destructive",
  };
  return <Badge variant="outline" className={map[status] ?? ""}>{status}</Badge>;
}

function SendCommandDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [device, setDevice] = useState("");
  const [type, setType] = useState<CommandType>("open_url");
  const [target, setTarget] = useState("");

  const { data: devices } = useQuery({
    queryKey: ["devices-list"],
    queryFn: async () => (await supabase.from("devices").select("id, device_name")).data ?? [],
  });

  const send = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: Record<string, string> = target ? { target } : {};
      const { error } = await supabase.from("commands").insert({
        device_id: device, command_type: type, payload, issued_by: user?.id ?? null, status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Command queued"); qc.invalidateQueries({ queryKey: ["commands"] }); setOpen(false); setTarget(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="glow"><Send className="mr-2 h-4 w-4" />Send command</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Send command</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Target device</Label>
            <Select value={device} onValueChange={setDevice}>
              <SelectTrigger><SelectValue placeholder="Select device" /></SelectTrigger>
              <SelectContent>{devices?.map(d => <SelectItem key={d.id} value={d.id}>{d.device_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Command</Label>
            <Select value={type} onValueChange={(v) => setType(v as CommandType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{COMMAND_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {["open_url", "show_image", "play_video", "show_pdf"].includes(type) && (
            <div className="space-y-2"><Label>URL / payload</Label><Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="https://…" /></div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!device || send.isPending} onClick={() => send.mutate()}>Send</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

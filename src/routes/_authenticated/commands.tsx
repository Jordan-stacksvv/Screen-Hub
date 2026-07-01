import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Send, Terminal, Play, Square, RefreshCcw, RotateCw, Power } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { COMMAND_TYPES, CONTROL_COMMANDS, type CommandType, type LibrarySelection, selectionToCommand, labelForCommand } from "@/lib/screenhub";
import { ContentPicker } from "@/components/ContentPicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/commands")({ component: CommandsPage });

const CONTROL_ICONS: Record<string, typeof Square> = {
  stop_playback: Square,
  refresh_device: RefreshCcw,
  reload_content: RotateCw,
  reboot: Power,
};

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
          <p className="mt-1 text-sm text-muted-foreground">Send content or control actions directly to a single device.</p>
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
                  <p className="max-w-xs text-xs text-muted-foreground">Pick a device and choose content from your library — ScreenHub picks the right command for you.</p>
                </div>
              </td></tr>
            ) : data?.map((c) => (
              <tr key={c.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{labelForCommand(c.command_type)}</td>
                <td className="px-4 py-3">{(c as { devices?: { device_name?: string } }).devices?.device_name ?? "—"}</td>
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
  const [mode, setMode] = useState<"content" | "control">("content");
  const [selection, setSelection] = useState<LibrarySelection | null>(null);
  const [control, setControl] = useState<CommandType>("stop_playback");

  const { data: devices } = useQuery({
    queryKey: ["devices-list"],
    queryFn: async () => (await supabase.from("devices").select("id, device_name")).data ?? [],
  });

  const send = useMutation({
    mutationFn: async () => {
      if (!device) throw new Error("Select a device");
      const { data: { user } } = await supabase.auth.getUser();
      let command_type: CommandType;
      let payload: Record<string, string> = {};
      if (mode === "content") {
        if (!selection) throw new Error("Pick something from the library");
        ({ command_type, payload } = selectionToCommand(selection));
      } else {
        command_type = control;
      }
      const { error } = await supabase.from("commands").insert({
        device_id: device, command_type, payload, issued_by: user?.id ?? null, status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Command queued");
      qc.invalidateQueries({ queryKey: ["commands"] });
      setOpen(false); setSelection(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="glow"><Send className="mr-2 h-4 w-4" />Send command</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Send command</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Target device</Label>
            <Select value={device} onValueChange={setDevice}>
              <SelectTrigger><SelectValue placeholder="Select device" /></SelectTrigger>
              <SelectContent>{devices?.map(d => <SelectItem key={d.id} value={d.id}>{d.device_name}</SelectItem>)}</SelectContent>
            </Select>
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
                  Will send <span className="font-medium text-primary">{labelForCommand(selectionToCommand(selection).command_type)}</span> → {selection.title}
                </p>
              )}
            </TabsContent>
            <TabsContent value="control" className="mt-3 space-y-2">
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
          <Button disabled={!device || send.isPending || (mode === "content" && !selection)} onClick={() => send.mutate()}>
            <Send className="mr-2 h-4 w-4" />Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

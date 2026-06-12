import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Layers, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/groups")({ component: GroupsPage });

function GroupsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("device_groups")
        .select("*, devices(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("device_groups").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Group deleted"); qc.invalidateQueries({ queryKey: ["groups"] }); },
    onError: (e: Error) => toast.error(e.message),
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
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : data?.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><Layers className="h-5 w-5 text-primary" /></div>
          <p className="mt-4 text-sm font-medium">No groups yet</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">Group devices by location, room or campaign for batch commands.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data?.map((g: any) => (
            <div key={g.id} className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{g.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{g.description ?? "No description"}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100" onClick={() => del.mutate(g.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-border pt-3 text-xs">
                <span className="text-muted-foreground">Devices</span>
                <span className="font-mono">{g.devices?.[0]?.count ?? 0}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
    onSuccess: () => { toast.success("Group created"); qc.invalidateQueries({ queryKey: ["groups"] }); setOpen(false); setName(""); setDesc(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="glow"><Plus className="mr-2 h-4 w-4" />New group</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create group</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Reception" /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional notes…" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!name || create.isPending} onClick={() => create.mutate()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

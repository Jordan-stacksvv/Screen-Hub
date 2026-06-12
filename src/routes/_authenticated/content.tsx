import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Library, Trash2, FileText, Image as ImageIcon, Video, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { CONTENT_TYPES, type ContentType } from "@/lib/screenhub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

const ICONS = { url: LinkIcon, image: ImageIcon, video: Video, pdf: FileText };

export const Route = createFileRoute("/_authenticated/content")({ component: ContentPage });

function ContentPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["content"],
    queryFn: async () => {
      const { data, error } = await supabase.from("content").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("content").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["content"] }); },
  });

  const filtered = (data ?? []).filter(c => c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Library</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Content</h1>
        </div>
        <AddContentDialog />
      </header>

      <Input placeholder="Search content…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-video rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><Library className="h-5 w-5 text-primary" /></div>
          <p className="mt-4 text-sm font-medium">No content yet</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">Add URLs, images, videos, or PDFs to push to your screens.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {filtered.map((c) => {
            const Icon = ICONS[c.content_type as ContentType] ?? FileText;
            return (
              <div key={c.id} className="group rounded-xl border border-border bg-card overflow-hidden transition-colors hover:border-primary/40">
                <div className="relative flex aspect-video items-center justify-center bg-muted/30">
                  {c.thumbnail_url ? <img src={c.thumbnail_url} alt={c.title} className="h-full w-full object-cover" />
                    : <Icon className="h-10 w-10 text-muted-foreground/40" />}
                  <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-7 w-7 bg-background/80 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100" onClick={() => del.mutate(c.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="h-3 w-3" />
                    <span className="capitalize">{c.content_type}</span>
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddContentDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ContentType>("url");
  const [url, setUrl] = useState("");
  const create = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("content").insert({
        title, content_type: type, file_url: url, created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Added"); qc.invalidateQueries({ queryKey: ["content"] }); setOpen(false); setTitle(""); setUrl(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="glow"><Plus className="mr-2 h-4 w-4" />Add content</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add to library</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-2"><Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ContentType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CONTENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!title || !url || create.isPending} onClick={() => create.mutate()}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

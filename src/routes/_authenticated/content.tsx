import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Plus, Library, Trash2, FileText, Image as ImageIcon, Video, Link as LinkIcon, Upload, Eye } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { CONTENT_TYPES, type ContentType, ACCEPT_ATTR, MEDIA_BUCKET, formatBytes, uploadMedia } from "@/lib/screenhub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ICONS = { url: LinkIcon, image: ImageIcon, video: Video, pdf: FileText };

export const Route = createFileRoute("/_authenticated/content")({ component: ContentPage });

type ContentRow = {
  id: string; title: string; content_type: ContentType; file_url: string;
  thumbnail_url: string | null; file_size: number | null; mime_type: string | null;
  storage_path: string | null; created_at: string;
};

function ContentPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<ContentRow | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["content"],
    queryFn: async () => {
      const { data, error } = await supabase.from("content").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContentRow[];
    },
  });

  const del = useMutation({
    mutationFn: async (row: ContentRow) => {
      if (row.storage_path) {
        await supabase.storage.from(MEDIA_BUCKET).remove([row.storage_path]);
      }
      const { error } = await supabase.from("content").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["content"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (data ?? []).filter(c => c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Library</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Media</h1>
          <p className="mt-1 text-sm text-muted-foreground">Upload images, videos, PDFs, or link external URLs to display on screens.</p>
        </div>
        <AddContentDialog />
      </header>

      <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-video rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><Library className="h-5 w-5 text-primary" /></div>
          <p className="mt-4 text-sm font-medium">No content yet</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">Upload media or link a URL to push it to your screens.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {filtered.map((c) => {
            const Icon = ICONS[c.content_type] ?? FileText;
            const thumb = c.content_type === "image" ? c.file_url : c.thumbnail_url;
            return (
              <div key={c.id} className="group rounded-xl border border-border bg-card overflow-hidden transition-colors hover:border-primary/40">
                <button onClick={() => setPreview(c)} className="relative flex aspect-video w-full items-center justify-center bg-muted/30">
                  {thumb ? <img src={thumb} alt={c.title} className="h-full w-full object-cover" />
                    : c.content_type === "video" ? <video src={c.file_url} className="h-full w-full object-cover" muted />
                    : <Icon className="h-10 w-10 text-muted-foreground/40" />}
                  <span className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
                    <Eye className="h-5 w-5" />
                  </span>
                </button>
                <div className="flex items-start gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="h-3 w-3" />
                      <span className="capitalize">{c.content_type}</span>
                      <span>·</span>
                      <span>{formatBytes(c.file_size)}</span>
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => del.mutate(c)} disabled={del.isPending}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PreviewDialog item={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function PreviewDialog({ item, onClose }: { item: ContentRow | null; onClose: () => void }) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{item?.title}</DialogTitle></DialogHeader>
        {item && (
          <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
            {item.content_type === "image" ? (
              <img src={item.file_url} alt={item.title} className="h-full w-full object-contain" />
            ) : item.content_type === "video" ? (
              <video src={item.file_url} className="h-full w-full" controls autoPlay />
            ) : (
              <iframe src={item.file_url} className="h-full w-full border-0" title={item.title} />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddContentDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"upload" | "url">("upload");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ContentType>("url");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setTitle(""); setUrl(""); setFile(null); };

  const create = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (tab === "upload") {
        if (!file) throw new Error("Pick a file");
        setUploading(true);
        try {
          const m = await uploadMedia(file);
          const { error } = await supabase.from("content").insert({
            title: title || file.name, content_type: m.content_type, file_url: m.file_url,
            storage_path: m.storage_path, mime_type: m.mime_type, file_size: m.file_size,
            created_by: user?.id ?? null,
          });
          if (error) throw error;
        } finally { setUploading(false); }
      } else {
        const { error } = await supabase.from("content").insert({
          title, content_type: type, file_url: url, created_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Added"); qc.invalidateQueries({ queryKey: ["content"] }); setOpen(false); reset(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild><Button className="glow"><Plus className="mr-2 h-4 w-4" />Add content</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add to library</DialogTitle></DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "upload" | "url")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload file</TabsTrigger>
            <TabsTrigger value="url">External URL</TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="space-y-3 pt-3">
            <div className="space-y-2">
              <Label>File</Label>
              <input ref={fileRef} type="file" accept={ACCEPT_ATTR} className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); if (!title) setTitle(f.name.replace(/\.[^.]+$/, "")); } }} />
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 p-6 text-center transition-colors hover:border-primary/50">
                <Upload className="h-6 w-6 text-muted-foreground" />
                {file ? (
                  <><p className="text-sm font-medium">{file.name}</p><p className="text-xs text-muted-foreground">{formatBytes(file.size)} · {file.type || "unknown"}</p></>
                ) : (
                  <><p className="text-sm font-medium">Click to choose a file</p><p className="text-xs text-muted-foreground">PNG · JPG · WEBP · MP4 · WEBM · PDF</p></>
                )}
              </button>
            </div>
            <div className="space-y-2"><Label>Title (optional)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults to file name" /></div>
          </TabsContent>
          <TabsContent value="url" className="space-y-3 pt-3">
            <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-2"><Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as ContentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={create.isPending || uploading || (tab === "upload" ? !file : (!title || !url))}
            onClick={() => create.mutate()}
          >{uploading ? "Uploading…" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

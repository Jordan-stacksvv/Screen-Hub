import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, X, Image as ImageIcon, Video, FileText, Radio, Loader2, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadMedia, mimeToContentType, ACCEPT_ATTR, formatBytes } from "@/lib/screenhub";
import { Button } from "@/components/ui/button";
import { bridge, isDesktopApp } from "@/desktop/bridge";

export const Route = createFileRoute("/_authenticated/desktop/media")({ component: DesktopMedia });

type Pending = { id: string; file: File; progress: number; error?: string; done?: { content_id: string; url: string; type: string; title: string } };

const ICON: Record<string, typeof ImageIcon> = { image: ImageIcon, video: Video, pdf: FileText };

function DesktopMedia() {
  const qc = useQueryClient();
  const [items, setItems] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);

  const { data: recent } = useQuery({
    queryKey: ["desktop-media-recent"],
    queryFn: async () => (await supabase.from("content").select("id, title, content_type, file_url, file_size, created_at").order("created_at", { ascending: false }).limit(24)).data ?? [],
  });

  const startUploads = useCallback(async (files: File[]) => {
    const filtered = files.filter(f => !!mimeToContentType(f.type));
    if (filtered.length !== files.length) toast.warning("Some files skipped (unsupported type).");
    const pendings = filtered.map(f => ({ id: crypto.randomUUID(), file: f, progress: 0 }));
    setItems(prev => [...pendings, ...prev]);
    const { data: { user } } = await supabase.auth.getUser();
    for (const p of pendings) {
      try {
        setItems(prev => prev.map(x => x.id === p.id ? { ...x, progress: 20 } : x));
        const uploaded = await uploadMedia(p.file);
        setItems(prev => prev.map(x => x.id === p.id ? { ...x, progress: 70 } : x));
        const { data, error } = await supabase.from("content").insert({
          title: p.file.name, content_type: uploaded.content_type, file_url: uploaded.file_url,
          storage_path: uploaded.storage_path, mime_type: uploaded.mime_type, file_size: uploaded.file_size,
          created_by: user?.id ?? null,
        }).select("id").maybeSingle();
        if (error) throw error;
        setItems(prev => prev.map(x => x.id === p.id ? { ...x, progress: 100, done: { content_id: data!.id, url: uploaded.file_url, type: uploaded.content_type, title: p.file.name } } : x));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        setItems(prev => prev.map(x => x.id === p.id ? { ...x, error: msg } : x));
      }
    }
    bridge().notify({ title: "Upload complete", body: `${pendings.length} file(s)` });
    qc.invalidateQueries({ queryKey: ["desktop-media-recent"] });
  }, [qc]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) startUploads(files);
  };

  const pickNative = async () => {
    if (!isDesktopApp) return;
    const picked = await bridge().pickFiles();
    if (!picked.length) return;
    // In Electron we have real paths but the renderer can't read arbitrary files.
    // The drag-drop path (above) gets browser File objects with content, so we
    // fall back to a hidden <input type=file> for actual bytes.
    toast.info(`Selected ${picked.length} file(s) — drag them onto the window to upload.`);
  };

  const broadcastAll = async () => {
    const ready = items.filter(i => i.done).map(i => i.done!);
    if (!ready.length) return;
    // Simple: one broadcast per file to "all" targets, using the existing schema.
    const { data: { user } } = await supabase.auth.getUser();
    for (const r of ready) {
      const { data: devices } = await supabase.from("devices").select("id");
      const ids = (devices ?? []).map(d => d.id);
      if (!ids.length) continue;
      const cmdType = r.type === "video" ? "play_video" : r.type === "image" ? "show_image" : r.type === "pdf" ? "show_pdf" : "open_url";
      const { data: bc } = await supabase.from("broadcasts").insert({
        name: r.title, target_type: "all", command_type: cmdType, payload: { target: r.url, content_id: r.content_id },
        total_targets: ids.length, issued_by: user?.id ?? null, status: "active",
      }).select("id").maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from("commands").insert(ids.map(id => ({ device_id: id, command_type: cmdType, payload: { target: r.url, content_id: r.content_id }, issued_by: user?.id ?? null, status: "pending", broadcast_id: bc?.id })) as any);
    }
    toast.success("Broadcast sent");
    bridge().notify({ title: "Broadcast sent", body: `${ready.length} media item(s) to all devices` });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Media Workflow</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Upload & broadcast</h1>
          <p className="mt-1 text-xs text-muted-foreground">Drop files anywhere on this page. Supports images, videos, and PDFs.</p>
        </div>
        {isDesktopApp && (
          <Button variant="outline" size="sm" onClick={pickNative}><FolderOpen className="mr-1 h-3 w-3" />Browse…</Button>
        )}
      </header>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}
      >
        <input type="file" accept={ACCEPT_ATTR} multiple className="hidden" onChange={(e) => { const files = Array.from(e.target.files ?? []); if (files.length) startUploads(files); e.currentTarget.value = ""; }} />
        <Upload className="h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Drop files here or click to browse</p>
        <p className="text-[11px] text-muted-foreground">PNG, JPG, WEBP, MP4, WEBM, PDF</p>
      </label>

      {items.length > 0 && (
        <section className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="text-xs font-medium">Uploads ({items.length})</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setItems([])}><X className="mr-1 h-3 w-3" />Clear</Button>
              <Button size="sm" className="h-7 text-xs" disabled={!items.some(i => i.done)} onClick={broadcastAll}><Radio className="mr-1 h-3 w-3" />Broadcast all → all devices</Button>
            </div>
          </div>
          <ul className="divide-y divide-border">
            {items.map((it) => {
              const type = mimeToContentType(it.file.type);
              const Icon = ICON[type ?? "image"] ?? FileText;
              return (
                <li key={it.id} className="flex items-center gap-3 px-4 py-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs">{it.file.name}</p>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full ${it.error ? "bg-destructive" : "bg-primary"}`} style={{ width: `${it.progress}%` }} />
                    </div>
                    {it.error && <p className="mt-1 text-[10px] text-destructive">{it.error}</p>}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{formatBytes(it.file.size)}</span>
                  {it.progress < 100 && !it.error ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-xs font-medium">Recent media</h2>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {(recent ?? []).map((r) => {
            const Icon = ICON[r.content_type] ?? FileText;
            return (
              <Link key={r.id} to="/content" className="rounded-lg border border-border bg-card p-3 hover:border-primary/40">
                <div className="flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-muted-foreground" /><span className="truncate text-xs">{r.title}</span></div>
                <p className="mt-1 text-[10px] text-muted-foreground">{formatBytes(r.file_size)}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

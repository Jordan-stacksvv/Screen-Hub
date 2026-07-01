// Unified library picker: shows every content type (URL, Image, Video, PDF)
// and playlists, and returns a LibrarySelection whose command is automatically
// derived by `selectionToCommand()`. Consumers never pick a command manually.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Image as ImageIcon, Video, Link as LinkIcon, ListVideo, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ContentType, LibrarySelection } from "@/lib/screenhub";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ICONS = { url: LinkIcon, image: ImageIcon, video: Video, pdf: FileText };

export function ContentPicker({
  value, onChange, allowPlaylists = true,
}: {
  value: LibrarySelection | null;
  onChange: (s: LibrarySelection | null) => void;
  allowPlaylists?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ContentType | "all" | "playlist">("all");

  const { data } = useQuery({
    queryKey: ["library-picker", allowPlaylists],
    queryFn: async () => {
      const [c, p] = await Promise.all([
        supabase.from("content").select("id, title, content_type, file_url").order("created_at", { ascending: false }),
        allowPlaylists
          ? supabase.from("playlists").select("id, name, playlist_items(id)").order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as { id: string; name: string; playlist_items: { id: string }[] }[] }),
      ]);
      return {
        content: (c.data ?? []) as { id: string; title: string; content_type: ContentType; file_url: string }[],
        playlists: (p.data ?? []) as { id: string; name: string; playlist_items: { id: string }[] }[],
      };
    },
  });

  const items = useMemo<LibrarySelection[]>(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    const contentItems: LibrarySelection[] = data.content
      .filter(c => tab === "all" || tab === c.content_type)
      .filter(c => !q || c.title.toLowerCase().includes(q))
      .map(c => ({ kind: "content", id: c.id, title: c.title, content_type: c.content_type, file_url: c.file_url }));
    const playlistItems: LibrarySelection[] = data.playlists
      .filter(() => tab === "all" || tab === "playlist")
      .filter(p => !q || p.name.toLowerCase().includes(q))
      .map(p => ({ kind: "playlist", id: p.id, title: p.name, items: p.playlist_items?.length ?? 0 }));
    return tab === "playlist" ? playlistItems : tab === "all" ? [...playlistItems, ...contentItems] : contentItems;
  }, [data, search, tab]);

  return (
    <div className="space-y-2">
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className={`grid w-full ${allowPlaylists ? "grid-cols-6" : "grid-cols-5"}`}>
          <TabsTrigger value="all">All</TabsTrigger>
          {allowPlaylists && <TabsTrigger value="playlist">Playlists</TabsTrigger>}
          <TabsTrigger value="image">Images</TabsTrigger>
          <TabsTrigger value="video">Videos</TabsTrigger>
          <TabsTrigger value="pdf">PDFs</TabsTrigger>
          <TabsTrigger value="url">URLs</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search library…" className="pl-8" />
          </div>

          <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-border">
            {items.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground">
                No matching items. <a href="/content" className="text-primary hover:underline">Upload media</a> or <a href="/playlists" className="text-primary hover:underline">create a playlist</a>.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((it) => {
                  const active = value?.kind === it.kind && value.id === it.id;
                  const Icon = it.kind === "playlist" ? ListVideo : (ICONS[it.content_type] ?? FileText);
                  return (
                    <li key={`${it.kind}:${it.id}`}>
                      <button
                        type="button"
                        onClick={() => onChange(active ? null : it)}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${active ? "bg-primary/10" : "hover:bg-muted/40"}`}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{it.title}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {it.kind === "playlist" ? `${it.items} items` : it.content_type}
                        </Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

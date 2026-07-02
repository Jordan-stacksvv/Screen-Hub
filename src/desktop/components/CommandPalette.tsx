import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Radio, MonitorSmartphone, ListVideo, Image as ImageIcon, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { useRecent } from "@/desktop/hooks/use-recent";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { items: recentDevices, push: pushDevice } = useRecent("devices");

  const { data } = useQuery({
    queryKey: ["palette-index"],
    queryFn: async () => {
      const [devices, playlists, content] = await Promise.all([
        supabase.from("devices").select("id, device_name, status").order("device_name").limit(50),
        supabase.from("playlists").select("id, name").order("created_at", { ascending: false }).limit(30),
        supabase.from("content").select("id, title, content_type").order("created_at", { ascending: false }).limit(30),
      ]);
      return {
        devices: devices.data ?? [], playlists: playlists.data ?? [], content: content.data ?? [],
      };
    },
    enabled: open,
  });

  useEffect(() => { if (!open) setQ(""); }, [open]);

  const recentDeviceRows = useMemo(
    () => (data?.devices ?? []).filter((d) => recentDevices.includes(d.id)),
    [data, recentDevices]
  );

  const go = (path: string) => { onOpenChange(false); navigate({ to: path }); };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to device, playlist, or action…" value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/desktop/broadcasts")}><Radio className="mr-2 h-3.5 w-3.5" />New broadcast</CommandItem>
          <CommandItem onSelect={() => go("/desktop/media")}><Upload className="mr-2 h-3.5 w-3.5" />Upload media</CommandItem>
          <CommandItem onSelect={() => go("/desktop/live-control")}><MonitorSmartphone className="mr-2 h-3.5 w-3.5" />Open Live Control</CommandItem>
        </CommandGroup>

        {recentDeviceRows.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent devices">
              {recentDeviceRows.map((d) => (
                <CommandItem key={d.id} onSelect={() => { pushDevice(d.id); go(`/devices/${d.id}`); }}>
                  <MonitorSmartphone className="mr-2 h-3.5 w-3.5" />{d.device_name}
                  <span className="ml-auto text-[10px] text-muted-foreground">{d.status}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Devices">
          {(data?.devices ?? []).map((d) => (
            <CommandItem key={d.id} onSelect={() => { pushDevice(d.id); go(`/devices/${d.id}`); }}>
              <MonitorSmartphone className="mr-2 h-3.5 w-3.5" />{d.device_name}
              <span className="ml-auto text-[10px] text-muted-foreground">{d.status}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Playlists">
          {(data?.playlists ?? []).map((p) => (
            <CommandItem key={p.id} onSelect={() => go(`/playlists`)}><ListVideo className="mr-2 h-3.5 w-3.5" />{p.name}</CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Media">
          {(data?.content ?? []).map((c) => (
            <CommandItem key={c.id} onSelect={() => go(`/content`)}>
              <ImageIcon className="mr-2 h-3.5 w-3.5" />{c.title}
              <span className="ml-auto text-[10px] text-muted-foreground">{c.content_type}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

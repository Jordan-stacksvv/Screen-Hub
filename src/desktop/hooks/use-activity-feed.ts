import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ActivityEvent = {
  id: string;
  ts: string;
  kind: "command" | "broadcast" | "device";
  title: string;
  subtitle?: string;
  level: "info" | "success" | "warn" | "error";
};

// Subscribes to the three tables we care about and returns a bounded event feed.
export function useActivityFeed(limit = 50) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    const push = (ev: ActivityEvent) =>
      setEvents((prev) => [ev, ...prev].slice(0, limit));

    const ch = supabase
      .channel("desktop-activity")
      .on("postgres_changes", { event: "*", schema: "public", table: "commands" }, (p) => {
        const row = (p.new ?? p.old) as { id: string; command_type?: string; status?: string; created_at?: string };
        if (!row?.id) return;
        const status = row.status ?? "pending";
        push({
          id: `cmd-${row.id}-${status}`,
          ts: row.created_at ?? new Date().toISOString(),
          kind: "command",
          title: `Command ${row.command_type ?? "?"}`,
          subtitle: status,
          level: status === "failed" ? "error" : status === "acknowledged" ? "success" : "info",
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "broadcasts" }, (p) => {
        const row = (p.new ?? p.old) as { id: string; name?: string; command_type?: string; created_at?: string; status?: string };
        if (!row?.id) return;
        push({
          id: `bc-${row.id}-${row.status ?? "new"}`,
          ts: row.created_at ?? new Date().toISOString(),
          kind: "broadcast",
          title: `Broadcast ${row.name ?? row.command_type ?? ""}`,
          subtitle: row.status ?? "sent",
          level: row.status === "cancelled" ? "warn" : "info",
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "devices" }, (p) => {
        const row = p.new as { id: string; device_name?: string; status?: string };
        if (!row?.id) return;
        push({
          id: `dev-${row.id}-${row.status}-${Date.now()}`,
          ts: new Date().toISOString(),
          kind: "device",
          title: row.device_name ?? "Device",
          subtitle: row.status ?? "",
          level: row.status === "online" ? "success" : row.status === "offline" ? "warn" : "info",
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [limit]);

  return events;
}

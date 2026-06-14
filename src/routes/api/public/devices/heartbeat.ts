// Heartbeat + command polling for client apps.
// Auth: bearer registration_token from /api/public/devices/register or /pair.
import { createFileRoute } from "@tanstack/react-router";

const OFFLINE_AFTER_MS = 90_000;

async function authDevice(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || token.length < 16) return { error: "Unauthorized" as const };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("devices")
    .select("id, current_playlist_id")
    .eq("registration_token", token)
    .maybeSingle();
  if (error || !data) return { error: "Unauthorized" as const };
  return { deviceId: data.id, currentPlaylistId: data.current_playlist_id, supabaseAdmin };
}

export const Route = createFileRoute("/api/public/devices/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authDevice(request);
        if ("error" in auth) return Response.json({ error: auth.error }, { status: 401 });

        const now = new Date();
        await auth.supabaseAdmin
          .from("devices")
          .update({ status: "online", last_seen: now.toISOString() })
          .eq("id", auth.deviceId);

        const cutoff = new Date(now.getTime() - OFFLINE_AFTER_MS).toISOString();
        await auth.supabaseAdmin
          .from("devices")
          .update({ status: "offline" })
          .neq("id", auth.deviceId)
          .eq("status", "online")
          .lt("last_seen", cutoff);

        const { data: pending } = await auth.supabaseAdmin
          .from("commands")
          .select("id, command_type, payload, created_at")
          .eq("device_id", auth.deviceId)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(20);

        if (pending && pending.length > 0) {
          await auth.supabaseAdmin
            .from("commands")
            .update({ status: "delivered", delivered_at: now.toISOString() })
            .in("id", pending.map((c) => c.id));
        }

        // Include current playlist + items if assigned
        let playlist: unknown = null;
        if (auth.currentPlaylistId) {
          const { data: pl } = await auth.supabaseAdmin
            .from("playlists")
            .select("id, name, loop_enabled, playlist_items(id, position, duration_seconds, content(id, title, content_type, file_url))")
            .eq("id", auth.currentPlaylistId)
            .maybeSingle();
          playlist = pl;
        }

        // Active schedule (highest priority, currently valid)
        const nowIso = now.toISOString();
        const { data: schedules } = await auth.supabaseAdmin
          .from("schedules")
          .select("id, name, target_type, target_id, playlist_id, content_id, priority, starts_at, ends_at")
          .eq("enabled", true)
          .lte("starts_at", nowIso)
          .order("priority", { ascending: false })
          .limit(20);

        const activeSchedule = (schedules ?? []).find((s) => {
          if (s.ends_at && new Date(s.ends_at) < now) return false;
          if (s.target_type === "all") return true;
          if (s.target_type === "device") return s.target_id === auth.deviceId;
          return false; // group targeting resolved by admin assignment
        }) ?? null;

        return Response.json({ ok: true, commands: pending ?? [], playlist, schedule: activeSchedule });
      },
    },
  },
});

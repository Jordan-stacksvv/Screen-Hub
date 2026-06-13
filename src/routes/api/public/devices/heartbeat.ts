// Heartbeat + command polling for client apps.
// Auth: bearer registration_token from /api/public/devices/register.
import { createFileRoute } from "@tanstack/react-router";

const OFFLINE_AFTER_MS = 90_000;

async function authDevice(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || token.length < 16) return { error: "Unauthorized" as const };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("devices").select("id").eq("registration_token", token).maybeSingle();
  if (error || !data) return { error: "Unauthorized" as const };
  return { deviceId: data.id, supabaseAdmin };
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

        // Sweep stale devices to offline. Cheap: only affects rows past threshold.
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
            .in("id", pending.map(c => c.id));
        }

        return Response.json({ ok: true, commands: pending ?? [] });
      },
    },
  },
});

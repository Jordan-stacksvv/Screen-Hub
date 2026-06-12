// Acknowledge a command after the device executes it.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Schema = z.object({
  command_id: z.string().uuid(),
  success: z.boolean(),
  result: z.record(z.string(), z.any()).optional(),
});

export const Route = createFileRoute("/api/public/devices/ack")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: device } = await supabaseAdmin.from("devices").select("id").eq("registration_token", token).maybeSingle();
        if (!device) return Response.json({ error: "Unauthorized" }, { status: 401 });

        let body: unknown;
        try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) return Response.json({ error: "Invalid payload" }, { status: 400 });

        const { error } = await supabaseAdmin
          .from("commands")
          .update({
            status: parsed.data.success ? "acknowledged" : "failed",
            acknowledged_at: new Date().toISOString(),
            result: parsed.data.result ?? null,
          })
          .eq("id", parsed.data.command_id)
          .eq("device_id", device.id);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        return Response.json({ ok: true });
      },
    },
  },
});

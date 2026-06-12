// Public device API — called by Android / Windows client apps.
// SECURITY: registration takes an admin-provided unique_identifier (created in UI).
// Subsequent heartbeats and command polling use the device's registration_token.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const RegisterSchema = z.object({
  unique_identifier: z.string().min(4).max(128),
  operating_system: z.string().max(120).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const Route = createFileRoute("/api/public/devices/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
        const parsed = RegisterSchema.safeParse(body);
        if (!parsed.success) return Response.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: device, error } = await supabaseAdmin
          .from("devices")
          .select("id, device_name, registration_token, status")
          .eq("unique_identifier", parsed.data.unique_identifier)
          .maybeSingle();
        if (error) return Response.json({ error: error.message }, { status: 500 });
        if (!device) return Response.json({ error: "Device not enrolled. Ask an admin to register this identifier." }, { status: 404 });

        const token = device.registration_token ?? crypto.randomUUID().replace(/-/g, "");
        const { error: upErr } = await supabaseAdmin
          .from("devices")
          .update({
            registration_token: token,
            status: "online",
            last_seen: new Date().toISOString(),
            operating_system: parsed.data.operating_system ?? null,
            metadata: parsed.data.metadata ?? {},
          })
          .eq("id", device.id);
        if (upErr) return Response.json({ error: upErr.message }, { status: 500 });

        return Response.json({ device_id: device.id, device_name: device.device_name, registration_token: token });
      },
    },
  },
});

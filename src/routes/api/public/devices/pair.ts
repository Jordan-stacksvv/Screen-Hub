// Pairing flow:
//   POST { code } from an unregistered client device → creates/links a pairing_codes row.
//   Client polls the same endpoint with { code } until claimed_at is set; once an admin
//   claims the code from the dashboard, we mint a registration_token and return device info.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Schema = z.object({
  code: z.string().min(4).max(12).regex(/^[A-Z0-9-]+$/),
  device_name: z.string().min(1).max(120).optional(),
  device_type: z.string().max(40).optional(),
  operating_system: z.string().max(120).optional(),
});

export const Route = createFileRoute("/api/public/devices/pair")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) return Response.json({ error: "Invalid payload" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Upsert the pairing code (idempotent for polling clients).
        const { data: existing } = await supabaseAdmin
          .from("pairing_codes")
          .select("id, device_id, claimed_at, expires_at")
          .eq("code", parsed.data.code)
          .maybeSingle();

        let pc = existing;
        if (!pc) {
          const { data: inserted, error } = await supabaseAdmin
            .from("pairing_codes")
            .insert({
              code: parsed.data.code,
              metadata: {
                device_name: parsed.data.device_name ?? null,
                device_type: parsed.data.device_type ?? "other",
                operating_system: parsed.data.operating_system ?? null,
              },
            })
            .select("id, device_id, claimed_at, expires_at")
            .single();
          if (error) return Response.json({ error: error.message }, { status: 500 });
          pc = inserted;
        }

        if (new Date(pc.expires_at).getTime() < Date.now()) {
          return Response.json({ status: "expired" }, { status: 410 });
        }

        if (!pc.claimed_at || !pc.device_id) {
          return Response.json({ status: "pending" });
        }

        const { data: device } = await supabaseAdmin
          .from("devices")
          .select("id, device_name, registration_token")
          .eq("id", pc.device_id)
          .maybeSingle();
        if (!device) return Response.json({ status: "pending" });

        const token = device.registration_token ?? crypto.randomUUID().replace(/-/g, "");
        await supabaseAdmin
          .from("devices")
          .update({
            registration_token: token,
            status: "online",
            paired_at: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            operating_system: parsed.data.operating_system ?? null,
          })
          .eq("id", device.id);

        return Response.json({
          status: "claimed",
          device_id: device.id,
          device_name: device.device_name,
          registration_token: token,
        });
      },
    },
  },
});

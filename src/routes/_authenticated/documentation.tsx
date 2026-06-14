import { createFileRoute, Link } from "@tanstack/react-router";
import { Book, Code, Cpu, Radio, Server, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/documentation")({ component: Docs });

function Docs() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 md:p-8">
      <header>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Reference</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Documentation</h1>
        <p className="mt-2 text-sm text-muted-foreground">Architecture, APIs and client integration for ScreenHub.</p>
      </header>

      <Section icon={Cpu} title="Architecture">
        <p>
          ScreenHub is a TanStack Start application backed by Lovable Cloud (Postgres + realtime + auth + storage).
          The admin SPA, device-facing client, and public device API all live in one codebase and are deployed as
          a single edge worker.
        </p>
        <Diagram />
      </Section>

      <Section icon={Server} title="Public device API">
        <p className="mb-3">Three public endpoints implement the wire protocol. All accept JSON.</p>
        <Endpoint method="POST" path="/api/public/devices/register" desc="Exchange an admin-provisioned unique_identifier for a registration_token." />
        <Endpoint method="POST" path="/api/public/devices/pair" desc="Self-service pairing for new clients. Client posts a 6-char code; admin claims from UI; client receives identity and token." />
        <Endpoint method="POST" path="/api/public/devices/heartbeat" auth desc="Bearer registration_token. Updates last_seen, returns pending commands + active playlist + schedule." />
        <Endpoint method="POST" path="/api/public/devices/ack" auth desc="Bearer registration_token. Reports success/failure for a command id." />
      </Section>

      <Section icon={Radio} title="Realtime channels">
        <p>
          The browser client subscribes to <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">commands</code>{" "}
          via Supabase realtime postgres_changes for instant delivery, with heartbeats as a polling fallback
          (default 30s). Heartbeats also sweep devices not seen in 90s into <code>offline</code>.
        </p>
      </Section>

      <Section icon={Shield} title="Auth & RLS">
        <p>
          Admin/operator access is gated by Supabase auth + the <code>is_workspace_member()</code> helper. The first
          registered user receives the <code>admin</code> role; subsequent users default to <code>operator</code>.
          All public tables enforce RLS; the public device API uses the service-role client server-side after
          validating the bearer token.
        </p>
      </Section>

      <Section icon={Book} title="Client integration">
        <p>
          The browser client lives at <Link to="/client" className="text-primary underline-offset-4 hover:underline">/client</Link>{" "}
          and is the reference implementation. Native Android and Electron clients (planned) speak the same wire
          protocol — see the <Link to="/future" className="text-primary underline-offset-4 hover:underline">Future Architecture</Link>{" "}
          page for the planned shape.
        </p>
      </Section>

      <Section icon={Code} title="Wire protocol example">
        <pre className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 text-xs"><code>{`POST /api/public/devices/heartbeat
Authorization: Bearer <registration_token>
Content-Type: application/json

→ {
  "ok": true,
  "commands": [
    { "id": "...", "command_type": "open_url", "payload": { "target": "https://..." } }
  ],
  "playlist": null,
  "schedule": null
}`}</code></pre>
      </Section>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10"><Icon className="h-4 w-4 text-primary" /></div>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

function Endpoint({ method, path, desc, auth }: { method: string; path: string; desc: string; auth?: boolean }) {
  return (
    <div className="mb-2 rounded-md border border-border bg-muted/20 p-3 text-xs">
      <div className="flex items-center gap-2"><span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono font-semibold text-primary">{method}</span><code className="font-mono">{path}</code>{auth && <span className="rounded bg-warning/15 px-1.5 py-0.5 font-mono text-warning">auth</span>}</div>
      <p className="mt-1 text-muted-foreground">{desc}</p>
    </div>
  );
}

function Diagram() {
  return (
    <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 text-xs"><code>{`┌──────────┐    realtime + REST    ┌──────────────┐
│  Admin   │ ───────────────────► │  Postgres +  │
│   SPA    │ ◄─────────────────── │   Realtime   │
└──────────┘                       └──────┬───────┘
      ▲                                   │
      │                                   │ pg_changes
      │ commands                          ▼
      │                            ┌──────────────┐
      ▼                            │  /api/public │
┌──────────┐    heartbeat (30s)    │   devices/*  │
│  Client  │ ◄───────────────────► │              │
│ (browser │                       └──────────────┘
│ /android │
│ /windows)│
└──────────┘`}</code></pre>
  );
}

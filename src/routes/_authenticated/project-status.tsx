import { createFileRoute } from "@tanstack/react-router";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/project-status")({ component: ProjectStatus });

const MODULES = [
  { name: "Authentication", pct: 100 },
  { name: "User roles", pct: 100 },
  { name: "Devices", pct: 95 },
  { name: "Device groups", pct: 90 },
  { name: "Content library", pct: 70 },
  { name: "Commands", pct: 100 },
  { name: "Heartbeat & status", pct: 100 },
  { name: "Realtime delivery", pct: 100 },
  { name: "Device simulator", pct: 100 },
  { name: "Production client (/client)", pct: 85 },
  { name: "Pairing flow", pct: 90 },
  { name: "Playlists", pct: 85 },
  { name: "Schedules", pct: 75 },
  { name: "Broadcasts", pct: 90 },
  { name: "PWA installability", pct: 60 },
  { name: "Android APK client", pct: 10 },
  { name: "Electron client", pct: 10 },
  { name: "Multi-location", pct: 10 },
  { name: "Analytics", pct: 15 },
  { name: "Remote controls", pct: 20 },
  { name: "Audit log", pct: 0 },
  { name: "Content uploads (storage)", pct: 0 },
];

const LIMITATIONS = [
  "Content URLs are stored as plain strings — no file upload bucket yet.",
  "Schedules don't honor group targeting on the client (admin must assign group → device manually).",
  "PWA is manifest-only; no offline content cache.",
  "Realtime is single-tenant; multi-org isolation is schema-only.",
  "Remote screenshot/reboot/volume are protocol stubs; no client implementations.",
];

const TESTS = [
  "Sign up & first user becomes admin",
  "Register device via admin UI",
  "Open /simulator with that identifier → heartbeat shows online in /devices",
  "Send command from /devices → appears in /simulator instantly",
  "Open /client on a new tab → 6-char code shown → claim in /devices",
  "Create playlist → assign to device → /client rotates content",
  "Create broadcast (all) → counts pending → delivered → acked",
];

function ProjectStatus() {
  const overall = Math.round(MODULES.reduce((s, m) => s + m.pct, 0) / MODULES.length);
  const done = MODULES.filter((m) => m.pct === 100).length;
  const inProgress = MODULES.filter((m) => m.pct > 10 && m.pct < 100).length;
  const planned = MODULES.filter((m) => m.pct <= 10).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
      <header>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Build progress</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Project status</h1>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Overall" value={`${overall}%`} />
        <Stat label="Completed" value={String(done)} />
        <Stat label="In progress" value={String(inProgress)} />
        <Stat label="Planned" value={String(planned)} />
      </div>

      <Section title="Modules">
        <div className="space-y-3">
          {MODULES.map((m) => (
            <div key={m.name}>
              <div className="mb-1 flex items-center justify-between text-sm"><span>{m.name}</span><span className="font-mono text-xs text-muted-foreground">{m.pct}%</span></div>
              <Progress value={m.pct} />
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Known limitations">
          <ul className="ml-5 list-disc space-y-1 text-sm text-muted-foreground">{LIMITATIONS.map((l) => <li key={l}>{l}</li>)}</ul>
        </Section>
        <Section title="Testing checklist">
          <ul className="ml-5 list-disc space-y-1 text-sm text-muted-foreground">{TESTS.map((t) => <li key={t}>{t}</li>)}</ul>
        </Section>
      </div>

      <Section title="Technical debt">
        <ul className="ml-5 list-disc space-y-1 text-sm text-muted-foreground">
          <li>Storage bucket for content files (currently URL-only)</li>
          <li>Server-side broadcast fan-out (currently client-side; large fan-outs may hit insert limits)</li>
          <li>Cron-driven analytics rollup into device_analytics_daily / command_metrics</li>
          <li>Audit logging for admin actions</li>
        </ul>
      </Section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-card p-4"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-border bg-card p-5"><h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>{children}</section>;
}

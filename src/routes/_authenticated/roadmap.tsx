import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Circle, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/roadmap")({ component: Roadmap });

const PHASES = [
  {
    label: "Phase 1 — Foundation", status: "done", items: [
      "Auth + roles (admin/operator)", "Devices, Groups, Content schema",
      "Dashboard, Devices, Content, Groups, Commands pages", "Public device registration API",
    ],
  },
  {
    label: "Phase 2 — Connectivity", status: "done", items: [
      "Heartbeats with 90s offline sweep", "Realtime command delivery",
      "Command acknowledgements", "Device simulator", "URL/Image/Video/PDF rendering",
    ],
  },
  {
    label: "Phase 3 — Production client + orchestration", status: "doing", items: [
      "Browser client at /client with persistent identity",
      "Self-service pairing (6-char codes)", "Playlists with rotation + assignment",
      "Schedules with priority", "Broadcasts (device/group/all)",
      "PWA manifest (installable)",
    ],
  },
  {
    label: "Phase 4 — Future architecture (scaffolded)", status: "planned", items: [
      "Android APK client (interfaces + DB ready)",
      "Electron desktop client", "Multi-location: organizations/workspaces/branches",
      "Analytics aggregation (schemas in place)",
      "Remote device controls (screenshot, reboot, brightness, volume)",
    ],
  },
  {
    label: "Phase 5 — Hardening (planned)", status: "planned", items: [
      "Service worker for offline display",
      "Content storage bucket + uploads UI",
      "Audit log + admin event stream",
      "Role-based delegation (workspaces × roles matrix)",
    ],
  },
];

function Roadmap() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-8">
      <header>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Plan</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Roadmap</h1>
      </header>
      <div className="space-y-4">
        {PHASES.map((p) => (
          <div key={p.label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              {p.status === "done" ? <CheckCircle2 className="h-5 w-5 text-primary" /> : p.status === "doing" ? <Clock className="h-5 w-5 text-warning" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
              <h3 className="font-medium">{p.label}</h3>
              <span className="ml-auto text-xs uppercase tracking-wider text-muted-foreground">{p.status}</span>
            </div>
            <ul className="mt-3 ml-7 list-disc space-y-1 text-sm text-muted-foreground">
              {p.items.map((it) => <li key={it}>{it}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

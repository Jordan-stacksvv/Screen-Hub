import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Smartphone, MonitorCog, Building2, BarChart3, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/future")({ component: Future });

const TABS = [
  { id: "android", label: "Android APK", icon: Smartphone },
  { id: "electron", label: "Electron desktop", icon: MonitorCog },
  { id: "multi", label: "Multi-location", icon: Building2 },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "controls", label: "Remote controls", icon: Settings2 },
] as const;

function Future() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("android");
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
      <header>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Phase 4+</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Future architecture</h1>
        <p className="mt-2 text-sm text-muted-foreground">Designed and scaffolded. Schemas live in the database; implementations are planned.</p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-border">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn(
            "flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors",
            tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          )}><t.icon className="h-4 w-4" />{t.label}</button>
        ))}
      </div>

      {tab === "android" && <Android />}
      {tab === "electron" && <Electron />}
      {tab === "multi" && <Multi />}
      {tab === "analytics" && <Analytics />}
      {tab === "controls" && <Controls />}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-border bg-card p-5"><h2 className="mb-3 text-sm font-semibold">{title}</h2><div className="space-y-2 text-sm text-muted-foreground">{children}</div></section>;
}
function Pre({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-3 text-xs"><code>{children}</code></pre>;
}

function Android() {
  return (
    <div className="space-y-4">
      <Card title="Architecture">
        <p>Native Kotlin app, single-activity, foreground service for heartbeats, WebView for URL/PDF rendering, ExoPlayer for video.</p>
        <Pre>{`com.screenhub.android
├── HeartbeatService (Foreground, 30s)
├── CommandReceiver  (FCM push for low-latency delivery)
├── DisplayActivity  (Fullscreen, locked task mode)
├── PairingActivity  (Shows pairing code until claimed)
└── ScreenHubClient  (Retrofit, wraps /api/public/devices/*)`}</Pre>
      </Card>
      <Card title="Registration flow"><Pre>{`first launch → generate code → POST /pair { code } every 5s
admin claims in UI → POST /pair returns { device_id, registration_token }
persist token in EncryptedSharedPreferences
HeartbeatService starts → POST /heartbeat with Bearer token`}</Pre></Card>
      <Card title="Packaging plan">
        <p>Min SDK 24 (Android 7+), target SDK 34. Signed APK distributed via direct download or MDM (Knox/Android Enterprise). Auto-update via in-app version check against <code>/api/public/client/version</code>.</p>
      </Card>
    </div>
  );
}
function Electron() {
  return (
    <div className="space-y-4">
      <Card title="Architecture"><Pre>{`electron/
├── main.cjs          BrowserWindow, fullscreen, auto-update
├── preload.cjs       Token storage via electron-store
└── renderer/         loads /client route from dist/
`}</Pre><p>Reuses the browser <code>/client</code> route by loading the built SPA inside Electron's BrowserWindow. The renderer talks to the same public API.</p></Card>
      <Card title="Packaging plan">
        <p>Use <code>@electron/packager</code> to build for Windows (.zip) and macOS (.zip). Linux as .tar.gz. Auto-update via electron-updater pointing at a GitHub release feed.</p>
      </Card>
      <Card title="Auto-update strategy"><Pre>{`on startup → check /api/public/client/version
if newer → download asar bundle → swap on next launch
fallback: full installer download`}</Pre></Card>
    </div>
  );
}
function Multi() {
  return (
    <div className="space-y-4">
      <Card title="Tables (in place, locked)"><Pre>{`organizations (id, name)
workspaces    (id, organization_id, name)
branches      (id, workspace_id, name, location)
-- to be added in Phase 5:
device.workspace_id  -> partition all queries
user_workspaces      -> role × workspace matrix`}</Pre></Card>
      <Card title="Migration path">
        <ol className="ml-5 list-decimal space-y-1">
          <li>Backfill: create default org + workspace, attach all existing devices.</li>
          <li>Replace <code>is_workspace_member(uid)</code> with <code>is_workspace_member(uid, workspace_id)</code>.</li>
          <li>Add workspace switcher to app shell.</li>
          <li>Scope all RLS policies and queries by <code>workspace_id</code>.</li>
        </ol>
      </Card>
    </div>
  );
}
function Analytics() {
  return (
    <div className="space-y-4">
      <Card title="Tables (in place, locked)"><Pre>{`device_analytics_daily
  (device_id, day, uptime_seconds, heartbeats, content_displayed)

command_metrics
  (day, command_type, issued, delivered, acknowledged, failed)`}</Pre></Card>
      <Card title="Aggregation plan">
        <p>Nightly <code>pg_cron</code> job calls <code>/api/public/hooks/rollup-analytics</code> which scans the previous day's heartbeats + commands and upserts the daily tables. UI: dashboard widgets + per-device uptime chart.</p>
      </Card>
    </div>
  );
}
function Controls() {
  return (
    <div className="space-y-4">
      <Card title="Command vocabulary (extension)"><Pre>{`screenshot     → device captures viewport, uploads to storage, returns url
reboot         → graceful exit; Electron main relaunches; Android restarts activity
restart_client → soft reload of /client without OS reboot
volume         → payload: { level: 0..100 }
brightness     → payload: { level: 0..100 }
diagnostics    → returns { cpu, memory, network, last_error_log }`}</Pre></Card>
      <Card title="Wire flow"><Pre>{`admin → INSERT command { command_type:'screenshot' }
realtime push → client captures + uploads → POST /ack { result:{ url } }
admin UI shows thumbnail in command history`}</Pre></Card>
      <Card title="Why not yet">
        <p>Browser client cannot fulfill screenshot/reboot/brightness — needs native (Android Service or Electron main). Once Android/Electron ship, the same command schema lights up automatically.</p>
      </Card>
    </div>
  );
}

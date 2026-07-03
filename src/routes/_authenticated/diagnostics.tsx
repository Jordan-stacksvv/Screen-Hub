// System diagnostics — verifies backend subsystems are reachable.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, RefreshCcw, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/diagnostics")({ component: DiagnosticsPage });

type Status = "checking" | "ok" | "fail";
type Check = { key: string; label: string; status: Status; detail?: string };

const initial: Check[] = [
  { key: "auth", label: "Authentication", status: "checking" },
  { key: "db", label: "Database connectivity", status: "checking" },
  { key: "realtime", label: "Realtime connection", status: "checking" },
  { key: "storage", label: "Storage bucket (media)", status: "checking" },
  { key: "api", label: "Server API (heartbeat route)", status: "checking" },
];

function StatusIcon({ s }: { s: Status }) {
  if (s === "ok") return <CheckCircle2 className="h-4 w-4 text-primary" />;
  if (s === "fail") return <XCircle className="h-4 w-4 text-destructive" />;
  return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
}

function DiagnosticsPage() {
  const [checks, setChecks] = useState<Check[]>(initial);
  const [counts, setCounts] = useState<{ devices: number; online: number } | null>(null);

  const set = (key: string, status: Status, detail?: string) =>
    setChecks((prev) => prev.map((c) => (c.key === key ? { ...c, status, detail } : c)));

  const run = async () => {
    setChecks(initial);
    setCounts(null);

    // Auth
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw error ?? new Error("no user");
      set("auth", "ok", data.user.email ?? undefined);
    } catch (e) { set("auth", "fail", (e as Error).message); }

    // DB (count query hits PostgREST)
    try {
      const { count, error } = await supabase.from("devices").select("*", { count: "exact", head: true });
      if (error) throw error;
      const { count: online } = await supabase.from("devices").select("*", { count: "exact", head: true }).eq("status", "online");
      setCounts({ devices: count ?? 0, online: online ?? 0 });
      set("db", "ok", `${count ?? 0} devices reachable`);
    } catch (e) { set("db", "fail", (e as Error).message); }

    // Realtime
    try {
      await new Promise<void>((resolve, reject) => {
        const to = setTimeout(() => reject(new Error("timeout")), 5000);
        const ch = supabase.channel("diag-" + Math.random().toString(36).slice(2))
          .subscribe((status) => {
            if (status === "SUBSCRIBED") { clearTimeout(to); supabase.removeChannel(ch); resolve(); }
            else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") { clearTimeout(to); reject(new Error(status)); }
          });
      });
      set("realtime", "ok", "channel subscribed");
    } catch (e) { set("realtime", "fail", (e as Error).message); }

    // Storage
    try {
      const { error } = await supabase.storage.from("media").list("", { limit: 1 });
      if (error) throw error;
      set("storage", "ok", "bucket reachable");
    } catch (e) { set("storage", "fail", (e as Error).message); }

    // Server API — unauthenticated ping should return 401 (route is alive)
    try {
      const res = await fetch("/api/public/devices/heartbeat", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
      if (res.status === 401 || res.ok) set("api", "ok", `HTTP ${res.status}`);
      else throw new Error(`HTTP ${res.status}`);
    } catch (e) { set("api", "fail", (e as Error).message); }
  };

  useEffect(() => { run(); }, []);

  const overall = checks.every((c) => c.status === "ok") ? "healthy" : checks.some((c) => c.status === "fail") ? "degraded" : "checking";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><Activity className="h-5 w-5 text-primary" /> Diagnostics</h1>
          <p className="text-sm text-muted-foreground">Backend subsystem health for this ScreenHub installation.</p>
        </div>
        <Button onClick={run} variant="outline" size="sm"><RefreshCcw className="mr-2 h-4 w-4" /> Re-run</Button>
      </header>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Overall status</span>
          <span className={`rounded-full px-3 py-1 text-xs ${overall === "healthy" ? "bg-primary/15 text-primary" : overall === "degraded" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
            {overall}
          </span>
        </div>
      </Card>

      <Card className="divide-y divide-border">
        {checks.map((c) => (
          <div key={c.key} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <StatusIcon s={c.status} />
              <div>
                <p className="text-sm font-medium">{c.label}</p>
                {c.detail && <p className="text-xs text-muted-foreground">{c.detail}</p>}
              </div>
            </div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">{c.status}</span>
          </div>
        ))}
      </Card>

      <Card className="p-4">
        <p className="mb-3 text-sm font-medium">Environment</p>
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div><dt className="text-muted-foreground">Application version</dt><dd className="font-mono">{import.meta.env.MODE} · {new Date().toISOString().slice(0, 10)}</dd></div>
          <div><dt className="text-muted-foreground">Supabase URL</dt><dd className="truncate font-mono">{import.meta.env.VITE_SUPABASE_URL ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Total devices</dt><dd className="font-mono">{counts?.devices ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Online devices</dt><dd className="font-mono">{counts?.online ?? "—"}</dd></div>
        </dl>
      </Card>
    </div>
  );
}

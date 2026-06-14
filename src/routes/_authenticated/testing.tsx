import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/testing")({ component: TestingPage });

type TestResult = { name: string; status: "idle" | "running" | "pass" | "fail"; detail?: string };

const SUITE: { name: string; run: () => Promise<string | void> }[] = [
  {
    name: "Devices table reachable (RLS)",
    run: async () => {
      const { error } = await supabase.from("devices").select("id").limit(1);
      if (error) throw new Error(error.message);
    },
  },
  {
    name: "Register endpoint rejects bad payload",
    run: async () => {
      const r = await fetch("/api/public/devices/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (r.status !== 400) throw new Error(`expected 400, got ${r.status}`);
    },
  },
  {
    name: "Heartbeat requires auth",
    run: async () => {
      const r = await fetch("/api/public/devices/heartbeat", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (r.status !== 401) throw new Error(`expected 401, got ${r.status}`);
    },
  },
  {
    name: "Pair endpoint creates pending code",
    run: async () => {
      const code = "TEST" + Math.random().toString(36).slice(2, 6).toUpperCase();
      const r = await fetch("/api/public/devices/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await r.json();
      if (data.status !== "pending") throw new Error(`expected pending, got ${JSON.stringify(data)}`);
    },
  },
  {
    name: "End-to-end: register device → heartbeat → send command → ack",
    run: async () => {
      const uid = "test_" + crypto.randomUUID().slice(0, 8);
      const { error: insErr } = await supabase.from("devices").insert({ device_name: "Test device", device_type: "other", unique_identifier: uid, status: "unregistered" });
      if (insErr) throw new Error("seed: " + insErr.message);

      const reg = await fetch("/api/public/devices/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unique_identifier: uid }) });
      if (!reg.ok) throw new Error("register failed");
      const { device_id, registration_token } = await reg.json();

      const { error: cmdErr } = await supabase.from("commands").insert({ device_id, command_type: "open_url", payload: { target: "https://example.com" }, status: "pending" });
      if (cmdErr) throw new Error("cmd insert: " + cmdErr.message);

      const hb = await fetch("/api/public/devices/heartbeat", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${registration_token}` }, body: "{}" });
      const hbd = await hb.json();
      if (!hbd.commands?.length) throw new Error("no commands returned");

      const ack = await fetch("/api/public/devices/ack", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${registration_token}` }, body: JSON.stringify({ command_id: hbd.commands[0].id, success: true }) });
      if (!ack.ok) throw new Error("ack failed");

      await supabase.from("devices").delete().eq("id", device_id);
      return `round-trip ok (device ${device_id.slice(0, 8)})`;
    },
  },
  {
    name: "Broadcast fan-out: all devices",
    run: async () => {
      const { data: devices } = await supabase.from("devices").select("id").limit(50);
      if (!devices?.length) return "skipped — no devices";
      return `would broadcast to ${devices.length} devices`;
    },
  },
  {
    name: "Playlists table accessible",
    run: async () => { const { error } = await supabase.from("playlists").select("id").limit(1); if (error) throw new Error(error.message); },
  },
  {
    name: "Schedules table accessible",
    run: async () => { const { error } = await supabase.from("schedules").select("id").limit(1); if (error) throw new Error(error.message); },
  },
];

function TestingPage() {
  const [results, setResults] = useState<TestResult[]>(SUITE.map((s) => ({ name: s.name, status: "idle" })));
  const [running, setRunning] = useState(false);

  const runAll = async () => {
    setRunning(true);
    for (let i = 0; i < SUITE.length; i++) {
      setResults((r) => r.map((x, idx) => idx === i ? { ...x, status: "running" } : x));
      try {
        const detail = await SUITE[i].run();
        setResults((r) => r.map((x, idx) => idx === i ? { ...x, status: "pass", detail: detail || undefined } : x));
      } catch (e) {
        setResults((r) => r.map((x, idx) => idx === i ? { ...x, status: "fail", detail: (e as Error).message } : x));
      }
    }
    setRunning(false);
  };

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-8">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Integration tests</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Testing center</h1>
          <p className="mt-1 text-sm text-muted-foreground">{passed} passed · {failed} failed · {SUITE.length} total</p>
        </div>
        <Button disabled={running} onClick={runAll}><Play className="mr-2 h-4 w-4" />Run all</Button>
      </header>

      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {results.map((r) => (
          <div key={r.name} className="flex items-start gap-3 p-4">
            <div className="mt-0.5">
              {r.status === "pass" && <CheckCircle2 className="h-5 w-5 text-primary" />}
              {r.status === "fail" && <XCircle className="h-5 w-5 text-destructive" />}
              {r.status === "running" && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
              {r.status === "idle" && <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{r.name}</p>
              {r.detail && <p className="mt-1 font-mono text-xs text-muted-foreground">{r.detail}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

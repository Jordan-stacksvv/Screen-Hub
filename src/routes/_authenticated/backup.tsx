// Workspace Backup & Restore — export/import workspace configuration as JSON.
// Media files are NOT embedded; content rows keep their file_url so a matching
// storage bucket restore keeps assets accessible.
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Download, Upload, Database, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/backup")({ component: BackupPage });

const TABLES = [
  "devices", "device_groups", "content", "playlists", "playlist_items",
  "schedules", "broadcasts", "workspaces", "organizations", "branches",
] as const;

async function exportAll() {
  const dump: Record<string, unknown[]> = { __meta: [{ exported_at: new Date().toISOString(), version: 1 }] };
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) throw new Error(`${table}: ${error.message}`);
    dump[table] = data ?? [];
  }
  return dump;
}

async function importAll(dump: Record<string, unknown[]>, mode: "merge" | "replace") {
  const results: { table: string; inserted: number; error?: string }[] = [];
  for (const table of TABLES) {
    const rows = dump[table];
    if (!Array.isArray(rows) || rows.length === 0) { results.push({ table, inserted: 0 }); continue; }
    try {
      if (mode === "replace") {
        await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      }
      const { error } = await supabase.from(table).upsert(rows as never[], { onConflict: "id" });
      if (error) throw error;
      results.push({ table, inserted: rows.length });
    } catch (e) {
      results.push({ table, inserted: 0, error: (e as Error).message });
    }
  }
  return results;
}

function BackupPage() {
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<{ table: string; inserted: number; error?: string }[] | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const fileRef = useRef<HTMLInputElement>(null);

  const doExport = async () => {
    setBusy(true);
    try {
      const dump = await exportAll();
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `screenhub-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const doImport = async (file: File) => {
    setBusy(true); setSummary(null);
    try {
      const text = await file.text();
      const dump = JSON.parse(text) as Record<string, unknown[]>;
      const res = await importAll(dump, mode);
      setSummary(res);
      const failed = res.filter((r) => r.error);
      if (failed.length) toast.error(`${failed.length} table(s) failed`);
      else toast.success("Backup restored");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Database className="h-5 w-5 text-primary" /> Workspace Backup</h1>
        <p className="text-sm text-muted-foreground">Export and import workspace configuration as a portable JSON file.</p>
      </header>

      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-sm font-medium">Export</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Includes devices, groups, content metadata, playlists, schedules, and broadcast history. Media files are not
            embedded — keep the same storage bucket to preserve <code className="rounded bg-muted px-1">file_url</code> references.
          </p>
        </div>
        <Button onClick={doExport} disabled={busy}><Download className="mr-2 h-4 w-4" /> Download backup</Button>
      </Card>

      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-sm font-medium">Import / Restore</h2>
          <p className="mt-1 text-xs text-muted-foreground">Upload a previously exported backup file.</p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-2"><input type="radio" checked={mode === "merge"} onChange={() => setMode("merge")} /> Merge (upsert)</label>
          <label className="flex items-center gap-2"><input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} /> Replace (delete then insert)</label>
        </div>

        {mode === "replace" && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Replace mode deletes every row in each listed table before importing. Use with care.</span>
          </div>
        )}

        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); }} />
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}><Upload className="mr-2 h-4 w-4" /> Upload backup file</Button>

        {summary && (
          <div className="rounded-md border border-border">
            {summary.map((r) => (
              <div key={r.table} className="flex items-center justify-between border-b border-border px-3 py-2 text-xs last:border-b-0">
                <span className="font-mono">{r.table}</span>
                {r.error ? (
                  <span className="text-destructive">{r.error}</span>
                ) : (
                  <span className="flex items-center gap-1 text-primary"><CheckCircle2 className="h-3 w-3" /> {r.inserted} row(s)</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

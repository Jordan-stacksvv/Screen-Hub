import { createFileRoute, Link } from "@tanstack/react-router";
import { isDesktopApp, bridge } from "@/desktop/bridge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/desktop/settings")({ component: DesktopSettings });

function DesktopSettings() {
  const b = bridge();
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <header>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Settings</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Desktop preferences</h1>
      </header>

      <section className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
        <Row label="Runtime" value={isDesktopApp ? `Electron · ${b.platform}` : "Web browser"} />
        <Row label="Command palette" value={<kbd className="rounded bg-muted px-1.5 py-0.5 text-[11px]">⌘K</kbd>} />
        <Row label="New broadcast" value={<kbd className="rounded bg-muted px-1.5 py-0.5 text-[11px]">⌘B</kbd>} />
        <Row label="Upload" value={<kbd className="rounded bg-muted px-1.5 py-0.5 text-[11px]">⌘U</kbd>} />
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Manage in the web app</h2>
        <p className="mt-1 text-xs text-muted-foreground">Playlists, schedules, groups and account settings use the same web pages inside the desktop shell.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/playlists"><Button size="sm" variant="outline"><ExternalLink className="mr-1 h-3 w-3" />Playlists</Button></Link>
          <Link to="/schedules"><Button size="sm" variant="outline"><ExternalLink className="mr-1 h-3 w-3" />Schedules</Button></Link>
          <Link to="/groups"><Button size="sm" variant="outline"><ExternalLink className="mr-1 h-3 w-3" />Groups</Button></Link>
          <Link to="/content"><Button size="sm" variant="outline"><ExternalLink className="mr-1 h-3 w-3" />Content library</Button></Link>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex items-center justify-between border-b border-border/50 py-1 last:border-b-0"><span className="text-xs text-muted-foreground">{label}</span><span className="text-xs">{value}</span></div>;
}

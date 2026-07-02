import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, AlertCircle, Radio, Terminal, MonitorSmartphone } from "lucide-react";
import { useActivityFeed } from "@/desktop/hooks/use-activity-feed";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/desktop/activity")({ component: ActivityPage });

function ActivityPage() {
  const events = useActivityFeed(200);
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <header>
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Realtime</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Activity Center</h1>
        <p className="mt-1 text-xs text-muted-foreground">Full stream of commands, broadcasts and device status changes.</p>
      </header>
      <div className="rounded-xl border border-border bg-card">
        {events.length === 0 && <p className="p-8 text-center text-xs text-muted-foreground">Waiting for events…</p>}
        <ul className="divide-y divide-border">
          {events.map(e => {
            const Icon = e.kind === "broadcast" ? Radio : e.kind === "command" ? Terminal : MonitorSmartphone;
            const StatusIcon = e.level === "error" ? AlertCircle : e.level === "success" ? CheckCircle2 : null;
            return (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-xs">{e.title}</span>
                <span className="text-[10px] text-muted-foreground">{e.subtitle}</span>
                {StatusIcon && <StatusIcon className={cn("h-3 w-3", e.level === "error" ? "text-destructive" : "text-primary")} />}
                <span className="w-24 text-right text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(e.ts), { addSuffix: true })}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

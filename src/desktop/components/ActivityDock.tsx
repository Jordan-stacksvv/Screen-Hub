import { useEffect, useRef } from "react";
import { PanelRightClose, PanelRightOpen, CheckCircle2, AlertCircle, Radio, Terminal, MonitorSmartphone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useActivityFeed } from "@/desktop/hooks/use-activity-feed";
import { bridge } from "@/desktop/bridge";
import { cn } from "@/lib/utils";

// Right-rail live activity + throttled OS notifications on failures.
export function ActivityDock({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const events = useActivityFeed(80);
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const e of events) {
      if (e.level !== "error" && e.level !== "success") continue;
      if (notified.current.has(e.id)) continue;
      notified.current.add(e.id);
      bridge().notify({ title: e.title, body: e.subtitle });
      if (notified.current.size > 200) notified.current = new Set(Array.from(notified.current).slice(-100));
    }
  }, [events]);

  if (!open) {
    return (
      <button onClick={onToggle} className="hidden h-full w-8 items-center justify-center border-l border-border bg-card md:flex" title="Show activity">
        <PanelRightOpen className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-l border-border bg-card md:flex">
      <div className="flex h-10 items-center justify-between border-b border-border px-3">
        <span className="text-xs font-medium">Activity</span>
        <button onClick={onToggle} title="Hide"><PanelRightClose className="h-3.5 w-3.5 text-muted-foreground" /></button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {events.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">Live events will appear here.</p>}
        <ul className="divide-y divide-border">
          {events.map((e) => {
            const Icon = e.kind === "broadcast" ? Radio : e.kind === "command" ? Terminal : MonitorSmartphone;
            const StatusIcon = e.level === "error" ? AlertCircle : e.level === "success" ? CheckCircle2 : null;
            return (
              <li key={e.id} className="flex items-start gap-2 px-3 py-2">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{e.title}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{e.subtitle}</p>
                  <p className="text-[10px] text-muted-foreground/70">{formatDistanceToNow(new Date(e.ts), { addSuffix: true })}</p>
                </div>
                {StatusIcon && <StatusIcon className={cn("h-3 w-3", e.level === "error" ? "text-destructive" : "text-primary")} />}
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

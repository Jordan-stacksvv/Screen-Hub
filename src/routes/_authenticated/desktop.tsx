// Desktop workspace layout. The whole /desktop subtree renders inside this
// (instead of the AppShell) so the Electron window gets its own IA.
import { Link, Outlet, useRouterState, useNavigate, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, MonitorSmartphone, Radio, ListVideo, CalendarClock, Image as ImageIcon,
  Activity, Settings, Zap, Command, Cast,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { bridge, isDesktopApp } from "@/desktop/bridge";
import { useHotkeys } from "@/desktop/hooks/use-hotkeys";
import { CommandPalette } from "@/desktop/components/CommandPalette";
import { ActivityDock } from "@/desktop/components/ActivityDock";

export const Route = createFileRoute("/_authenticated/desktop")({ component: DesktopLayout });

const NAV = [
  { to: "/desktop", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/desktop/devices", label: "Devices", icon: MonitorSmartphone },
  { to: "/desktop/live-control", label: "Live Control", icon: Zap },
  { to: "/desktop/media", label: "Media", icon: ImageIcon },
  { to: "/desktop/broadcasts", label: "Broadcasts", icon: Radio },
  { to: "/desktop/playlists", label: "Playlists", icon: ListVideo },
  { to: "/desktop/schedules", label: "Schedules", icon: CalendarClock },
  { to: "/desktop/activity", label: "Activity", icon: Activity },
  { to: "/desktop/settings", label: "Settings", icon: Settings },
];

function DesktopLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(true);

  useHotkeys({
    "mod+k": () => setPaletteOpen(true),
    "mod+b": () => navigate({ to: "/desktop/broadcasts" }),
    "mod+u": () => navigate({ to: "/desktop/media" }),
    "mod+,": () => navigate({ to: "/desktop/settings" }),
    "mod+1": () => navigate({ to: "/desktop" }),
    "mod+2": () => navigate({ to: "/desktop/devices" }),
    "mod+3": () => navigate({ to: "/desktop/live-control" }),
    "mod+4": () => navigate({ to: "/desktop/media" }),
    "mod+5": () => navigate({ to: "/desktop/broadcasts" }),
  });

  useEffect(() => {
    const unsub = bridge().onNavigate((p) => { if (typeof p === "string") navigate({ to: p }); });
    return unsub;
  }, [navigate]);

  return (
    <div className="flex h-screen min-h-screen bg-background text-foreground">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-12 items-center gap-2 border-b border-sidebar-border px-4">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30">
            <Cast className="h-3 w-3 text-primary" />
          </div>
          <div className="flex-1">
            <span className="text-xs font-semibold tracking-tight text-sidebar-foreground">ScreenHub</span>
            <span className="ml-1 text-[10px] uppercase tracking-widest text-muted-foreground">Control</span>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");
            return (
              <Link key={to} to={to} className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}>
                <Icon className="h-3.5 w-3.5" />
                <span className="flex-1">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-2">
          <button onClick={() => setPaletteOpen(true)} className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-sidebar-accent">
            <Command className="h-3 w-3" />
            <span className="flex-1 text-left">Command palette</span>
            <kbd className="rounded bg-background/80 px-1 py-px text-[9px]">⌘K</kbd>
          </button>
          <Link to="/dashboard" className="mt-1 block px-2.5 py-1 text-[10px] text-muted-foreground hover:text-foreground">
            ← Back to web app
          </Link>
          {isDesktopApp && <p className="mt-1 px-2.5 text-[10px] text-primary">Desktop · {bridge().platform}</p>}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto"><Outlet /></div>
      </main>

      <ActivityDock open={dockOpen} onToggle={() => setDockOpen((v) => !v)} />

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

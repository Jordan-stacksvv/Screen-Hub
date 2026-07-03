import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, MonitorSmartphone, Layers, Library, Terminal,
  LogOut, Cast, Search, Tv, ListVideo, CalendarClock, Radio,
  Monitor, FlaskConical, Map, BookOpen, Activity, Compass,
  Database, Stethoscope, Zap,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; group?: string }[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/devices", label: "Devices", icon: MonitorSmartphone },
  { to: "/groups", label: "Groups", icon: Layers },
  { to: "/content", label: "Content", icon: Library },
  { to: "/playlists", label: "Playlists", icon: ListVideo },
  { to: "/schedules", label: "Schedules", icon: CalendarClock },
  { to: "/commands", label: "Commands", icon: Terminal },
  { to: "/broadcasts", label: "Broadcasts", icon: Radio },
  { to: "/simulator", label: "Simulator", icon: Tv, group: "tools" },
  { to: "/client", label: "Device Client", icon: Monitor, group: "tools" },
  { to: "/testing", label: "Testing", icon: FlaskConical, group: "tools" },
  { to: "/documentation", label: "Documentation", icon: BookOpen, group: "info" },
  { to: "/roadmap", label: "Roadmap", icon: Map, group: "info" },
  { to: "/project-status", label: "Status", icon: Activity, group: "info" },
  { to: "/future", label: "Future", icon: Compass, group: "info" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["me-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle();
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return { email: user.email, name: data?.display_name ?? user.email, roles: roles?.map(r => r.role) ?? [] };
    },
  });

  useEffect(() => { if (profile) setUser({ email: profile.email, name: profile.name ?? undefined }); }, [profile]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30">
            <Cast className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">ScreenHub</span>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {NAV.map(({ to, label, icon: Icon, group }, i) => {
            const active = pathname === to || pathname.startsWith(to + "/");
            const prev = NAV[i - 1];
            const showDivider = group && prev?.group !== group;
            return (
              <div key={to}>
                {showDivider && <div className="my-2 border-t border-sidebar-border" />}
                <Link to={to} className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}>
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                  {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
              {(user?.name?.[0] ?? "U").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{user?.name ?? "—"}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search devices, content, commands…" className="pl-9 h-9 bg-card/50" />
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground md:inline">Workspace</span>
            <span className="rounded-md border border-border bg-card px-2 py-1 text-xs font-mono">main</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Monitor, Tv, Smartphone, Cast, Radio, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />

      <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/30">
            <Cast className="h-4 w-4 text-primary" />
          </div>
          <span className="text-base font-semibold tracking-tight">ScreenHub</span>
        </div>
        <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
      </nav>

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-16 text-center md:pt-28">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          Real-time screen control · v1.0 MVP
        </div>
        <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
          Every screen,<br />
          <span className="bg-gradient-to-r from-primary to-emerald-300 bg-clip-text text-transparent">
            one control room.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-balance text-base text-muted-foreground md:text-lg">
          Remotely manage content on Android TVs, tablets, phones, and Windows displays
          across every location — from one dashboard.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth"><Button size="lg" className="glow">Get started</Button></Link>
          <Link to="/auth"><Button size="lg" variant="outline">View dashboard</Button></Link>
        </div>

        <div className="mt-20 grid grid-cols-2 gap-3 md:grid-cols-3">
          {[
            { icon: Tv, label: "Android TV" },
            { icon: Smartphone, label: "Phones & Tablets" },
            { icon: Monitor, label: "Windows / Mini PC" },
            { icon: Radio, label: "Real-time commands" },
            { icon: ShieldCheck, label: "Role-based access" },
            { icon: Cast, label: "Content library" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-card/50 p-4 text-left backdrop-blur">
              <Icon className="h-5 w-5 text-primary" />
              <span className="text-sm">{label}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

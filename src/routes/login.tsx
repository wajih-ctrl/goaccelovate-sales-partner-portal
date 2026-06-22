import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, UserCog, Briefcase } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const ROLES = [
  { role: "super_admin" as const, title: "Super Admin", desc: "Full access — users, settings, audit log, all data.", icon: Shield, email: "alex@goaccelovate.com" },
  { role: "admin" as const, title: "Admin", desc: "Manage partners, leads, commissions, payouts, payments.", icon: UserCog, email: "marcus@goaccelovate.com" },
  { role: "partner" as const, title: "Sales Partner", desc: "Submit and track your own leads, commissions, payouts.", icon: Briefcase, email: "priya@horizonglobal.com" },
];

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const go = (role: "super_admin" | "admin" | "partner") => {
    login(role);
    toast.success(`Signed in as demo ${ROLES.find(r => r.role === role)?.title}`);
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="hidden flex-1 bg-sidebar text-sidebar-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-brand font-bold text-brand-foreground">G</div>
          <div>
            <div className="text-base font-semibold">GoAccelovate</div>
            <div className="text-xs uppercase tracking-widest text-sidebar-foreground/60">GTPP Partner Portal</div>
          </div>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">The private operating system for the Global Trade Partner Program.</h2>
          <p className="mt-4 text-sm text-sidebar-foreground/70">Manage partners, leads, pipeline, commissions and payouts in one elegant workspace — built exclusively for the GoAccelovate network.</p>
        </div>
        <div className="text-xs text-sidebar-foreground/50">© 2026 GoAccelovate · Invitation only</div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-brand font-bold text-brand-foreground">G</div>
              <span className="font-semibold">GoAccelovate</span>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">Use a demo role below, or sign in with your credentials.</p>
          </div>

          <Card className="space-y-3 p-5">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</label>
              <input className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" placeholder="you@company.com" />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Password</label>
              <input type="password" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" placeholder="••••••••" />
            </div>
            <Button className="w-full" onClick={() => { toast.info("Demo: pick a role below to enter the prototype."); }}>Sign in</Button>
            <Link to="/forgot-password" className="block text-center text-xs text-muted-foreground hover:text-foreground">Forgot password?</Link>
          </Card>

          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Demo roles</div>
            {ROLES.map(r => {
              const Icon = r.icon;
              return (
                <button key={r.role} onClick={() => go(r.role)} className="group flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-ring hover:bg-accent/40">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-brand text-brand-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{r.title} Demo</div>
                    <div className="text-xs text-muted-foreground">{r.desc}</div>
                  </div>
                  <span className="text-xs font-medium text-brand opacity-0 group-hover:opacity-100">Enter →</span>
                </button>
              );
            })}
          </div>

          <p className="text-center text-[11px] text-muted-foreground">Invitation only · By accessing you agree to the GoAccelovate Partner Terms.</p>
        </div>
      </div>
    </div>
  );
}

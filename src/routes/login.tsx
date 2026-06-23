import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Briefcase, Shield, UserCog } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const ROLES = [
  {
    role: "super_admin" as const,
    title: "Super Admin",
    desc: "Full access: users, settings, audit log, all data.",
    icon: Shield,
  },
  {
    role: "admin" as const,
    title: "Admin",
    desc: "Manage partners, leads, commissions, payouts, payments.",
    icon: UserCog,
  },
  {
    role: "partner" as const,
    title: "Sales Partner",
    desc: "Submit and track your own leads, commissions, payouts.",
    icon: Briefcase,
  },
];

function LoginPage() {
  const { login, signIn } = useAuth();
  const navigate = useNavigate();
  const demoEnabled = import.meta.env.VITE_ENABLE_DEMO_LOGIN === "true";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const go = (role: "super_admin" | "admin" | "partner") => {
    login(role);
    toast.success(`Signed in as demo ${ROLES.find((r) => r.role === role)?.title}`);
    navigate({ to: "/dashboard" });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Signed in");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="hidden flex-1 bg-sidebar text-sidebar-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-brand font-bold text-brand-foreground">
            G
          </div>
          <div>
            <div className="text-base font-semibold">GoAccelovate</div>
            <div className="text-xs uppercase tracking-widest text-sidebar-foreground/60">
              GTPP Partner Portal
            </div>
          </div>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">
            The private operating system for the Global Trade Partner Program.
          </h2>
          <p className="mt-4 text-sm text-sidebar-foreground/70">
            Manage partners, leads, pipeline, commissions and payouts in one elegant workspace built
            exclusively for the GoAccelovate network.
          </p>
        </div>
        <div className="text-xs text-sidebar-foreground/50">2026 GoAccelovate. Invitation only</div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-brand font-bold text-brand-foreground">
                G
              </div>
              <span className="font-semibold">GoAccelovate</span>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Use the account invitation sent by GoAccelovate.
            </p>
          </div>

          {!isSupabaseConfigured && (
            <Card className="border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
              Supabase is not configured for this environment. Add the Supabase URL and publishable
              key to enable real login.
            </Card>
          )}

          <form onSubmit={submit}>
            <Card className="space-y-3 p-5">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Email
                </label>
                <input
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Password
                </label>
                <input
                  type="password"
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>
              <Link
                to="/forgot-password"
                className="block text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Forgot password?
              </Link>
            </Card>
          </form>

          {demoEnabled && (
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Development demo roles
              </div>
              {ROLES.map((r) => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.role}
                    onClick={() => go(r.role)}
                    className="group flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-ring hover:bg-accent/40"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-brand text-brand-foreground">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{r.title} Demo</div>
                      <div className="text-xs text-muted-foreground">{r.desc}</div>
                    </div>
                    <span className="text-xs font-medium text-brand opacity-0 group-hover:opacity-100">
                      Enter
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <p className="text-center text-[11px] text-muted-foreground">
            Invitation only. By accessing you agree to the GoAccelovate Partner Terms.
          </p>
        </div>
      </div>
    </div>
  );
}

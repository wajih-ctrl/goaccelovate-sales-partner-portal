import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PageHeader, PageContainer } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { ONBOARDING_STEPS } from "@/lib/mock-data";
import { CheckCircle2, Circle } from "lucide-react";

export const Route = createFileRoute("/_app/onboarding")({ component: Onboarding });

function Onboarding() {
  const { user } = useAuth();
  const { onboarding } = useStore();
  if (user?.role !== "partner") return <Navigate to="/access-denied" />;
  const status = onboarding[user.partnerId!] || {};
  const done = ONBOARDING_STEPS.filter((s) => status[s.key]).length;
  const pct = Math.round((done / ONBOARDING_STEPS.length) * 100);

  return (
    <>
      <PageHeader
        title="Onboarding Checklist"
        description="Complete each step to fully activate your partner account."
      />
      <PageContainer>
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">
                {done} of {ONBOARDING_STEPS.length} steps complete
              </div>
              <div className="text-xs text-muted-foreground">
                Final activation must be confirmed by your GoAccelovate contact.
              </div>
            </div>
            <div className="text-2xl font-semibold">{pct}%</div>
          </div>
          <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-accent">
            <div className="h-full bg-gradient-brand transition-all" style={{ width: `${pct}%` }} />
          </div>
          <ul className="space-y-2">
            {ONBOARDING_STEPS.map((s) => {
              const d = status[s.key];
              const locked = s.key === "activation";
              return (
                <li
                  key={s.key}
                  className={`flex items-center gap-3 rounded-md border p-3 ${d ? "bg-success/5 border-success/20" : ""}`}
                >
                  {d ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div className="flex-1">
                    <span className={d ? "text-foreground" : "text-muted-foreground"}>
                      {s.label}
                    </span>
                    <div className="text-[11px] text-muted-foreground">
                      {locked
                        ? "Only your GoAccelovate contact can confirm this step."
                        : "Managed by your GoAccelovate contact."}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </PageContainer>
    </>
  );
}

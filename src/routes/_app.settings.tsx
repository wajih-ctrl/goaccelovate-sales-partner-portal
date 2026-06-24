import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PageHeader, PageContainer } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore, type Settings as StoreSettings } from "@/lib/store";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import { FormDialog } from "@/components/common/dialogs";

export const Route = createFileRoute("/_app/settings")({ component: Settings });

const TIERS = ["Associate", "Specialist", "Partner"] as const;
const splitList = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const toForm = (s: StoreSettings) => ({
  ...s,
  currencies: s.currencies.join(", "),
  industries: s.industries.join(", "),
  pipelineLabels: s.pipelineLabels.join(", "),
  onboardingSteps: s.onboardingSteps.join(", "),
  tierLabels: s.tierLabels.join(", "),
});

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-b py-4 last:border-b-0 md:grid-cols-3">
      <div className="text-sm font-medium">{label}</div>
      <div className="md:col-span-2">{children}</div>
    </div>
  );
}

function Settings() {
  const { user } = useAuth();
  const { settings, updateSettings } = useStore();
  const [form, setForm] = useState(() => toForm(settings));
  const [pendingPatch, setPendingPatch] = useState<Partial<typeof settings> | null>(null);
  useEffect(() => {
    setForm(toForm(settings));
  }, [settings]);
  if (user?.role !== "super_admin") return <Navigate to="/access-denied" />;

  const buildPatch = () => ({
    defaultRate: Number(form.defaultRate),
    defaultRates: {
      Associate: Number(form.defaultRates.Associate),
      Specialist: Number(form.defaultRates.Specialist),
      Partner: Number(form.defaultRates.Partner),
    },
    staleThreshold: Number(form.staleThreshold),
    payoutWindow: Number(form.payoutWindow),
    invitationExpiry: Number(form.invitationExpiry),
    currency: form.currency,
    currencies: splitList(form.currencies),
    industries: splitList(form.industries),
    pipelineLabels: splitList(form.pipelineLabels),
    onboardingSteps: splitList(form.onboardingSteps),
    tierLabels: splitList(form.tierLabels),
  });

  const save = () => {
    setPendingPatch(buildPatch());
  };

  const confirmSave = () => {
    if (!pendingPatch) return;
    updateSettings(pendingPatch, user.name);
    toast.success("Settings saved. Audit entry recorded.");
    setPendingPatch(null);
  };

  function upd<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  const updTierRate = (tier: (typeof TIERS)[number], value: string) => {
    setForm((f) => ({ ...f, defaultRates: { ...f.defaultRates, [tier]: Number(value) } }));
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description="System-wide configuration. Only Super Admins can edit."
        actions={
          <Button onClick={save}>
            <Save className="mr-2 h-4 w-4" />
            Save changes
          </Button>
        }
      />
      <PageContainer>
        <Card className="p-5">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Commission & Payouts
          </h3>
          <Row label="Fallback commission rate (%)">
            <input
              type="number"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.defaultRate}
              onChange={(e) => upd("defaultRate", Number(e.target.value))}
            />
          </Row>
          <Row label="Tier-specific default rates (%)">
            <div className="grid gap-2 md:grid-cols-3">
              {TIERS.map((tier) => (
                <label key={tier} className="text-xs text-muted-foreground">
                  {tier}
                  <input
                    type="number"
                    className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground"
                    value={form.defaultRates[tier]}
                    onChange={(e) => updTierRate(tier, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </Row>
          <Row label="Payout window (days)">
            <input
              type="number"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.payoutWindow}
              onChange={(e) => upd("payoutWindow", Number(e.target.value))}
            />
          </Row>
          <Row label="Default currency">
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.currency}
              onChange={(e) => upd("currency", e.target.value)}
            >
              {splitList(form.currencies).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Row>
          <Row label="Supported currencies">
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.currencies}
              onChange={(e) => upd("currencies", e.target.value)}
            />
          </Row>
        </Card>

        <Card className="p-5">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Pipeline & Leads
          </h3>
          <Row label="Lead staleness threshold (days)">
            <input
              type="number"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.staleThreshold}
              onChange={(e) => upd("staleThreshold", Number(e.target.value))}
            />
          </Row>
          <Row label="Pipeline stage labels">
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.pipelineLabels}
              onChange={(e) => upd("pipelineLabels", e.target.value)}
            />
          </Row>
          <Row label="Industry / sector options">
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.industries}
              onChange={(e) => upd("industries", e.target.value)}
            />
          </Row>
        </Card>

        <Card className="p-5">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Onboarding
          </h3>
          <Row label="Invitation expiry (hours)">
            <input
              type="number"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.invitationExpiry}
              onChange={(e) => upd("invitationExpiry", Number(e.target.value))}
            />
          </Row>
          <Row label="Partner tier labels">
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.tierLabels}
              onChange={(e) => upd("tierLabels", e.target.value)}
            />
          </Row>
          <Row label="Onboarding checklist steps">
            <textarea
              rows={3}
              className="w-full rounded-md border bg-background p-3 text-sm"
              value={form.onboardingSteps}
              onChange={(e) => upd("onboardingSteps", e.target.value)}
            />
          </Row>
        </Card>

        <Card className="p-5">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Notifications
          </h3>
          <Row label="Email — non-critical updates">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" defaultChecked /> Enabled
            </label>
          </Row>
          <Row label="Email — mandatory alerts">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" defaultChecked disabled /> Always on (locked)
            </label>
          </Row>
        </Card>
      </PageContainer>
      <FormDialog
        open={!!pendingPatch}
        onOpenChange={(open) => !open && setPendingPatch(null)}
        title="Confirm settings changes"
        description="Review these system configuration changes before saving."
        submitLabel="Confirm and save"
        onSubmit={confirmSave}
      >
        <div className="space-y-2 text-sm">
          {pendingPatch &&
            Object.entries(pendingPatch)
              .filter(
                ([key, value]) =>
                  JSON.stringify(value) !== JSON.stringify(settings[key as keyof typeof settings]),
              )
              .map(([key, value]) => (
                <div key={key} className="rounded-md border bg-accent/20 p-3">
                  <div className="font-medium">{key}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Previous: {JSON.stringify(settings[key as keyof typeof settings])}
                  </div>
                  <div className="text-xs text-muted-foreground">New: {JSON.stringify(value)}</div>
                  <div className="mt-1 text-xs text-warning-foreground">
                    {[
                      "defaultRates",
                      "pipelineLabels",
                      "currencies",
                      "tierLabels",
                      "onboardingSteps",
                      "staleThreshold",
                      "payoutWindow",
                    ].includes(key)
                      ? "May affect operational workflows and existing screens."
                      : "Applies to future records and configuration reads."}
                  </div>
                </div>
              ))}
        </div>
      </FormDialog>
    </>
  );
}

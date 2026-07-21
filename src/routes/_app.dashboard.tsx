import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { PageHeader, PageContainer, StatusBadge } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { fmtCurrency, daysSince } from "@/lib/domain";
import { isAnnouncementTargeted } from "@/lib/announcements";
import type { ReactNode } from "react";
import { PartnerPayoutRequestButton } from "@/components/commissions/PartnerPayoutRequestButton";
import {
  Users,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  PlusCircle,
  Wallet,
  KanbanSquare,
  Briefcase,
  ArrowUpRight,
  FileText,
  FileSignature,
  type LucideIcon,
} from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

type StatProps = {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  hint?: ReactNode;
  accent?: string;
};

function Stat({ label, value, icon: Icon, hint, accent }: StatProps) {
  return (
    <Card className="p-5 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-md ${accent || "bg-accent text-accent-foreground"}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function Dashboard() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === "partner" && user.agreementsComplete !== true)
    return <PartnerAgreementDashboard />;
  if (user.role === "partner") return <PartnerDash partnerId={user.partnerId!} />;
  return <AdminDash />;
}

function PartnerAgreementDashboard() {
  return (
    <>
      <PageHeader
        title="My Dashboard"
        description="Welcome to the GoAccelovate Global Partner Program."
      />
      <PageContainer>
        <Card className="max-w-3xl space-y-4 p-5 shadow-card">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand">
              <FileSignature className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">Complete your onboarding</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Review and sign the Partner Agreement and NDA to activate leads, pipeline,
                commissions, announcements, and reports.
              </p>
            </div>
          </div>
          <Link to="/onboarding">
            <Button>
              <FileSignature className="mr-2 h-4 w-4" />
              Open Onboarding
            </Button>
          </Link>
        </Card>
      </PageContainer>
    </>
  );
}

function AdminDash() {
  const { partners, leads, commissions, payouts, activity, settings } = useStore();
  const activePartners = partners.filter((p) => p.status === "Active").length;
  const byStatus = {
    "In Progress": leads.filter(
      (lead) =>
        !["Closed Won", "Closed Lost"].includes(lead.stage) && lead.status !== "Duplicate Rejected",
    ).length,
    "Closed Won": leads.filter((lead) => lead.stage === "Closed Won").length,
    "Closed Lost": leads.filter((lead) => lead.stage === "Closed Lost").length,
    "On Hold": leads.filter((lead) => lead.stage === "On Hold").length,
  };
  const pipelineValue = leads
    .filter(
      (l) => !["Closed Won", "Closed Lost"].includes(l.stage) && l.status !== "Duplicate Rejected",
    )
    .reduce((s, l) => s + l.estimatedValue, 0);
  const commissionsYTD = commissions.reduce((s, c) => s + c.amount, 0);
  const owed = commissions
    .filter((c) => c.state === "Unpaid" || c.state === "Approved" || c.state === "Payout Requested")
    .reduce((s, c) => s + c.amount, 0);
  const pendingPayouts = payouts.filter((p) => p.status === "Pending");
  const stale = leads.filter(
    (l) =>
      !["Closed Won", "Closed Lost"].includes(l.stage) &&
      l.status !== "Duplicate Rejected" &&
      daysSince(l.lastActivity) >= settings.staleThreshold,
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Real-time view of the Global Partner Program."
        actions={
          <>
            <Link to="/pipeline" search={{ view: "list" }}>
              <Button variant="outline">
                <KanbanSquare className="mr-2 h-4 w-4" />
                Pipeline
              </Button>
            </Link>
            <Link to="/partners">
              <Button variant="outline">
                <Briefcase className="mr-2 h-4 w-4" />
                Partners
              </Button>
            </Link>
            <Link to="/payouts">
              <Button>
                <Wallet className="mr-2 h-4 w-4" />
                Approve Payouts
              </Button>
            </Link>
          </>
        }
      />
      <PageContainer>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Active Partners"
            value={activePartners}
            icon={Users}
            hint={`${partners.filter((partner) => partner.status === "Pending").length} pending onboarding`}
            accent="bg-info/10 text-info"
          />
          <Stat
            label="Pipeline Value"
            value={fmtCurrency(pipelineValue)}
            icon={TrendingUp}
            hint={`${byStatus["In Progress"]} in-progress leads`}
            accent="bg-brand/10 text-brand"
          />
          <Stat
            label="Commissions YTD"
            value={fmtCurrency(commissionsYTD)}
            icon={DollarSign}
            hint="Across all closed-won deals"
            accent="bg-success/10 text-success"
          />
          <Stat
            label="Owed to Partners"
            value={fmtCurrency(owed)}
            icon={Wallet}
            hint={`${pendingPayouts.length} pending payout requests`}
            accent="bg-warning/15 text-warning-foreground"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Leads by status</h3>
                <p className="text-xs text-muted-foreground">Across all partners</p>
              </div>
              <Link
                to="/pipeline"
                search={{ view: "list" }}
                className="text-xs text-brand hover:underline"
              >
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Object.entries(byStatus).map(([k, v]) => (
                <div key={k} className="rounded-md border bg-accent/30 p-3">
                  <div className="text-xs text-muted-foreground">{k}</div>
                  <div className="mt-1 text-xl font-semibold">{v}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Pending payouts</h3>
              <Link to="/payouts" className="text-xs text-brand hover:underline">
                Review →
              </Link>
            </div>
            {pendingPayouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending requests.</p>
            ) : (
              <ul className="space-y-2">
                {pendingPayouts.slice(0, 5).map((p) => {
                  const partner = partners.find((pp) => pp.id === p.partnerId);
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-md border p-2.5 text-sm"
                    >
                      <div>
                        <div className="font-medium">{partner?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">
                          Requested {new Date(p.requestedDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="font-semibold">{fmtCurrency(p.amount)}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning-foreground" />
                Stale leads ({settings.staleThreshold}+ days)
              </h3>
              <Link
                to="/pipeline"
                search={{ view: "list" }}
                className="text-xs text-brand hover:underline"
              >
                View →
              </Link>
            </div>
            {stale.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stale leads. Pipeline is healthy.</p>
            ) : (
              <ul className="divide-y">
                {stale.slice(0, 6).map((l) => (
                  <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <Link
                        to="/leads/$id"
                        params={{ id: l.id }}
                        className="font-medium hover:underline"
                      >
                        {l.company}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {daysSince(l.lastActivity)} days · {l.stage}
                      </div>
                    </div>
                    <StatusBadge status={l.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5 shadow-card">
            <h3 className="mb-3 font-semibold">Recent pipeline activity</h3>
            <ul className="divide-y">
              {activity.slice(0, 6).map((entry) => (
                <li key={entry.id} className="py-2 text-sm">
                  <div>{entry.text}</div>
                  <div className="text-xs text-muted-foreground">
                    {entry.user} - {new Date(entry.date).toLocaleString()}
                  </div>
                </li>
              ))}
              {activity.length === 0 && (
                <li className="text-sm text-muted-foreground">No activity yet.</li>
              )}
            </ul>
          </Card>
        </div>

        <Card className="p-5 shadow-card">
          <h3 className="mb-3 font-semibold">Recent activity</h3>
          <ul className="space-y-3">
            {activity.slice(0, 10).map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />
                <div className="flex-1">
                  <div className="text-sm">{a.text}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {a.user} - {new Date(a.date).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </PageContainer>
    </>
  );
}

function PartnerDash({ partnerId }: { partnerId: string }) {
  const { partners, leads, commissions, payouts, announcements, activity } = useStore();
  const partner = partners.find((p) => p.id === partnerId);
  const myLeads = leads.filter((l) => l.partnerId === partnerId);
  const won = myLeads.filter((l) => l.status === "Closed Won").length;
  const lost = myLeads.filter((l) => l.status === "Closed Lost").length;
  const active = myLeads.filter(
    (l) => !["Closed Won", "Closed Lost"].includes(l.stage) && l.status !== "Duplicate Rejected",
  ).length;
  const pipeline = myLeads
    .filter(
      (l) => !["Closed Won", "Closed Lost"].includes(l.stage) && l.status !== "Duplicate Rejected",
    )
    .reduce((s, l) => s + l.estimatedValue, 0);
  const myComm = commissions.filter((c) => c.partnerId === partnerId);
  const earned = myComm.reduce((sum, commission) => sum + (commission.eligibleAmount || 0), 0);
  const pending = myComm.reduce(
    (sum, commission) =>
      sum + Math.max(0, (commission.eligibleAmount || 0) - (commission.paidAmount || 0)),
    0,
  );
  const myPayouts = payouts
    .filter((p) => p.partnerId === partnerId)
    .sort((a, b) => b.requestedDate.localeCompare(a.requestedDate));
  const last = myPayouts[0];
  const unread = announcements.filter(
    (a) => isAnnouncementTargeted(a, partner) && !a.readBy.includes(partnerId),
  ).length;
  const myLeadIds = new Set(myLeads.map((l) => l.id));
  const myActivity = activity
    .filter((a) => a.leadId && myLeadIds.has(a.leadId) && !a.private)
    .slice(0, 6);

  return (
    <>
      <PageHeader
        title="My Dashboard"
        description="Your performance, pipeline, and earnings at a glance."
        actions={
          <>
            <Link to="/submit-lead">
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Submit Lead
              </Button>
            </Link>
            <Link to="/leads">
              <Button variant="outline">View My Leads</Button>
            </Link>
            <PartnerPayoutRequestButton variant="outline" />
          </>
        }
      />
      <PageContainer>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Total Leads Submitted"
            value={myLeads.length}
            icon={FileText}
            accent="bg-info/10 text-info"
          />
          <Stat
            label="Active Leads"
            value={active}
            icon={TrendingUp}
            hint={`${won} won · ${lost} lost`}
            accent="bg-brand/10 text-brand"
          />
          <Stat
            label="Pipeline Value"
            value={fmtCurrency(pipeline)}
            icon={ArrowUpRight}
            accent="bg-success/10 text-success"
          />
          <Stat
            label="Triggered Commissions"
            value={fmtCurrency(earned)}
            icon={DollarSign}
            hint={`${fmtCurrency(pending)} pending payout`}
            accent="bg-warning/15 text-warning-foreground"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 p-5 shadow-card">
            <h3 className="mb-3 font-semibold">Recent activity on my leads</h3>
            {myActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {myActivity.map((a) => (
                  <li key={a.id} className="text-sm">
                    <div>{a.text}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {a.user} - {new Date(a.date).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5 shadow-card">
            <h3 className="mb-3 font-semibold">Latest payout</h3>
            {last ? (
              <div className="space-y-2 text-sm">
                <div className="text-xl font-semibold">{fmtCurrency(last.amount)}</div>
                <StatusBadge status={last.status} />
                <div className="text-xs text-muted-foreground">
                  Requested {new Date(last.requestedDate).toLocaleDateString()}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No payout requests yet.</p>
            )}
            <div className="mt-4 border-t pt-3">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Unread announcements
              </div>
              <div className="mt-1 text-2xl font-semibold">{unread}</div>
              <Link
                to="/announcements"
                className="mt-1 inline-block text-xs text-brand hover:underline"
              >
                Read now →
              </Link>
            </div>
          </Card>
        </div>
      </PageContainer>
    </>
  );
}

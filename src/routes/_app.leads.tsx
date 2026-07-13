import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Download, KanbanSquare, List, PlusCircle, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ReasonDialog } from "@/components/common/dialogs";
import { PageContainer, PageHeader, StatusBadge } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { daysSince, fmtCurrency, type Lead, type LeadStage } from "@/lib/domain";
import { canMoveLeadStage, LEAD_STAGES } from "@/lib/program";
import { useStore } from "@/lib/store";

interface LeadSearch {
  q?: string;
  stage?: string;
  partner?: string;
}

export const Route = createFileRoute("/_app/leads")({
  validateSearch: (search: Record<string, unknown>): LeadSearch => ({
    q: typeof search.q === "string" ? search.q : undefined,
    stage: typeof search.stage === "string" ? search.stage : undefined,
    partner: typeof search.partner === "string" ? search.partner : undefined,
  }),
  component: LeadsPage,
});

function LeadsPage() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { leads, partners, updateLeadStage, deleteLead } = useStore();
  const initial = Route.useSearch();
  const [q, setQ] = useState(initial.q || "");
  const [stage, setStage] = useState(initial.stage || "All");
  const [partner, setPartner] = useState(initial.partner || "All");
  const [view, setView] = useState<"table" | "kanban">("table");
  const [pendingMove, setPendingMove] = useState<{ lead: Lead; stage: LeadStage } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const isPartner = user?.role === "partner";

  useEffect(() => {
    if (initial.q !== undefined) setQ(initial.q);
  }, [initial.q]);

  const visible = useMemo(() => {
    let list = isPartner ? leads.filter((lead) => lead.partnerId === user?.partnerId) : leads;
    if (q) {
      const query = q.toLowerCase();
      list = list.filter(
        (lead) =>
          lead.company.toLowerCase().includes(query) ||
          lead.contactName.toLowerCase().includes(query) ||
          lead.id.toLowerCase().includes(query),
      );
    }
    if (stage !== "All") list = list.filter((lead) => lead.stage === stage);
    if (partner !== "All") list = list.filter((lead) => lead.partnerId === partner);
    return list;
  }, [isPartner, leads, partner, q, stage, user?.partnerId]);

  if (pathname !== "/leads") return <Outlet />;

  const move = (lead: Lead, targetStage: LeadStage) => {
    if (!user || lead.stage === targetStage) return;
    if (!canMoveLeadStage(user.role, lead.stage, targetStage, lead.previousStage)) {
      toast.error("Your role cannot move this lead to that stage.");
      return;
    }
    if (targetStage === "Closed Lost") {
      setPendingMove({ lead, stage: targetStage });
      return;
    }
    updateLeadStage(lead.id, targetStage, user.name);
    toast.success(`${lead.company} moved to ${targetStage}`);
  };

  const stageControl = (lead: Lead) => (
    <select
      className="h-9 min-w-48 rounded-md border bg-background px-2 text-xs"
      value={lead.stage}
      onChange={(event) => move(lead, event.target.value as LeadStage)}
      aria-label={`Change ${lead.company} stage`}
    >
      {LEAD_STAGES.filter(
        (target) =>
          target === lead.stage ||
          Boolean(user && canMoveLeadStage(user.role, lead.stage, target, lead.previousStage)),
      ).map((target) => (
        <option key={target}>{target}</option>
      ))}
    </select>
  );

  const exportCsv = () => {
    const rows = [
      ["ID", "Company", "Contact", "Country", "Stage", "Value", "Last activity"],
      ...visible.map((lead) => [
        lead.id,
        lead.company,
        lead.contactName,
        lead.country,
        lead.stage,
        String(lead.estimatedValue),
        lead.lastActivity,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "leads.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${visible.length} leads`);
  };

  return (
    <>
      <PageHeader
        title={isPartner ? "My Leads" : "All Leads"}
        description={
          isPartner ? "Manage opportunities you submitted." : "Every program opportunity."
        }
        actions={
          <>
            <div className="inline-flex rounded-md border bg-background p-0.5">
              <Button
                size="sm"
                variant={view === "table" ? "secondary" : "ghost"}
                onClick={() => setView("table")}
              >
                <List className="mr-1 h-4 w-4" /> Table
              </Button>
              <Button
                size="sm"
                variant={view === "kanban" ? "secondary" : "ghost"}
                onClick={() => setView("kanban")}
              >
                <KanbanSquare className="mr-1 h-4 w-4" /> Kanban
              </Button>
            </div>
            {!isPartner && (
              <Button variant="outline" onClick={exportCsv}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            )}
            {isPartner && (
              <Link to="/submit-lead">
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" /> Submit Lead
                </Button>
              </Link>
            )}
          </>
        }
      />
      <PageContainer>
        <Card className="shadow-card">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search company, contact, or ID..."
                className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
              />
            </div>
            <select
              value={stage}
              onChange={(event) => setStage(event.target.value)}
              className="h-9 max-w-full rounded-md border bg-background px-3 text-sm"
            >
              <option>All</option>
              {LEAD_STAGES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            {!isPartner && (
              <select
                value={partner}
                onChange={(event) => setPartner(event.target.value)}
                className="h-9 max-w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="All">All partners</option>
                {partners.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            )}
            <span className="text-xs text-muted-foreground">{visible.length} leads</span>
          </div>

          {view === "table" ? (
            <div className="responsive-table-scroll">
              <table className="min-w-[980px] w-full whitespace-nowrap text-sm">
                <thead className="bg-accent/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Company</th>
                    <th className="px-4 py-3 text-left">Contact</th>
                    <th className="px-4 py-3 text-left">Country</th>
                    {!isPartner && <th className="px-4 py-3 text-left">Partner</th>}
                    <th className="px-4 py-3 text-left">Stage</th>
                    <th className="px-4 py-3 text-right">Value</th>
                    <th className="px-4 py-3 text-left">Last activity</th>
                    {isPartner && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((lead) => (
                    <tr key={lead.id} className="border-t hover:bg-accent/20">
                      <td className="px-4 py-3">
                        <Link
                          to="/leads/$id"
                          params={{ id: lead.id }}
                          className="font-medium hover:underline"
                        >
                          {lead.company}
                        </Link>
                        <div className="text-[11px] text-muted-foreground">{lead.id}</div>
                        {lead.status === "Duplicate Rejected" && (
                          <StatusBadge status={lead.status} />
                        )}
                      </td>
                      <td className="px-4 py-3">{lead.contactName}</td>
                      <td className="px-4 py-3">{lead.country}</td>
                      {!isPartner && (
                        <td className="px-4 py-3">
                          {partners.find((item) => item.id === lead.partnerId)?.name}
                        </td>
                      )}
                      <td className="px-4 py-3">{stageControl(lead)}</td>
                      <td className="px-4 py-3 text-right">
                        {fmtCurrency(lead.estimatedValue, lead.currency)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {daysSince(lead.lastActivity)}d ago
                      </td>
                      {isPartner && (
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Delete lead"
                            onClick={() => setDeleteTarget(lead)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-muted-foreground">
                        No leads match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid auto-cols-[280px] grid-flow-col gap-3 overflow-x-auto p-4">
              {LEAD_STAGES.map((column) => {
                const items = visible.filter(
                  (lead) => lead.stage === column && lead.status !== "Duplicate Rejected",
                );
                return (
                  <section key={column} className="min-h-48 rounded-md bg-accent/30 p-3">
                    <div className="mb-3 text-sm font-semibold">
                      {column}{" "}
                      <span className="text-xs text-muted-foreground">({items.length})</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((lead) => (
                        <Card key={lead.id} className="space-y-3 p-3">
                          <Link
                            to="/leads/$id"
                            params={{ id: lead.id }}
                            className="block font-medium hover:underline"
                          >
                            {lead.company}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {fmtCurrency(lead.estimatedValue, lead.currency)}
                          </div>
                          {stageControl(lead)}
                        </Card>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </Card>
      </PageContainer>

      <ReasonDialog
        open={!!pendingMove}
        onOpenChange={(open) => !open && setPendingMove(null)}
        title="Close lead as lost"
        description="Provide the reason. It will be recorded in the lead timeline."
        confirmLabel="Close Lost"
        onConfirm={(reason) => {
          if (!pendingMove || !user) return;
          updateLeadStage(pendingMove.lead.id, pendingMove.stage, user.name, reason);
          toast.warning(`${pendingMove.lead.company} moved to Closed Lost`);
          setPendingMove(null);
        }}
      />
      <ReasonDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete submitted lead"
        description="This permanently removes the lead and its attachments. Leads with commission records cannot be deleted."
        confirmLabel="Delete lead"
        onConfirm={async () => {
          if (!deleteTarget || !user) return;
          const deleted = await deleteLead(deleteTarget.id, user.name);
          if (deleted) toast.success("Lead deleted");
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { PageHeader, PageContainer, StatusBadge } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { fmtCurrency, daysSince, type LeadStage } from "@/lib/mock-data";
import { FormDialog, ReasonDialog } from "@/components/common/dialogs";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/pipeline")({ component: PipelineKanban });

const STAGES: LeadStage[] = [
  "New Lead",
  "In Conversation",
  "Discovery Call",
  "Proposal Sent",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
];

type PendingMove = { leadId: string; targetStage: LeadStage; beforeId?: string };

function PipelineKanban() {
  const { user } = useAuth();
  const { leads, partners, updateLeadStage, closeLeadWon } = useStore();
  const [dragging, setDragging] = useState<{ id: string; stage: LeadStage } | null>(null);
  const [order, setOrder] = useState<Record<string, string[]>>({});
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [pendingLostMove, setPendingLostMove] = useState<PendingMove | null>(null);
  const [confirmedValue, setConfirmedValue] = useState("");

  const availableLeads = useMemo(
    () =>
      leads.filter(
        (l) => l.status !== "Duplicate Under Review" && l.status !== "Duplicate Rejected",
      ),
    [leads],
  );

  if (user?.role === "partner") return <Navigate to="/access-denied" replace />;

  const orderedItems = (stage: LeadStage) => {
    const items = availableLeads.filter((l) => l.stage === stage);
    const stageOrder = order[stage] || [];
    return [...items].sort((a, b) => {
      const ai = stageOrder.indexOf(a.id);
      const bi = stageOrder.indexOf(b.id);
      return (
        (ai === -1 ? 1000 + items.indexOf(a) : ai) - (bi === -1 ? 1000 + items.indexOf(b) : bi)
      );
    });
  };

  const applyOrder = ({ leadId, targetStage, beforeId }: PendingMove) => {
    setOrder((prev) => {
      const next: Record<string, string[]> = {};
      STAGES.forEach((stage) => {
        next[stage] = (
          prev[stage] || availableLeads.filter((l) => l.stage === stage).map((l) => l.id)
        ).filter((id) => id !== leadId);
      });
      const target = next[targetStage] || [];
      const index = beforeId ? target.indexOf(beforeId) : -1;
      if (index >= 0) target.splice(index, 0, leadId);
      else target.push(leadId);
      next[targetStage] = target;
      return next;
    });
  };

  const requestMove = (move: PendingMove) => {
    if (!dragging || dragging.id === move.beforeId) return;
    const lead = leads.find((l) => l.id === move.leadId);
    if (!lead) return;
    if (move.targetStage === "Closed Won" && lead.stage !== "Closed Won" && !lead.confirmedValue) {
      setPendingMove(move);
      setConfirmedValue(String(lead.estimatedValue));
      return;
    }
    if (move.targetStage === "Closed Lost" && lead.stage !== "Closed Lost") {
      setPendingLostMove(move);
      return;
    }
    applyOrder(move);
    if (lead.stage !== move.targetStage) {
      updateLeadStage(move.leadId, move.targetStage, user!.name);
      toast.success(`${lead.company} moved to ${move.targetStage}`);
    }
  };

  const stageSelect = (leadId: string, targetStage: LeadStage) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === targetStage) return;
    const move = { leadId, targetStage };
    if (targetStage === "Closed Won" && !lead.confirmedValue) {
      setPendingMove(move);
      setConfirmedValue(String(lead.estimatedValue));
      return;
    }
    if (targetStage === "Closed Lost") {
      setPendingLostMove(move);
      return;
    }
    applyOrder(move);
    updateLeadStage(leadId, targetStage, user!.name);
    toast.success(`${lead.company} moved to ${targetStage}`);
  };

  return (
    <>
      <PageHeader
        title="Pipeline Kanban"
        description="Drag cards between columns or reorder them within a stage. Closed Won requires a confirmed deal value."
      />
      <PageContainer>
        <div className="grid auto-cols-[300px] grid-flow-col gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const items = orderedItems(stage);
            const total = items.reduce((s, l) => s + l.estimatedValue, 0);
            const isTarget = dragging && dragging.stage !== stage;
            return (
              <div
                key={stage}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging) requestMove({ leadId: dragging.id, targetStage: stage });
                }}
                className={`rounded-lg bg-accent/40 p-3 transition-colors ${isTarget ? "ring-2 ring-brand/30" : ""}`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{stage}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {items.length} - {fmtCurrency(total)}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {items.map((l) => {
                    const p = partners.find((pp) => pp.id === l.partnerId);
                    const active = dragging?.id === l.id;
                    return (
                      <div
                        key={l.id}
                        draggable
                        onDragStart={(e) => {
                          setDragging({ id: l.id, stage: l.stage });
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", l.id);
                        }}
                        onDragEnd={() => setDragging(null)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (dragging)
                            requestMove({
                              leadId: dragging.id,
                              targetStage: stage,
                              beforeId: l.id,
                            });
                        }}
                        className={`cursor-grab rounded-md border bg-card p-3 text-sm shadow-card transition active:cursor-grabbing ${active ? "opacity-50 ring-2 ring-brand/30" : "hover:border-ring"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to="/leads/$id"
                            params={{ id: l.id }}
                            className="block font-medium hover:underline"
                          >
                            {l.company}
                          </Link>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Drag
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{p?.name}</div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs font-semibold">
                            {fmtCurrency(l.estimatedValue)}
                          </span>
                          <StatusBadge status={l.status} />
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          {daysSince(l.lastActivity)}d ago
                        </div>
                        <select
                          value={l.stage}
                          onChange={(e) => stageSelect(l.id, e.target.value as LeadStage)}
                          className="mt-2 h-7 w-full rounded-md border bg-background px-2 text-[11px]"
                        >
                          {STAGES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                      Drop leads here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </PageContainer>

      <FormDialog
        open={!!pendingMove}
        onOpenChange={(open) => {
          if (!open) setPendingMove(null);
        }}
        title="Confirm Closed Won value"
        submitLabel="Close deal"
        canSubmit={Number(confirmedValue) > 0}
        onSubmit={() => {
          if (!pendingMove) return;
          const lead = leads.find((l) => l.id === pendingMove.leadId);
          closeLeadWon(pendingMove.leadId, Number(confirmedValue), user!.name);
          applyOrder(pendingMove);
          toast.success(`${lead?.company || "Deal"} closed won`);
          setPendingMove(null);
          setConfirmedValue("");
        }}
      >
        <label className="text-xs">
          Confirmed deal value
          <input
            type="number"
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={confirmedValue}
            onChange={(e) => setConfirmedValue(e.target.value)}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          A commission line will be calculated from the partner's current rate and held until client
          payment is logged.
        </p>
      </FormDialog>

      <ReasonDialog
        open={!!pendingLostMove}
        onOpenChange={(open) => {
          if (!open) setPendingLostMove(null);
        }}
        title="Move to Closed Lost"
        description="Provide the reason for marking this opportunity Closed Lost."
        confirmLabel="Move lead"
        onConfirm={(reason) => {
          if (!pendingLostMove) return;
          const lead = leads.find((l) => l.id === pendingLostMove.leadId);
          applyOrder(pendingLostMove);
          updateLeadStage(pendingLostMove.leadId, "Closed Lost", user!.name, reason);
          toast.warning(`${lead?.company || "Lead"} moved to Closed Lost`);
          setPendingLostMove(null);
        }}
      />
    </>
  );
}

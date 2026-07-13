import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, PageContainer, StatusBadge } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { fmtCurrency, type CommissionState } from "@/lib/domain";
import { toast } from "sonner";
import { Download, MoreHorizontal, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { FormDialog, ReasonDialog } from "@/components/common/dialogs";

export const Route = createFileRoute("/_app/commissions")({ component: Commissions });

function Commissions() {
  const { user } = useAuth();
  const {
    commissions,
    leads,
    partners,
    overrideCommissionRate,
    addManualCommission,
    setCommissionState,
    waiveCommission,
    payouts,
    requestPayout,
  } = useStore();
  const isPartner = user?.role === "partner";
  const list = isPartner ? commissions.filter((c) => c.partnerId === user.partnerId) : commissions;
  const earned = list.reduce((s, c) => s + c.amount, 0);
  const pending = list.reduce(
    (sum, commission) =>
      sum + Math.max(0, (commission.eligibleAmount || 0) - (commission.paidAmount || 0)),
    0,
  );
  const paid = list.reduce((sum, commission) => sum + (commission.paidAmount || 0), 0);

  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [newRate, setNewRate] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [waiveId, setWaiveId] = useState<string | null>(null);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [selectedCommissions, setSelectedCommissions] = useState<string[]>([]);
  const [payoutMessage, setPayoutMessage] = useState("");
  const eligible = list.filter(
    (commission) =>
      commission.state === "Unpaid" &&
      (commission.eligibleAmount || 0) - (commission.paidAmount || 0) > 0,
  );
  const payoutHistory = isPartner
    ? payouts.filter((payout) => payout.partnerId === user?.partnerId)
    : [];
  const wonLeads = leads.filter((l) => l.status === "Closed Won" || l.stage === "Closed Won");
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({
    leadId: wonLeads[0]?.id || "",
    kind: "One-off Bonus" as "Monthly Retainer" | "One-off Bonus",
    label: "",
    amount: "",
    rate: "",
    notes: "",
  });

  const exportCsv = () => {
    const rows = [["ID", "Type", "Deal", "Partner", "Rate", "Amount", "State", "Closed", "Notes"]];
    list.forEach((c) => {
      const l = leads.find((x) => x.id === c.leadId);
      const p = partners.find((pp) => pp.id === c.partnerId);
      rows.push([
        c.id,
        c.kind || "Deal",
        c.label || l?.company || "",
        p?.name || "",
        `${c.rate}%`,
        String(c.amount),
        c.state,
        c.closedDate,
        c.notes || "",
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "commissions.csv";
    a.click();
    toast.success(`Exported ${list.length} commissions`);
  };

  return (
    <>
      <PageHeader
        title={isPartner ? "My Commissions" : "Commissions"}
        description={
          isPartner
            ? "Your earnings, deal-by-deal."
            : "All partner commissions across closed deals."
        }
        actions={
          <>
            {!isPartner && (
              <Button onClick={() => setManualOpen(true)} disabled={wonLeads.length === 0}>
                <Plus className="mr-2 h-4 w-4" />
                Add manual line
              </Button>
            )}
            {!isPartner && (
              <Button variant="outline" onClick={exportCsv}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            )}
            {isPartner && (
              <Button onClick={() => setPayoutOpen(true)} disabled={eligible.length === 0}>
                Request Payout
              </Button>
            )}
          </>
        }
      />
      <PageContainer>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <div className="text-xs uppercase text-muted-foreground">Total earned</div>
            <div className="mt-1 text-2xl font-semibold">{fmtCurrency(earned)}</div>
          </Card>
          <Card className="p-5">
            <div className="text-xs uppercase text-muted-foreground">Pending payout</div>
            <div className="mt-1 text-2xl font-semibold">{fmtCurrency(pending)}</div>
          </Card>
          <Card className="p-5">
            <div className="text-xs uppercase text-muted-foreground">Paid</div>
            <div className="mt-1 text-2xl font-semibold">{fmtCurrency(paid)}</div>
          </Card>
        </div>

        <Card className="shadow-card overflow-hidden">
          <div className="responsive-table-scroll">
            <table className="min-w-[980px] w-full whitespace-nowrap text-sm">
              <thead className="bg-accent/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Deal</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  {!isPartner && <th className="px-4 py-3 text-left">Partner</th>}
                  <th className="px-4 py-3 text-left">Closed</th>
                  <th className="px-4 py-3 text-right">Rate</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Payable</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-left">State</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const lead = leads.find((l) => l.id === c.leadId);
                  const partner = partners.find((p) => p.id === c.partnerId);
                  return (
                    <tr key={c.id} className="border-t hover:bg-accent/20">
                      <td className="px-4 py-3">
                        <Link
                          to="/leads/$id"
                          params={{ id: c.leadId }}
                          className="font-medium hover:underline"
                        >
                          {c.label || lead?.company || c.leadId}
                        </Link>
                        {c.notes && (
                          <div className="text-[11px] text-muted-foreground">{c.notes}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {c.kind || "Deal"}
                      </td>
                      {!isPartner && <td className="px-4 py-3">{partner?.name}</td>}
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(c.closedDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">{c.rate}%</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {fmtCurrency(c.amount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {fmtCurrency(Math.max(0, (c.eligibleAmount || 0) - (c.paidAmount || 0)))}
                      </td>
                      <td className="px-4 py-3 text-right">{fmtCurrency(c.paidAmount || 0)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.state} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!isPartner && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setOverrideId(c.id);
                                  setNewRate(String(c.rate));
                                }}
                              >
                                Override rate
                              </DropdownMenuItem>
                            )}
                            {!isPartner && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setCommissionState(
                                      c.id,
                                      "On Hold" as CommissionState,
                                      user!.name,
                                    );
                                    toast.warning("Commission put on hold");
                                  }}
                                >
                                  Put on hold
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setWaiveId(c.id)}>
                                  Waive
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setCommissionState(
                                      c.id,
                                      "Approved" as CommissionState,
                                      user!.name,
                                    );
                                    toast.success("Commission approved");
                                  }}
                                >
                                  Approve
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem asChild>
                              <Link to="/leads/$id" params={{ id: c.leadId }}>
                                View deal
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
                {list.length === 0 && (
                  <tr>
                    <td
                      colSpan={isPartner ? 7 : 8}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No commissions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {isPartner && (
          <Card className="shadow-card overflow-hidden">
            <div className="border-b bg-accent/40 px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Payout history
            </div>
            <div className="responsive-table-scroll">
              <table className="min-w-[700px] w-full whitespace-nowrap text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left">Request</th>
                    <th className="px-4 py-3 text-left">Requested</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Payment reference / reason</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutHistory.map((payout) => (
                    <tr key={payout.id} className="border-t">
                      <td className="px-4 py-3 font-medium">{payout.id}</td>
                      <td className="px-4 py-3">
                        {new Date(payout.requestedDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">{fmtCurrency(payout.amount)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={payout.status} />
                      </td>
                      <td className="px-4 py-3">
                        {payout.reference || payout.rejectReason || "—"}
                      </td>
                    </tr>
                  ))}
                  {payoutHistory.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No payout requests yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </PageContainer>

      <FormDialog
        open={!!overrideId}
        onOpenChange={(b) => {
          if (!b) {
            setOverrideId(null);
            setOverrideReason("");
          }
        }}
        title={`Override rate · ${overrideId || ""}`}
        canSubmit={!!newRate && !isNaN(Number(newRate)) && !!overrideReason.trim()}
        submitLabel="Save override"
        onSubmit={() => {
          overrideCommissionRate(overrideId!, Number(newRate), user!.name, overrideReason.trim());
          toast.success(`Rate updated to ${newRate}%`);
          setOverrideId(null);
          setOverrideReason("");
        }}
      >
        <label className="text-xs">
          New commission rate (%)
          <input
            type="number"
            step="0.5"
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={newRate}
            onChange={(e) => setNewRate(e.target.value)}
          />
        </label>
        <label className="text-xs">
          Reason
          <textarea
            rows={3}
            className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="Explain the business reason for this override"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          The amount will recalculate against the deal's confirmed/estimated value.
        </p>
      </FormDialog>

      <FormDialog
        open={manualOpen}
        onOpenChange={(open) => {
          setManualOpen(open);
          if (!open)
            setManual({
              leadId: wonLeads[0]?.id || "",
              kind: "One-off Bonus",
              label: "",
              amount: "",
              rate: "",
              notes: "",
            });
        }}
        title="Add manual commission line"
        submitLabel="Add line"
        canSubmit={!!manual.leadId && !!manual.label.trim() && Number(manual.amount) > 0}
        onSubmit={() => {
          const lead = leads.find((l) => l.id === manual.leadId);
          if (!lead) return;
          addManualCommission(
            {
              leadId: manual.leadId,
              partnerId: lead.partnerId,
              kind: manual.kind,
              label: manual.label.trim(),
              amount: Number(manual.amount),
              rate: manual.rate ? Number(manual.rate) : undefined,
              notes: manual.notes.trim(),
            },
            user!.name,
          );
          toast.success("Manual commission line added");
          setManualOpen(false);
        }}
      >
        <label className="text-xs">
          Deal
          <select
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={manual.leadId}
            onChange={(e) => setManual({ ...manual, leadId: e.target.value })}
          >
            {wonLeads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.company}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Line type
          <select
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={manual.kind}
            onChange={(e) =>
              setManual({
                ...manual,
                kind: e.target.value as "Monthly Retainer" | "One-off Bonus",
              })
            }
          >
            <option>One-off Bonus</option>
            <option>Monthly Retainer</option>
          </select>
        </label>
        <label className="text-xs">
          Label
          <input
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={manual.label}
            onChange={(e) => setManual({ ...manual, label: e.target.value })}
            placeholder="Q3 velocity bonus or July retainer"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            Amount
            <input
              type="number"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={manual.amount}
              onChange={(e) => setManual({ ...manual, amount: e.target.value })}
            />
          </label>
          <label className="text-xs">
            Rate override (%)
            <input
              type="number"
              step="0.5"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={manual.rate}
              onChange={(e) => setManual({ ...manual, rate: e.target.value })}
            />
          </label>
        </div>
        <label className="text-xs">
          Notes
          <textarea
            rows={2}
            className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
            value={manual.notes}
            onChange={(e) => setManual({ ...manual, notes: e.target.value })}
          />
        </label>
      </FormDialog>

      <ReasonDialog
        open={!!waiveId}
        onOpenChange={(b) => !b && setWaiveId(null)}
        title="Waive commission"
        description="Explain why this commission is being waived. This is recorded in the audit trail."
        confirmLabel="Waive commission"
        placeholder="Reason for waiver..."
        onConfirm={(reason) => {
          waiveCommission(waiveId!, user!.name, reason);
          toast.warning("Commission waived");
          setWaiveId(null);
        }}
      />

      <FormDialog
        open={payoutOpen}
        onOpenChange={setPayoutOpen}
        title="Request payout"
        submitLabel="Submit request"
        canSubmit={selectedCommissions.length > 0}
        onSubmit={() => {
          requestPayout(user!.partnerId!, selectedCommissions, payoutMessage.trim(), user!.name);
          toast.success("Payout request submitted");
          setPayoutOpen(false);
          setSelectedCommissions([]);
          setPayoutMessage("");
        }}
      >
        <div className="space-y-2">
          {eligible.map((commission) => {
            const lead = leads.find((item) => item.id === commission.leadId);
            const balance = (commission.eligibleAmount || 0) - (commission.paidAmount || 0);
            return (
              <label
                key={commission.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedCommissions.includes(commission.id)}
                    onChange={(event) =>
                      setSelectedCommissions((current) =>
                        event.target.checked
                          ? [...current, commission.id]
                          : current.filter((id) => id !== commission.id),
                      )
                    }
                  />
                  {lead?.company || commission.id}
                </span>
                <strong>{fmtCurrency(balance)}</strong>
              </label>
            );
          })}
        </div>
        <label className="text-xs">
          Message (optional)
          <textarea
            rows={3}
            className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
            value={payoutMessage}
            onChange={(event) => setPayoutMessage(event.target.value)}
          />
        </label>
      </FormDialog>
    </>
  );
}

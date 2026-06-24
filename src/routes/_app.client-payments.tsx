import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PageHeader, PageContainer } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { fmtCurrency } from "@/lib/mock-data";
import { toast } from "sonner";
import { useState } from "react";
import { Plus } from "lucide-react";
import { FormDialog } from "@/components/common/dialogs";

export const Route = createFileRoute("/_app/client-payments")({ component: ClientPayments });

function ClientPayments() {
  const { user } = useAuth();
  const { leads, clientPayments, recordClientPayment } = useStore();
  const wonLeads = leads.filter((l) => l.stage === "Closed Won");
  const [open, setOpen] = useState(false);
  const empty = {
    leadId: wonLeads[0]?.id || "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    reference: "",
    method: "Wire Transfer",
    notes: "",
    triggerEligibility: false,
  };
  const [form, setForm] = useState(empty);
  if (user?.role === "partner") return <Navigate to="/access-denied" />;

  return (
    <>
      <PageHeader
        title="Client Payments"
        description="Record payments received from clients against won deals. Eligibility must be triggered explicitly."
        actions={
          <Button onClick={() => setOpen(true)} disabled={wonLeads.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Record payment
          </Button>
        }
      />
      <PageContainer>
        <Card className="shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-accent/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Reference</th>
                <th className="px-4 py-3 text-left">Deal</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Method</th>
                <th className="px-4 py-3 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {clientPayments.map((cp) => {
                const lead = leads.find((l) => l.id === cp.leadId);
                return (
                  <tr key={cp.id} className="border-t hover:bg-accent/20">
                    <td className="px-4 py-3 font-medium">{cp.reference}</td>
                    <td className="px-4 py-3">{lead?.company || cp.leadId}</td>
                    <td className="px-4 py-3 text-xs">{new Date(cp.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmtCurrency(cp.amount)}</td>
                    <td className="px-4 py-3">{cp.method}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{cp.notes}</td>
                  </tr>
                );
              })}
              {clientPayments.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground">
                    No client payments recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <Card className="p-4 text-xs text-muted-foreground">
          Installment example: large deals can have multiple records — each row represents one
          installment received. Sales Partners do not see this view.
        </Card>
      </PageContainer>

      <FormDialog
        open={open}
        onOpenChange={(b) => {
          setOpen(b);
          if (!b) setForm(empty);
        }}
        title="Record client payment"
        submitLabel="Record payment"
        canSubmit={
          !!form.leadId &&
          !!form.amount &&
          !isNaN(Number(form.amount)) &&
          !!form.reference.trim() &&
          !!form.date
        }
        onSubmit={() => {
          recordClientPayment(
            {
              leadId: form.leadId,
              amount: Number(form.amount),
              date: form.date,
              reference: form.reference,
              method: form.method,
              notes: form.notes,
              triggerEligibility: form.triggerEligibility,
            },
            user!.name,
          );
          toast.success(
            form.triggerEligibility
              ? "Payment recorded and commission eligibility triggered."
              : "Payment recorded without changing commission eligibility.",
          );
          setOpen(false);
          setForm(empty);
        }}
      >
        <label className="text-xs">
          Deal
          <select
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.leadId}
            onChange={(e) => setForm({ ...form, leadId: e.target.value })}
          >
            {wonLeads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.company}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            Amount
            <input
              type="number"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </label>
          <label className="text-xs">
            Date
            <input
              type="date"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </label>
        </div>
        <label className="text-xs">
          Reference
          <input
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            placeholder="INV-…"
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
          />
        </label>
        <label className="text-xs">
          Method
          <select
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.method}
            onChange={(e) => setForm({ ...form, method: e.target.value })}
          >
            <option>Wire Transfer</option>
            <option>ACH</option>
            <option>Credit Card</option>
            <option>Cheque</option>
          </select>
        </label>
        <label className="text-xs">
          Notes (optional)
          <textarea
            rows={2}
            className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </label>
        <label className="flex items-start gap-2 rounded-md border bg-accent/20 p-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.triggerEligibility}
            onChange={(e) => setForm({ ...form, triggerEligibility: e.target.checked })}
          />
          <span>
            <span className="font-medium">Trigger commission eligibility</span>
            <span className="block text-xs text-muted-foreground">
              Leave unchecked to record this payment without making commissions payable.
            </span>
          </span>
        </label>
      </FormDialog>
    </>
  );
}

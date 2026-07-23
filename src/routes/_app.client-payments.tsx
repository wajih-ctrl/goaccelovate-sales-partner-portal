import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PageHeader, PageContainer } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { fmtCurrency } from "@/lib/domain";
import { toast } from "sonner";
import { useState } from "react";
import { Download, FileUp, Plus } from "lucide-react";
import { FormDialog } from "@/components/common/dialogs";
import { canRecordClientPayment } from "@/lib/program";

export const Route = createFileRoute("/_app/client-payments")({ component: ClientPayments });

function ClientPayments() {
  const { user } = useAuth();
  const { leads, clientPayments, recordClientPayment, downloadStoredFile } = useStore();
  const availablePaymentTypes = (leadId: string) => {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead) return [];
    const currentCycle = lead.paymentCycle || 0;
    const recordedTypes = new Set(
      clientPayments
        .filter(
          (payment) => payment.leadId === lead.id && (payment.paymentCycle || 0) === currentCycle,
        )
        .map((payment) => payment.paymentType),
    );
    return (["Advance", "Final"] as const).filter(
      (paymentType) =>
        canRecordClientPayment(paymentType, lead.stage) && !recordedTypes.has(paymentType),
    );
  };
  const eligibleLeads = leads.filter((lead) => availablePaymentTypes(lead.id).length > 0);
  const paymentSummaryLeads = leads.filter(
    (lead) =>
      canRecordClientPayment("Advance", lead.stage) ||
      canRecordClientPayment("Final", lead.stage) ||
      clientPayments.some((payment) => payment.leadId === lead.id),
  );
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const emptyForm = () => {
    const leadId = eligibleLeads[0]?.id || "";
    return {
      leadId,
      paymentType: (availablePaymentTypes(leadId)[0] || "Advance") as "Advance" | "Final",
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 5),
      reference: "",
      method: "Wire Transfer",
      notes: "",
      receiptFile: null as File | null,
    };
  };
  const [form, setForm] = useState(() => emptyForm());
  const selectedPaymentTypes = availablePaymentTypes(form.leadId);
  if (user?.role === "partner") return <Navigate to="/access-denied" />;

  return (
    <>
      <PageHeader
        title="Client Payments"
        description="Record confirmed advance and final payments against pipeline deals."
        actions={
          <Button
            onClick={() => {
              setForm(emptyForm());
              setOpen(true);
            }}
            disabled={eligibleLeads.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" />
            Record payment
          </Button>
        }
      />
      <PageContainer>
        <Card className="shadow-card overflow-hidden">
          <div className="border-b bg-accent/40 px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Deal payment summary
          </div>
          <div className="responsive-table-scroll">
            <table className="min-w-[760px] w-full whitespace-nowrap text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left">Deal</th>
                  <th className="px-4 py-3 text-right">Advance</th>
                  <th className="px-4 py-3 text-right">Final</th>
                  <th className="px-4 py-3 text-right">Total received</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {paymentSummaryLeads.map((lead) => {
                  const payments = clientPayments.filter((payment) => payment.leadId === lead.id);
                  const advance = payments
                    .filter((payment) => payment.paymentType === "Advance")
                    .reduce((sum, payment) => sum + payment.amount, 0);
                  const final = payments
                    .filter((payment) => payment.paymentType === "Final")
                    .reduce((sum, payment) => sum + payment.amount, 0);
                  const total = advance + final;
                  return (
                    <tr key={lead.id} className="border-t">
                      <td className="px-4 py-3 font-medium">{lead.company}</td>
                      <td className="px-4 py-3 text-right">
                        {fmtCurrency(advance, lead.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">{fmtCurrency(final, lead.currency)}</td>
                      <td className="px-4 py-3 text-right">{fmtCurrency(total, lead.currency)}</td>
                      <td className="px-4 py-3 text-right">
                        {fmtCurrency(
                          Math.max(0, (lead.confirmedValue || lead.estimatedValue) - total),
                          lead.currency,
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="shadow-card overflow-hidden">
          <div className="responsive-table-scroll">
            <table className="min-w-[1160px] w-full whitespace-nowrap text-sm">
              <thead className="bg-accent/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Reference</th>
                  <th className="px-4 py-3 text-left">Deal</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Method</th>
                  <th className="px-4 py-3 text-left">Receipt</th>
                  <th className="px-4 py-3 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {clientPayments.map((cp) => {
                  const lead = leads.find((l) => l.id === cp.leadId);
                  return (
                    <tr key={cp.id} className="border-t hover:bg-accent/20">
                      <td className="px-4 py-3 font-medium">{cp.reference}</td>
                      <td className="px-4 py-3">{lead?.company || "Archived lead"}</td>
                      <td className="px-4 py-3 text-xs">
                        {new Date(cp.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-xs">{cp.time || "—"}</td>
                      <td className="px-4 py-3">{cp.paymentType || "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {fmtCurrency(cp.amount, lead?.currency)}
                      </td>
                      <td className="px-4 py-3">{cp.method}</td>
                      <td className="px-4 py-3">
                        {cp.receiptBucket && cp.receiptPath && cp.receiptName ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              downloadStoredFile(
                                cp.receiptBucket!,
                                cp.receiptPath!,
                                cp.receiptName!,
                              )
                            }
                          >
                            <Download className="mr-1 h-3.5 w-3.5" />
                            Receipt
                          </Button>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{cp.notes}</td>
                    </tr>
                  );
                })}
                {clientPayments.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-muted-foreground">
                      No client payments recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
          if (!b) setForm(emptyForm());
        }}
        title="Record client payment"
        submitLabel="Record payment"
        canSubmit={
          !saving &&
          !!form.leadId &&
          !!form.amount &&
          !isNaN(Number(form.amount)) &&
          Number(form.amount) > 0 &&
          !!form.reference.trim() &&
          !!form.method.trim() &&
          !!form.date &&
          !!form.time &&
          selectedPaymentTypes.includes(form.paymentType)
        }
        onSubmit={async () => {
          setSaving(true);
          const saved = await recordClientPayment(
            {
              leadId: form.leadId,
              amount: Number(form.amount),
              date: form.date,
              time: form.time,
              reference: form.reference,
              method: form.method,
              notes: form.notes,
              paymentType: form.paymentType,
              receiptFile: form.receiptFile || undefined,
            },
            user!.name,
          );
          setSaving(false);
          if (!saved) return;
          toast.success(
            `${form.paymentType} payment recorded and commission eligibility triggered.`,
          );
          setOpen(false);
          setForm(emptyForm());
        }}
      >
        <label className="text-xs">
          Deal
          <select
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.leadId}
            onChange={(event) => {
              const leadId = event.target.value;
              const paymentTypes = availablePaymentTypes(leadId);
              setForm({
                ...form,
                leadId,
                paymentType: paymentTypes.includes(form.paymentType)
                  ? form.paymentType
                  : paymentTypes[0] || "Advance",
              });
            }}
          >
            {eligibleLeads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.company}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Payment type
          <select
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.paymentType}
            onChange={(event) => {
              const paymentType = event.target.value as "Advance" | "Final";
              setForm({ ...form, paymentType });
            }}
          >
            {selectedPaymentTypes.map((paymentType) => (
              <option key={paymentType}>{paymentType}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-xs">
            Amount
            <input
              type="number"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="e.g. 5000.00"
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
          <label className="text-xs">
            Time received
            <input
              type="time"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
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
            placeholder="Optional internal context for this payment"
          />
        </label>
        <label className="block text-xs">
          Payment receipt (optional)
          <span className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-dashed bg-background px-3 py-2 text-sm">
            <FileUp className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              {form.receiptFile?.name || "Upload PDF, PNG, or JPG (max 10MB)"}
            </span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              onChange={(event) =>
                setForm({ ...form, receiptFile: event.target.files?.[0] || null })
              }
            />
          </span>
        </label>
        <div className="rounded-md border bg-accent/20 p-3 text-xs text-muted-foreground">
          {saving
            ? "Recording payment and calculating the payable commission..."
            : "An advance releases commission on the advance received. A final payment releases the remaining commission."}
        </div>
      </FormDialog>
    </>
  );
}

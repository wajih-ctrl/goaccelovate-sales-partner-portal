import { useState } from "react";
import { Banknote, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { FormDialog } from "@/components/common/dialogs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fmtCurrency, type Lead } from "@/lib/domain";
import { canRecordClientPayment } from "@/lib/program";
import { useStore } from "@/lib/store";

type PaymentType = "Advance" | "Final";

function newPaymentForm() {
  return {
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    reference: "",
  };
}

export function DealPaymentPanel({ lead, actor }: { lead: Lead; actor: string }) {
  const { clientPayments, commissions, recordClientPayment } = useStore();
  const [paymentType, setPaymentType] = useState<PaymentType | null>(null);
  const [form, setForm] = useState(newPaymentForm);
  const payments = clientPayments.filter((payment) => payment.leadId === lead.id);
  const advance = payments
    .filter((payment) => payment.paymentType === "Advance")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const final = payments
    .filter((payment) => payment.paymentType === "Final")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const total = advance + final;
  const dealValue = lead.confirmedValue || lead.estimatedValue;
  const outstanding = Math.max(0, dealValue - total);
  const commission = commissions.find(
    (item) => item.leadId === lead.id && (!item.kind || item.kind === "Deal"),
  );
  const payable = Math.max(0, (commission?.eligibleAmount || 0) - (commission?.paidAmount || 0));
  const currentCyclePayments = payments.filter(
    (payment) => (payment.paymentCycle || 0) === (lead.paymentCycle || 0),
  );
  const advanceRecorded = currentCyclePayments.some((payment) => payment.paymentType === "Advance");
  const finalRecorded = currentCyclePayments.some((payment) => payment.paymentType === "Final");
  const advanceAllowed = canRecordClientPayment("Advance", lead.stage) && !advanceRecorded;
  const finalAllowed = canRecordClientPayment("Final", lead.stage) && !finalRecorded;

  const openPayment = (type: PaymentType) => {
    setPaymentType(type);
    setForm({
      ...newPaymentForm(),
      amount: type === "Final" && outstanding > 0 ? String(outstanding) : "",
    });
  };

  return (
    <>
      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-semibold">Deal payment summary</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Client payments are private to Admin and release commission by milestone.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(advanceAllowed || advanceRecorded) && (
              <Button
                size="sm"
                variant="outline"
                disabled={!advanceAllowed}
                onClick={() => openPayment("Advance")}
              >
                <Banknote className="mr-2 h-4 w-4" />
                {advanceRecorded ? "Advance recorded" : "Record advance"}
              </Button>
            )}
            <Button size="sm" disabled={!finalAllowed} onClick={() => openPayment("Final")}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {finalRecorded ? "Final recorded" : "Record final"}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            ["Advance received", advance],
            ["Final received", final],
            ["Total received", total],
            ["Outstanding", outstanding],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-md border bg-accent/20 p-3">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="mt-1 font-semibold">{fmtCurrency(Number(value), lead.currency)}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-1 border-t pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            {finalRecorded
              ? "Advance and final payments have been recorded for this payment cycle."
              : advanceRecorded
                ? "Advance payment recorded. Final payment unlocks at Final Payment Clearance."
                : finalAllowed
                  ? "Record the final payment for this payment cycle."
                  : advanceAllowed
                    ? "Advance payment is available. Final payment unlocks at Final Payment Clearance."
                    : "Advance payment unlocks when the deal reaches Advance Confirmed."}
          </span>
          <span className="font-medium text-foreground">
            Partner commission payable now: {fmtCurrency(payable)}
          </span>
        </div>

        {payments.length > 0 && (
          <div className="responsive-table-scroll mt-4">
            <table className="min-w-[620px] w-full whitespace-nowrap text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Reference</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b last:border-0">
                    <td className="py-2">{payment.paymentType}</td>
                    <td className="px-3 py-2">{new Date(payment.date).toLocaleDateString()}</td>
                    <td className="px-3 py-2">{payment.reference}</td>
                    <td className="py-2 text-right font-medium">
                      {fmtCurrency(payment.amount, lead.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <FormDialog
        open={!!paymentType}
        onOpenChange={(open) => {
          if (!open) setPaymentType(null);
        }}
        title={`Record ${paymentType?.toLowerCase() || "client"} payment`}
        description={`${lead.company} - ${lead.stage}`}
        submitLabel="Record payment"
        canSubmit={Number(form.amount) > 0 && Boolean(form.date) && Boolean(form.reference.trim())}
        onSubmit={async () => {
          if (!paymentType) return;
          const saved = await recordClientPayment(
            {
              leadId: lead.id,
              paymentType,
              amount: Number(form.amount),
              date: form.date,
              reference: form.reference.trim(),
              method: "Not specified",
              notes: "",
            },
            actor,
          );
          if (!saved) return;
          toast.success(`${paymentType} payment recorded. The related commission is now payable.`);
          setPaymentType(null);
          setForm(newPaymentForm());
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs">
            Amount ({lead.currency})
            <input
              type="number"
              min="0.01"
              step="0.01"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              placeholder="e.g. 5000.00"
            />
          </label>
          <label className="text-xs">
            Date received
            <input
              type="date"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />
          </label>
        </div>
        <label className="text-xs">
          Payment reference
          <input
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.reference}
            onChange={(event) => setForm({ ...form, reference: event.target.value })}
            placeholder="Invoice or bank reference"
          />
        </label>
        <div className="rounded-md border bg-accent/20 p-3 text-xs text-muted-foreground">
          {paymentType === "Advance"
            ? "Recording this advance releases commission on the amount received."
            : "Recording the final payment releases the remaining commission for payout."}
        </div>
      </FormDialog>
    </>
  );
}

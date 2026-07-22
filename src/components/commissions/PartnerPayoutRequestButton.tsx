import { useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

import { FormDialog } from "@/components/common/dialogs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { fmtCurrency } from "@/lib/domain";
import { useStore } from "@/lib/store";

type Props = {
  variant?: "default" | "outline" | "ghost";
  label?: string;
  className?: string;
};

export function PartnerPayoutRequestButton({
  variant = "default",
  label = "Request Payout",
  className,
}: Props) {
  const { user } = useAuth();
  const { commissions, leads, requestPayout } = useStore();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [requestedAmount, setRequestedAmount] = useState("");
  const [preferredBank, setPreferredBank] = useState("");
  const [preferredMethod, setPreferredMethod] = useState<
    "Bank Transfer" | "ACH Transfer" | "Wire Transfer"
  >("Bank Transfer");
  const [taxLiability, setTaxLiability] = useState<"yes" | "no" | "">("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const eligible = useMemo(
    () =>
      commissions.filter(
        (commission) =>
          user?.role === "partner" &&
          commission.partnerId === user.partnerId &&
          commission.state === "Unpaid" &&
          (commission.eligibleAmount || 0) - (commission.paidAmount || 0) > 0,
      ),
    [commissions, user],
  );
  const selectedAmount = eligible
    .filter((commission) => selected.includes(commission.id))
    .reduce(
      (sum, commission) =>
        sum + Math.max(0, (commission.eligibleAmount || 0) - (commission.paidAmount || 0)),
      0,
    );

  if (user?.role !== "partner" || !user.partnerId) return null;

  const close = () => {
    setOpen(false);
    setSelected([]);
    setRequestedAmount("");
    setPreferredBank("");
    setPreferredMethod("Bank Transfer");
    setTaxLiability("");
    setMessage("");
  };

  return (
    <>
      <Button
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
        disabled={eligible.length === 0}
      >
        <Wallet className="mr-2 h-4 w-4" />
        {label}
      </Button>

      <FormDialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) setOpen(true);
          else close();
        }}
        title="Request commission payout"
        description="Select the triggered commissions to include in this payout request."
        submitLabel={submitting ? "Submitting..." : "Submit payout request"}
        canSubmit={
          !submitting &&
          selected.length > 0 &&
          Number(requestedAmount) > 0 &&
          Number(requestedAmount) <= selectedAmount &&
          Boolean(preferredBank.trim()) &&
          Boolean(taxLiability)
        }
        onSubmit={async () => {
          setSubmitting(true);
          const requested = await requestPayout(
            user.partnerId!,
            selected,
            {
              amount: Number(requestedAmount),
              preferredBank: preferredBank.trim(),
              preferredMethod,
              taxLiability: taxLiability === "yes",
              message: message.trim(),
            },
            user.name,
          );
          setSubmitting(false);
          if (!requested) return;
          toast.success("Payout request submitted for Super Admin review");
          close();
        }}
      >
        <div className="space-y-2">
          {eligible.map((commission) => {
            const lead = leads.find((item) => item.id === commission.leadId);
            const balance = Math.max(
              0,
              (commission.eligibleAmount || 0) - (commission.paidAmount || 0),
            );
            return (
              <label
                key={commission.id}
                className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(commission.id)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, commission.id]
                          : current.filter((id) => id !== commission.id),
                      )
                    }
                  />
                  <span className="truncate">{lead?.company || "Commission"}</span>
                </span>
                <strong className="shrink-0">{fmtCurrency(balance)}</strong>
              </label>
            );
          })}
        </div>
        <div className="flex items-center justify-between rounded-md border bg-accent/20 p-3 text-sm">
          <span className="text-muted-foreground">Available from selection</span>
          <strong>{fmtCurrency(selectedAmount)}</strong>
        </div>
        <label className="text-xs">
          Requested payout amount
          <input
            type="number"
            min="0.01"
            max={selectedAmount || undefined}
            step="0.01"
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={requestedAmount}
            onChange={(event) => setRequestedAmount(event.target.value)}
            placeholder={selectedAmount ? String(selectedAmount) : "0.00"}
          />
        </label>
        <label className="text-xs">
          Preferred bank
          <input
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={preferredBank}
            onChange={(event) => setPreferredBank(event.target.value)}
            placeholder="Bank name"
          />
        </label>
        <label className="text-xs">
          Preferred payment method
          <select
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={preferredMethod}
            onChange={(event) =>
              setPreferredMethod(
                event.target.value as "Bank Transfer" | "ACH Transfer" | "Wire Transfer",
              )
            }
          >
            <option>Bank Transfer</option>
            <option>ACH Transfer</option>
            <option>Wire Transfer</option>
          </select>
        </label>
        <fieldset className="rounded-md border p-3 text-xs">
          <legend className="px-1">Are you liable for taxes on this income in your country?</legend>
          <div className="mt-2 flex gap-5">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="tax-liability"
                checked={taxLiability === "yes"}
                onChange={() => setTaxLiability("yes")}
              />{" "}
              Yes
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="tax-liability"
                checked={taxLiability === "no"}
                onChange={() => setTaxLiability("no")}
              />{" "}
              No
            </label>
          </div>
        </fieldset>
        <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950">
          Your declaration is recorded for Super Admin review. The portal does not calculate or
          withhold taxes automatically; applicable taxes and transfer fees are handled when the
          payment is processed externally.
        </div>
        <label className="text-xs">
          Message (optional)
          <textarea
            rows={3}
            className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Add any information Admin should know"
          />
        </label>
      </FormDialog>
    </>
  );
}

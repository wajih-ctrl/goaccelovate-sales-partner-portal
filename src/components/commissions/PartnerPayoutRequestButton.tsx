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
  const [message, setMessage] = useState("");

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
        submitLabel={`Submit ${fmtCurrency(selectedAmount)} request`}
        canSubmit={selected.length > 0 && selectedAmount > 0}
        onSubmit={async () => {
          const requested = await requestPayout(
            user.partnerId!,
            selected,
            message.trim(),
            user.name,
          );
          if (!requested) return;
          toast.success("Payout request submitted for Admin review");
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
          <span className="text-muted-foreground">Selected payout</span>
          <strong>{fmtCurrency(selectedAmount)}</strong>
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

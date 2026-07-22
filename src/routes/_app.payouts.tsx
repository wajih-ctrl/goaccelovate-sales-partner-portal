import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageContainer, StatusBadge } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { fmtCurrency } from "@/lib/domain";
import { toast } from "sonner";
import { useState } from "react";
import { ReasonDialog, FormDialog } from "@/components/common/dialogs";

export const Route = createFileRoute("/_app/payouts")({ component: Payouts });

function Payouts() {
  const { user } = useAuth();
  const {
    payouts,
    partners,
    commissions,
    leads,
    approvePayout,
    rejectPayout,
    recordPayoutPayment,
  } = useStore();
  const isPartner = user?.role === "partner";
  const canReview = user?.role === "super_admin";
  const list = isPartner ? payouts.filter((p) => p.partnerId === user.partnerId) : payouts;

  const [rejectId, setRejectId] = useState<string | null>(null);
  const [payId, setPayId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [pay, setPay] = useState({
    amount: "",
    method: "Bank Transfer",
    reference: "",
    date: new Date().toISOString().slice(0, 10),
  });

  const viewing = viewId ? payouts.find((p) => p.id === viewId) : null;
  const paying = payId ? payouts.find((p) => p.id === payId) : null;

  return (
    <>
      <PageHeader
        title={isPartner ? "Payout History" : "Payout Requests"}
        description={
          isPartner
            ? "Track every payout request and its status."
            : canReview
              ? "Review and process partner payout requests."
              : "View partner payout requests. Super Admin approval is required."
        }
      />
      <PageContainer>
        <Card className="shadow-card overflow-hidden">
          <div className="responsive-table-scroll">
            <table className="min-w-[1260px] w-full whitespace-nowrap text-sm">
              <thead className="bg-accent/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  {!isPartner && <th className="px-4 py-3 text-left">Partner</th>}
                  <th className="px-4 py-3 text-left">Deals</th>
                  <th className="px-4 py-3 text-left">Requested</th>
                  <th className="px-4 py-3 text-left">Payment method</th>
                  <th className="px-4 py-3 text-left">Tax declaration</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Paid</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const partner = partners.find((pp) => pp.id === p.partnerId);
                  return (
                    <tr key={p.id} className="border-t hover:bg-accent/20">
                      {!isPartner && <td className="px-4 py-3">{partner?.name}</td>}
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {p.commissionIds.length} commission(s)
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {new Date(p.requestedDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-xs">{p.preferredMethod || "Not provided"}</td>
                      <td className="px-4 py-3 text-xs">
                        {p.taxLiability == null
                          ? "Not provided"
                          : p.taxLiability
                            ? "Partner liable"
                            : "Not liable"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {fmtCurrency(p.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {p.paidDate ? new Date(p.paidDate).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => setViewId(p.id)}>
                          View
                        </Button>
                        {canReview && p.status === "Pending" && (
                          <>
                            <Button
                              size="sm"
                              disabled={processingId === p.id}
                              onClick={async () => {
                                setProcessingId(p.id);
                                try {
                                  const approved = await approvePayout(p.id, user!.name);
                                  if (approved) toast.success("Payout request approved");
                                } finally {
                                  setProcessingId(null);
                                }
                              }}
                            >
                              {processingId === p.id ? "Approving..." : "Approve"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setRejectId(p.id)}>
                              Reject
                            </Button>
                          </>
                        )}
                        {canReview && p.status === "Approved" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setPayId(p.id);
                              setPay((current) => ({ ...current, amount: String(p.amount) }));
                            }}
                          >
                            Record payment
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {list.length === 0 && (
                  <tr>
                    <td
                      colSpan={isPartner ? 8 : 9}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No payout requests yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="p-4 text-xs text-muted-foreground">
          Note: the portal tracks payout requests, approvals, rejections, and confirmations only. No
          funds move through the system — payments are processed externally.
        </Card>
      </PageContainer>

      <ReasonDialog
        open={!!rejectId}
        onOpenChange={(b) => !b && setRejectId(null)}
        title="Reject payout request"
        description="Provide a reason. The partner will see this explanation."
        confirmLabel="Reject payout"
        onConfirm={async (reason) => {
          const rejected = await rejectPayout(rejectId!, reason, user!.name);
          if (!rejected) return;
          toast.warning("Payout request rejected");
          setRejectId(null);
        }}
      />

      <FormDialog
        open={!!payId}
        onOpenChange={(b) => !b && setPayId(null)}
        title="Record external payout payment"
        description="Enter the payment details after the approved payout has been sent outside the portal."
        canSubmit={Number(pay.amount) > 0 && !!pay.reference.trim() && !!pay.date}
        submitLabel="Record payment"
        onSubmit={async () => {
          const recorded = await recordPayoutPayment(
            payId!,
            { ...pay, amount: Number(pay.amount) },
            user!.name,
          );
          if (!recorded) return;
          toast.success("External payout confirmed");
          setPayId(null);
          setPay({
            amount: "",
            method: "Bank Transfer",
            reference: "",
            date: new Date().toISOString().slice(0, 10),
          });
        }}
      >
        {paying && (
          <div className="rounded-md border bg-accent/30 p-3 text-xs">
            <div className="font-semibold">Partner payout instructions</div>
            <div className="mt-1 text-muted-foreground">
              {paying.preferredBank || "Bank not provided"} /{" "}
              {paying.preferredMethod || "Method not provided"}
            </div>
            <div className="mt-1">
              Tax declaration:{" "}
              {paying.taxLiability == null
                ? "Not provided"
                : paying.taxLiability
                  ? "Partner is liable for local taxes"
                  : "Partner is not liable for local taxes"}
            </div>
            <div className="mt-2 text-muted-foreground">
              The portal records this declaration but does not calculate or withhold tax. Confirm
              any applicable deduction or transfer fee before sending the external payment.
            </div>
          </div>
        )}
        <label className="text-xs">
          Amount paid
          <input
            type="number"
            min="0.01"
            step="0.01"
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={pay.amount}
            onChange={(e) => setPay({ ...pay, amount: e.target.value })}
          />
        </label>
        <label className="text-xs">
          Payment date
          <input
            type="date"
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={pay.date}
            onChange={(e) => setPay({ ...pay, date: e.target.value })}
          />
        </label>
        <label className="text-xs">
          Method
          <select
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={pay.method}
            onChange={(e) => setPay({ ...pay, method: e.target.value })}
          >
            <option>Bank Transfer</option>
            <option>Wire Transfer</option>
            <option>PayPal</option>
            <option>Wise</option>
            <option>Other</option>
          </select>
        </label>
        <label className="text-xs">
          Reference / transaction number
          <input
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={pay.reference}
            onChange={(e) => setPay({ ...pay, reference: e.target.value })}
            placeholder="TXN-…"
          />
        </label>
      </FormDialog>

      <FormDialog
        open={!!viewing}
        onOpenChange={(b) => !b && setViewId(null)}
        title="Payout request details"
        submitLabel="Close"
        onSubmit={() => setViewId(null)}
      >
        {viewing && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Partner</span>
              <span>{partners.find((p) => p.id === viewing.partnerId)?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold">{fmtCurrency(viewing.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={viewing.status} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Requested</span>
              <span>{new Date(viewing.requestedDate).toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Preferred bank</span>
              <span className="text-right">{viewing.preferredBank || "Not provided"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Preferred payment method</span>
              <span className="text-right">{viewing.preferredMethod || "Not provided"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Partner liable for local taxes</span>
              <span>
                {viewing.taxLiability == null
                  ? "Not provided"
                  : viewing.taxLiability
                    ? "Yes"
                    : "No"}
              </span>
            </div>
            {viewing.paidDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span>{new Date(viewing.paidDate).toLocaleDateString()}</span>
              </div>
            )}
            {viewing.method && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method</span>
                <span>{viewing.method}</span>
              </div>
            )}
            {viewing.reference && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reference</span>
                <span className="font-mono text-xs">{viewing.reference}</span>
              </div>
            )}
            {viewing.message && (
              <div>
                <div className="text-muted-foreground">Partner message</div>
                <div className="mt-1 rounded border bg-accent/20 p-2">{viewing.message}</div>
              </div>
            )}
            {viewing.rejectReason && (
              <div>
                <div className="text-muted-foreground">Rejection reason</div>
                <div className="mt-1 rounded border border-destructive/30 bg-destructive/10 p-2">
                  {viewing.rejectReason}
                </div>
              </div>
            )}
            <div className="border-t pt-2">
              <div className="text-muted-foreground">Included commissions</div>
              <ul className="mt-1 space-y-1">
                {viewing.commissionIds.map((cid) => {
                  const c = commissions.find((x) => x.id === cid);
                  const l = c ? leads.find((ll) => ll.id === c.leadId) : null;
                  return (
                    <li
                      key={cid}
                      className="flex justify-between rounded border bg-accent/10 px-2 py-1 text-xs"
                    >
                      <span>{l?.company || "Commission"}</span>
                      <span>{c ? fmtCurrency(c.amount) : ""}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </FormDialog>
    </>
  );
}

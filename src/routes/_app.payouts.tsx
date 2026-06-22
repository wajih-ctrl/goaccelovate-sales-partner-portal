import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageContainer, StatusBadge } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { fmtCurrency } from "@/lib/mock-data";
import { toast } from "sonner";
import { useState } from "react";
import { ReasonDialog, FormDialog } from "@/components/common/dialogs";

export const Route = createFileRoute("/_app/payouts")({ component: Payouts });

function Payouts() {
  const { user } = useAuth();
  const { payouts, partners, commissions, leads, approvePayout, rejectPayout, recordPayoutPayment } = useStore();
  const isPartner = user?.role === "partner";
  const list = isPartner ? payouts.filter(p => p.partnerId === user.partnerId) : payouts;

  const [rejectId, setRejectId] = useState<string | null>(null);
  const [payId, setPayId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [pay, setPay] = useState({ method: "Bank Transfer", reference: "", date: new Date().toISOString().slice(0, 10) });

  const viewing = viewId ? payouts.find(p => p.id === viewId) : null;

  return (
    <>
      <PageHeader
        title={isPartner ? "Payout History" : "Payout Requests"}
        description={isPartner ? "Track every payout request and its status." : "Review and approve partner payout requests."}
      />
      <PageContainer>
        <Card className="shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-accent/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Request ID</th>
                {!isPartner && <th className="px-4 py-3 text-left">Partner</th>}
                <th className="px-4 py-3 text-left">Deals</th>
                <th className="px-4 py-3 text-left">Requested</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Paid</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {list.map(p => {
                const partner = partners.find(pp => pp.id === p.partnerId);
                return (
                  <tr key={p.id} className="border-t hover:bg-accent/20">
                    <td className="px-4 py-3 font-medium">{p.id}</td>
                    {!isPartner && <td className="px-4 py-3">{partner?.name}</td>}
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.commissionIds.length} commission(s)</td>
                    <td className="px-4 py-3 text-xs">{new Date(p.requestedDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmtCurrency(p.amount)}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.paidDate ? new Date(p.paidDate).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => setViewId(p.id)}>View</Button>
                      {!isPartner && p.status === "Pending" && (
                        <>
                          <Button size="sm" onClick={() => { approvePayout(p.id, user!.name); toast.success(`${p.id} approved`); }}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => setRejectId(p.id)}>Reject</Button>
                        </>
                      )}
                      {!isPartner && p.status === "Approved" && (
                        <Button size="sm" onClick={() => setPayId(p.id)}>Mark paid</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={isPartner ? 7 : 8} className="py-10 text-center text-muted-foreground">No payout requests yet.</td></tr>}
            </tbody>
          </table>
        </Card>
        <Card className="p-4 text-xs text-muted-foreground">
          Note: the portal tracks payout requests, approvals, rejections, and confirmations only. No funds move through the system — payments are processed externally.
        </Card>
      </PageContainer>

      <ReasonDialog
        open={!!rejectId}
        onOpenChange={(b) => !b && setRejectId(null)}
        title={`Reject payout ${rejectId || ""}`}
        description="Provide a reason. The partner will see this explanation."
        confirmLabel="Reject payout"
        onConfirm={(reason) => { rejectPayout(rejectId!, reason, user!.name); toast.warning(`${rejectId} rejected`); setRejectId(null); }}
      />

      <FormDialog
        open={!!payId}
        onOpenChange={(b) => !b && setPayId(null)}
        title={`Record payment for ${payId || ""}`}
        canSubmit={!!pay.reference.trim() && !!pay.date}
        submitLabel="Record payment"
        onSubmit={() => {
          recordPayoutPayment(payId!, pay, user!.name);
          toast.success(`${payId} marked as paid`);
          setPayId(null);
          setPay({ method: "Bank Transfer", reference: "", date: new Date().toISOString().slice(0, 10) });
        }}
      >
        <label className="text-xs">Payment date<input type="date" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={pay.date} onChange={e => setPay({ ...pay, date: e.target.value })} /></label>
        <label className="text-xs">Method
          <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={pay.method} onChange={e => setPay({ ...pay, method: e.target.value })}>
            <option>Bank Transfer</option><option>Wire Transfer</option><option>PayPal</option><option>Wise</option><option>Other</option>
          </select>
        </label>
        <label className="text-xs">Reference / transaction number<input className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={pay.reference} onChange={e => setPay({ ...pay, reference: e.target.value })} placeholder="TXN-…" /></label>
      </FormDialog>

      <FormDialog
        open={!!viewing}
        onOpenChange={(b) => !b && setViewId(null)}
        title={`Payout ${viewing?.id || ""}`}
        submitLabel="Close"
        onSubmit={() => setViewId(null)}
      >
        {viewing && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Partner</span><span>{partners.find(p => p.id === viewing.partnerId)?.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold">{fmtCurrency(viewing.amount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusBadge status={viewing.status} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Requested</span><span>{new Date(viewing.requestedDate).toLocaleString()}</span></div>
            {viewing.paidDate && <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span>{new Date(viewing.paidDate).toLocaleDateString()}</span></div>}
            {viewing.method && <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span>{viewing.method}</span></div>}
            {viewing.reference && <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-mono text-xs">{viewing.reference}</span></div>}
            {viewing.message && <div><div className="text-muted-foreground">Partner message</div><div className="mt-1 rounded border bg-accent/20 p-2">{viewing.message}</div></div>}
            {viewing.rejectReason && <div><div className="text-muted-foreground">Rejection reason</div><div className="mt-1 rounded border border-destructive/30 bg-destructive/10 p-2">{viewing.rejectReason}</div></div>}
            <div className="border-t pt-2">
              <div className="text-muted-foreground">Included commissions</div>
              <ul className="mt-1 space-y-1">
                {viewing.commissionIds.map(cid => {
                  const c = commissions.find(x => x.id === cid);
                  const l = c ? leads.find(ll => ll.id === c.leadId) : null;
                  return <li key={cid} className="flex justify-between rounded border bg-accent/10 px-2 py-1 text-xs"><span>{l?.company || cid}</span><span>{c ? fmtCurrency(c.amount) : ""}</span></li>;
                })}
              </ul>
            </div>
          </div>
        )}
      </FormDialog>
    </>
  );
}

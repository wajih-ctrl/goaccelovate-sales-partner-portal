import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { PageHeader, PageContainer, StatusBadge } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { fmtCurrency } from "@/lib/mock-data";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_app/request-payout")({ component: RequestPayout });

function RequestPayout() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { commissions, leads, requestPayout } = useStore();
  if (user?.role !== "partner") return <Navigate to="/access-denied" />;
  const eligible = commissions.filter(c => c.partnerId === user.partnerId && (c.state === "Unpaid" || c.state === "Approved"));
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const total = eligible.filter(c => selected.includes(c.id)).reduce((s, c) => s + c.amount, 0);

  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const selectAll = () => setSelected(eligible.map(c => c.id));

  const submit = () => {
    if (selected.length === 0) { toast.error("Select at least one commission"); return; }
    requestPayout(user.partnerId!, selected, message.trim(), user.name);
    toast.success(`Payout request for ${fmtCurrency(total)} submitted`);
    nav({ to: "/payouts" });
  };

  return (
    <>
      <PageHeader title="Request Payout" description="Select eligible commissions and submit a request." />
      <PageContainer>
        <Card className="p-5 max-w-3xl space-y-4">
          {eligible.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              You have no eligible commissions to request right now.
              <div className="mt-2 text-xs">Commissions become eligible once a deal is Closed Won and not already requested or paid.</div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{eligible.length} eligible commission(s)</div>
                <Button variant="ghost" size="sm" onClick={selectAll}>Select all</Button>
              </div>
              <ul className="space-y-2">
                {eligible.map(c => {
                  const lead = leads.find(l => l.id === c.leadId);
                  return (
                    <li key={c.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                      <label className="flex flex-1 items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                        <div>
                          <div className="font-medium">{lead?.company || c.leadId}</div>
                          <div className="text-xs text-muted-foreground">{c.rate}% · Closed {new Date(c.closedDate).toLocaleDateString()}</div>
                        </div>
                      </label>
                      <div className="text-right">
                        <div className="font-semibold">{fmtCurrency(c.amount)}</div>
                        <StatusBadge status={c.state} />
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div>
                <label className="text-xs uppercase text-muted-foreground">Message (optional)</label>
                <textarea className="mt-1 w-full rounded-md border bg-background p-3 text-sm" rows={3} value={message} onChange={e => setMessage(e.target.value)} placeholder="Any notes for the GoAccelovate team…" />
              </div>
              <div className="flex items-center justify-between border-t pt-4">
                <div><div className="text-xs uppercase text-muted-foreground">Total request</div><div className="text-2xl font-semibold">{fmtCurrency(total)}</div></div>
                <Button disabled={selected.length === 0} onClick={submit}>Submit request</Button>
              </div>
            </>
          )}
        </Card>
      </PageContainer>
    </>
  );
}

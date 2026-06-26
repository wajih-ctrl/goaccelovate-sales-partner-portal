import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageContainer, StatusBadge } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { fmtCurrency } from "@/lib/mock-data";
import { useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Check, X } from "lucide-react";

export const Route = createFileRoute("/_app/disputes")({ component: Disputes });

function Disputes() {
  const { user } = useAuth();
  const { disputes, commissions, leads, partners, replyDispute, resolveDispute } = useStore();
  const isPartner = user?.role === "partner";
  const list = isPartner ? disputes.filter((d) => d.partnerId === user.partnerId) : disputes;
  const [activeId, setActiveId] = useState<string | null>(list[0]?.id || null);
  const [reply, setReply] = useState("");
  const [resolution, setResolution] = useState("");

  const active = list.find((d) => d.id === activeId) || list[0];

  if (list.length === 0) {
    return (
      <>
        <PageHeader
          title="Commission Disputes"
          description={
            isPartner
              ? "Open and track commission disputes."
              : "Review and resolve partner commission disputes."
          }
        />
        <PageContainer>
          <Card className="p-10 text-center text-sm text-muted-foreground">
            No disputes{" "}
            {isPartner ? "yet — open one from your commissions list if needed." : "right now."}
          </Card>
        </PageContainer>
      </>
    );
  }

  const c = active && commissions.find((cc) => cc.id === active.commissionId);
  const l = c && leads.find((ll) => ll.id === c.leadId);
  const partner = active && partners.find((p) => p.id === active.partnerId);

  return (
    <>
      <PageHeader
        title="Commission Disputes"
        description={
          isPartner
            ? "Open and track commission disputes."
            : "Review and resolve partner commission disputes."
        }
      />
      <PageContainer>
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <Card className="overflow-hidden">
            <ul>
              {list.map((d) => {
                const p = partners.find((pp) => pp.id === d.partnerId);
                return (
                  <li key={d.id}>
                    <button
                      onClick={() => setActiveId(d.id)}
                      className={`w-full border-b p-3 text-left text-sm hover:bg-accent/30 ${active?.id === d.id ? "bg-accent/50" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{d.id}</span>
                        <StatusBadge
                          status={
                            d.status === "Under Review"
                              ? "Pending"
                              : d.status === "Open"
                                ? "Disputed"
                                : d.status === "Resolved"
                                  ? "Paid"
                                  : "Rejected"
                          }
                        />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {p?.name} · {d.commissionId}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {active && (
            <Card className="p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {active.id} · {active.commissionId}
                  </h2>
                  <div className="text-xs text-muted-foreground">
                    Opened by {partner?.name} on {new Date(active.openedDate).toLocaleDateString()}
                  </div>
                </div>
                <StatusBadge
                  status={
                    active.status === "Under Review"
                      ? "Pending"
                      : active.status === "Open"
                        ? "Disputed"
                        : active.status === "Resolved"
                          ? "Paid"
                          : "Rejected"
                  }
                />
              </div>

              {c && l && (
                <div className="rounded-md border bg-accent/20 p-3 text-sm grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Deal</div>
                    <div className="font-medium">{l.company}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Amount</div>
                    <div className="font-medium">{fmtCurrency(c.amount)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Rate</div>
                    <div className="font-medium">{c.rate}%</div>
                  </div>
                </div>
              )}

              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <MessageSquare className="h-3 w-3" />
                  Discussion thread
                </div>
                <ul className="space-y-2">
                  {active.thread.map((t) => (
                    <li key={t.id} className="rounded-md border p-3 text-sm">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{t.user}</span>
                        <span>{new Date(t.date).toLocaleString()}</span>
                      </div>
                      <p className="mt-1">{t.text}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {active.status !== "Resolved" && active.status !== "Rejected" && (
                <div className="space-y-2 border-t pt-4">
                  <textarea
                    rows={3}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Reply to this dispute…"
                    className="w-full rounded-md border bg-background p-3 text-sm"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={!reply.trim()}
                      onClick={() => {
                        replyDispute(active.id, reply.trim(), user!.name);
                        setReply("");
                        toast.success("Reply posted");
                      }}
                    >
                      Post reply
                    </Button>
                  </div>

                  {!isPartner && (
                    <div className="rounded-md border border-dashed p-4 space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        Resolve dispute
                      </div>
                      <textarea
                        rows={2}
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        placeholder="Resolution summary…"
                        className="w-full rounded-md border bg-background p-2 text-sm"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!resolution.trim()}
                          onClick={() => {
                            resolveDispute(active.id, resolution.trim(), false, user!.name);
                            setResolution("");
                            toast.warning("Dispute rejected");
                          }}
                        >
                          <X className="mr-1 h-4 w-4" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          disabled={!resolution.trim()}
                          onClick={() => {
                            resolveDispute(active.id, resolution.trim(), true, user!.name);
                            setResolution("");
                            toast.success("Dispute resolved in partner's favour");
                          }}
                        >
                          <Check className="mr-1 h-4 w-4" />
                          Resolve in favour
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {active.resolution && (
                <div className="rounded-md border border-success/30 bg-success/10 p-3 text-sm">
                  <div className="text-xs font-medium text-success">Resolution</div>
                  <p className="mt-1">{active.resolution}</p>
                </div>
              )}
            </Card>
          )}
        </div>
      </PageContainer>
    </>
  );
}

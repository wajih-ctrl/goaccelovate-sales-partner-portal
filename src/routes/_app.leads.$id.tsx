import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { PageHeader, PageContainer, StatusBadge } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { fmtCurrency, type LeadStage, type LeadStatus } from "@/lib/mock-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useState } from "react";
import { ArrowLeft, Lock, MessageSquare, Phone, FileUp, Activity, Check, X } from "lucide-react";
import { FormDialog, ReasonDialog } from "@/components/common/dialogs";

export const Route = createFileRoute("/_app/leads/$id")({ component: LeadDetail });

const STAGES: LeadStage[] = ["New Lead", "In Conversation", "Discovery Call", "Proposal Sent", "Negotiation", "Closed Won", "Closed Lost"];
const STATUSES: LeadStatus[] = ["Active", "On Hold", "Closed Won", "Closed Lost", "Disqualified", "Reopened"];

function LeadDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const store = useStore();
  const lead = store.leads.find(l => l.id === id);
  const [comment, setComment] = useState("");
  const [showCall, setShowCall] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showCloseWon, setShowCloseWon] = useState(false);
  const [confirmedValue, setConfirmedValue] = useState("");
  const [call, setCall] = useState({ date: "", duration: "30", attendees: "", clientAttendees: "", partnerJoined: false, summary: "", outcomes: "", nextSteps: "", followUp: "", attachmentName: "", private: false });

  if (!lead) return <Navigate to="/leads" />;
  if (user?.role === "partner" && lead.partnerId !== user.partnerId) return <Navigate to="/access-denied" />;

  const partner = store.partners.find(p => p.id === lead.partnerId);
  const isPartner = user?.role === "partner";
  const isAdmin = !isPartner;
  const activity = store.activity.filter(a => a.leadId === id && (!a.private || isAdmin));
  const calls = store.calls.filter(c => c.leadId === id && (!c.private || isAdmin));
  const commission = store.commissions.find(c => c.leadId === id);
  const files = store.attachments[id] || [];
  const dup = lead.status === "Duplicate Under Review";

  const post = (priv: boolean) => {
    if (!comment.trim()) { toast.error("Comment cannot be empty"); return; }
    store.addComment(id, comment.trim(), user!.name, priv);
    setComment("");
    toast.success(priv ? "Private note added" : "Comment posted");
  };

  const upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    store.addAttachment(id, f.name, user!.name);
    toast.success(`${f.name} uploaded`);
    e.target.value = "";
  };

  const saveCall = () => {
    if (!call.date || !call.summary.trim()) { toast.error("Date and summary are required"); return; }
    store.addCall({
      leadId: id, date: call.date, duration: Number(call.duration) || 30,
      attendees: call.attendees, clientAttendees: call.clientAttendees,
      partnerJoined: call.partnerJoined, summary: call.summary,
      outcomes: call.outcomes, nextSteps: call.nextSteps,
      followUp: call.followUp, attachmentName: call.attachmentName, private: call.private,
    }, user!.name);
    toast.success("Discovery call logged");
    setShowCall(false);
    setCall({ date: "", duration: "30", attendees: "", clientAttendees: "", partnerJoined: false, summary: "", outcomes: "", nextSteps: "", followUp: "", attachmentName: "", private: false });
  };

  const changeStage = (stage: LeadStage) => {
    if (stage === "Closed Won" && lead.stage !== "Closed Won" && !lead.confirmedValue) {
      setConfirmedValue(String(lead.estimatedValue));
      setShowCloseWon(true);
      return;
    }
    store.updateLeadStage(id, stage, user!.name);
  };

  return (
    <>
      <PageHeader
        title={lead.company}
        description={`${lead.contactName} · ${lead.contactTitle} · ${lead.country} · ${lead.id}`}
        actions={
          <>
            <Link to="/leads"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button></Link>
            {isAdmin && (
              <>
                <select
                  value={lead.stage}
                  onChange={e => changeStage(e.target.value as LeadStage)}
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                  {STAGES.map(s => <option key={s}>{s}</option>)}
                </select>
                <select
                  value={lead.status}
                  onChange={e => store.updateLeadStatus(id, e.target.value as LeadStatus, user!.name)}
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </>
            )}
          </>
        }
      />
      <PageContainer>
        {dup && isAdmin && (
          <Card className="flex flex-wrap items-center justify-between gap-3 border-warning/40 bg-warning/10 p-4 text-sm">
            <div>
              <div className="font-semibold">Duplicate Under Review</div>
              <div className="text-xs text-muted-foreground">A potential match exists. Accept into pipeline or reject as duplicate.</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { store.approveDuplicate(id, user!.name); toast.success("Accepted into pipeline"); }}><Check className="mr-1 h-4 w-4" />Accept</Button>
              <Button size="sm" variant="outline" onClick={() => setShowReject(true)}><X className="mr-1 h-4 w-4" />Reject</Button>
            </div>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-1 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Status</div>
              <div className="mt-1 flex items-center gap-2"><StatusBadge status={lead.status} /><span className="text-xs text-muted-foreground">{lead.stage}</span></div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Estimated value</div>
              <div className="mt-1 text-xl font-semibold">{fmtCurrency(lead.estimatedValue, lead.currency)}</div>
              {lead.confirmedValue && isAdmin && <div className="text-xs text-success">Confirmed: {fmtCurrency(lead.confirmedValue, lead.currency)}</div>}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Submitted by</div>
              <div className="mt-1">{partner?.name}</div>
            </div>
            <div className="border-t pt-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Contact</div>
              <div className="mt-1 text-sm">{lead.contactEmail}</div>
              <div className="text-sm">{lead.contactPhone}</div>
            </div>
            <div className="border-t pt-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Industry</div>
              <div className="mt-1 text-sm">{lead.industry}</div>
            </div>
            {commission && (
              <div className="rounded-md border border-success/30 bg-success/10 p-3 text-sm">
                <div className="text-xs uppercase tracking-wider text-success">{isPartner ? "Your commission" : "Commission"}</div>
                <div className="mt-1 font-semibold">{fmtCurrency(commission.amount)} · {commission.rate}%</div>
                <div className="text-xs">{commission.state}</div>
              </div>
            )}
          </Card>

          <div className="lg:col-span-2 space-y-4">
            <Card className="p-5">
              <h3 className="mb-2 font-semibold">Description</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{lead.description}</p>
            </Card>

            <Card className="p-0 overflow-hidden">
              <Tabs defaultValue="timeline">
                <TabsList className="m-3">
                  <TabsTrigger value="timeline"><Activity className="mr-1 h-3 w-3" />Timeline</TabsTrigger>
                  <TabsTrigger value="comments"><MessageSquare className="mr-1 h-3 w-3" />Comments</TabsTrigger>
                  <TabsTrigger value="calls"><Phone className="mr-1 h-3 w-3" />Discovery Calls</TabsTrigger>
                  <TabsTrigger value="files"><FileUp className="mr-1 h-3 w-3" />Attachments</TabsTrigger>
                </TabsList>

                <TabsContent value="timeline" className="p-5 pt-0">
                  <ul className="relative space-y-4 border-l pl-5">
                    {activity.length === 0 && <li className="text-sm text-muted-foreground">No activity yet.</li>}
                    {activity.map(a => (
                      <li key={a.id} className="relative">
                        <span className="absolute -left-[27px] mt-1 h-3 w-3 rounded-full border-2 border-background bg-brand" />
                        <div className="text-sm">
                          {a.private && <Lock className="mr-1 inline h-3 w-3 text-warning-foreground" />}
                          {a.text}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{a.user} · {new Date(a.date).toLocaleString()}</div>
                      </li>
                    ))}
                  </ul>
                </TabsContent>

                <TabsContent value="comments" className="p-5 pt-0 space-y-3">
                  <div className="space-y-2">
                    <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder={isPartner ? "Add an update on this lead…" : "Comment (visible to partner unless marked private)"} className="w-full rounded-md border bg-background p-3 text-sm" />
                    <div className="flex justify-end gap-2">
                      {isAdmin && <Button variant="outline" size="sm" onClick={() => post(true)}><Lock className="mr-1 h-3 w-3" />Private note</Button>}
                      <Button size="sm" onClick={() => post(false)}>Post comment</Button>
                    </div>
                  </div>
                  <div className="space-y-2 border-t pt-3">
                    {activity.filter(a => a.type === "comment" || a.type === "admin_note" || a.type === "partner_update").map(a => (
                      <div key={a.id} className={`rounded-md border p-3 text-sm ${a.private ? "bg-warning/10 border-warning/30" : "bg-accent/20"}`}>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{a.user}{a.private && <Lock className="ml-1 inline h-3 w-3" />}</span>
                          <span>{new Date(a.date).toLocaleString()}</span>
                        </div>
                        <p className="mt-1">{a.text}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="calls" className="p-5 pt-0 space-y-3">
                  {calls.length === 0 ? <p className="text-sm text-muted-foreground">No discovery calls logged for this lead.</p> : calls.map(c => (
                    <div key={c.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{new Date(c.date).toLocaleString()} · {c.duration} min</div>
                        {c.private && <span className="text-xs text-warning-foreground"><Lock className="mr-1 inline h-3 w-3" />Private</span>}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">Attendees: {c.attendees} · Client: {c.clientAttendees} · {c.partnerJoined ? "Partner joined" : "Partner not joined"}</div>
                      <p className="mt-2">{c.summary}</p>
                      {c.outcomes && <p className="mt-2 text-xs"><strong>Outcomes:</strong> {c.outcomes}</p>}
                      {c.nextSteps && <p className="text-xs"><strong>Next:</strong> {c.nextSteps} {c.followUp && `(${c.followUp})`}</p>}
                      {c.attachmentName && <p className="text-xs"><strong>Attachment:</strong> {c.attachmentName}</p>}
                    </div>
                  ))}
                  {isAdmin && <Button size="sm" onClick={() => setShowCall(true)}>+ Log new call</Button>}
                </TabsContent>

                <TabsContent value="files" className="p-5 pt-0 space-y-2">
                  {files.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No attachments yet.</p>
                  ) : (
                    <ul className="divide-y text-sm">
                      {files.map(f => (
                        <li key={f.id} className="flex items-center justify-between py-2">
                          <span>{f.name}</span>
                          <span className="text-xs text-muted-foreground">{new Date(f.date).toLocaleDateString()}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm hover:bg-accent/30">
                    <FileUp className="h-4 w-4" />
                    <input type="file" className="hidden" onChange={upload} />
                    Upload attachment
                  </label>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </PageContainer>

      <FormDialog
        open={showCall}
        onOpenChange={setShowCall}
        title="Log discovery call"
        canSubmit={!!call.date && !!call.summary.trim()}
        onSubmit={saveCall}
        submitLabel="Save call"
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs">Date & time<input type="datetime-local" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={call.date} onChange={e => setCall({ ...call, date: e.target.value })} /></label>
          <label className="text-xs">Duration (min)<input type="number" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={call.duration} onChange={e => setCall({ ...call, duration: e.target.value })} /></label>
          <label className="text-xs col-span-2">Internal attendees<input className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={call.attendees} onChange={e => setCall({ ...call, attendees: e.target.value })} /></label>
          <label className="text-xs col-span-2">Client attendees<input className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={call.clientAttendees} onChange={e => setCall({ ...call, clientAttendees: e.target.value })} /></label>
          <label className="text-xs col-span-2 flex items-center gap-2"><input type="checkbox" checked={call.partnerJoined} onChange={e => setCall({ ...call, partnerJoined: e.target.checked })} />Partner attended</label>
          <label className="text-xs col-span-2">Summary<textarea rows={3} className="mt-1 w-full rounded-md border bg-background p-2 text-sm" value={call.summary} onChange={e => setCall({ ...call, summary: e.target.value })} /></label>
          <label className="text-xs col-span-2">Outcomes<textarea rows={2} className="mt-1 w-full rounded-md border bg-background p-2 text-sm" value={call.outcomes} onChange={e => setCall({ ...call, outcomes: e.target.value })} /></label>
          <label className="text-xs col-span-2">Next steps<textarea rows={2} className="mt-1 w-full rounded-md border bg-background p-2 text-sm" value={call.nextSteps} onChange={e => setCall({ ...call, nextSteps: e.target.value })} /></label>
          <label className="text-xs col-span-2">Recording link or notes file<input className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={call.attachmentName} onChange={e => setCall({ ...call, attachmentName: e.target.value })} /></label>
          <label className="text-xs">Follow-up date<input type="date" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={call.followUp} onChange={e => setCall({ ...call, followUp: e.target.value })} /></label>
          <label className="text-xs flex items-center gap-2 pt-5"><input type="checkbox" checked={call.private} onChange={e => setCall({ ...call, private: e.target.checked })} />Private (admin only)</label>
        </div>
      </FormDialog>

      <FormDialog
        open={showCloseWon}
        onOpenChange={setShowCloseWon}
        title="Confirm Closed Won value"
        submitLabel="Close deal"
        canSubmit={Number(confirmedValue) > 0}
        onSubmit={() => {
          store.closeLeadWon(id, Number(confirmedValue), user!.name);
          toast.success("Deal closed won and commission calculated");
          setShowCloseWon(false);
        }}
      >
        <label className="text-xs">Confirmed deal value
          <input type="number" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={confirmedValue} onChange={e => setConfirmedValue(e.target.value)} />
        </label>
        <p className="text-xs text-muted-foreground">Partners do not see this confirmed value; they see their commission rate, amount, and payout state.</p>
      </FormDialog>

      <ReasonDialog
        open={showReject}
        onOpenChange={setShowReject}
        title="Reject as duplicate"
        description="Explain why this lead is being rejected as a duplicate. The partner will see this reason."
        confirmLabel="Reject duplicate"
        onConfirm={(reason) => { store.rejectDuplicate(id, user!.name, reason); toast.warning("Duplicate rejected"); }}
      />
    </>
  );
}

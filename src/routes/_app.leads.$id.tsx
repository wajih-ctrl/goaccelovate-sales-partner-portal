/* eslint-disable @typescript-eslint/no-explicit-any -- Lead mention RPC is introduced by the accompanying migration. */
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { PageHeader, PageContainer, StatusBadge } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { fmtCurrency, type LeadStage } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useState } from "react";
import {
  Activity,
  AtSign,
  ArrowLeft,
  Check,
  Download,
  FileUp,
  Lock,
  MessageSquare,
  Pencil,
  Phone,
} from "lucide-react";
import { FormDialog, ReasonDialog } from "@/components/common/dialogs";
import { PhoneInput } from "@/components/common/PhoneInput";
import { DealPaymentPanel } from "@/components/payments/DealPaymentPanel";
import {
  canMoveLeadStage,
  COUNTRIES,
  INDUSTRIES,
  isCommercialStage,
  LEAD_STAGES,
} from "@/lib/program";

export const Route = createFileRoute("/_app/leads/$id")({ component: LeadDetail });

const STAGES: LeadStage[] = LEAD_STAGES;

type LeadMentionCandidate = {
  id: string;
  name: string;
  role: "admin" | "super_admin";
};

function LeadDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const store = useStore();
  const lead = store.leads.find((l) => l.id === id);
  const [comment, setComment] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [mentionCandidates, setMentionCandidates] = useState<LeadMentionCandidate[]>([]);
  const [loadingMentions, setLoadingMentions] = useState(false);
  const [mentionLoadFailed, setMentionLoadFailed] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [edit, setEdit] = useState({
    company: "",
    contactName: "",
    contactTitle: "",
    contactEmail: "",
    contactPhone: "",
    clientLinkedin: "",
    country: "",
    industry: "",
    estimatedValue: "",
    currency: "USD",
    description: "",
  });
  const [showCall, setShowCall] = useState(false);
  const [showCloseWon, setShowCloseWon] = useState(false);
  const [pendingStage, setPendingStage] = useState<LeadStage | null>(null);
  const [confirmedValue, setConfirmedValue] = useState("");
  const [showEstimatedValue, setShowEstimatedValue] = useState(false);
  const [estimatedValue, setEstimatedValue] = useState("");
  const [attachmentPrivate, setAttachmentPrivate] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [call, setCall] = useState({
    date: "",
    duration: "30",
    attendees: "",
    clientAttendees: "",
    partnerJoined: false,
    summary: "",
    outcomes: "",
    nextSteps: "",
    followUp: "",
    attachmentName: "",
    attachmentFile: undefined as File | undefined,
    private: false,
  });

  if (!store.hydrated) {
    return (
      <PageContainer>
        <Card className="p-8 text-center text-sm text-muted-foreground">Loading deal...</Card>
      </PageContainer>
    );
  }
  if (!lead) return <Navigate to="/pipeline" search={{ view: "list" }} />;
  if (user?.role === "partner" && lead.partnerId !== user.partnerId)
    return <Navigate to="/access-denied" />;

  const partner = store.partners.find((p) => p.id === lead.partnerId);
  const isPartner = user?.role === "partner";
  const isAdmin = !isPartner;
  const activity = store.activity.filter((a) => a.leadId === id && (!a.private || isAdmin));
  const calls = store.calls.filter((c) => c.leadId === id && (!c.private || isAdmin));
  const commission = store.commissions.find((c) => c.leadId === id);
  const files = store.attachments[id] || [];
  const dup = lead.status === "Duplicate Rejected";
  const loadMentionCandidates = async (force = false) => {
    setMentionPickerOpen(true);
    if ((!force && mentionCandidates.length) || loadingMentions) return;
    setLoadingMentions(true);
    setMentionLoadFailed(false);
    if (supabase) {
      const { data, error } = await (supabase as any).rpc("get_lead_mention_candidates", {
        target_lead: id,
      });
      if (error) {
        setMentionLoadFailed(true);
        toast.error("Unable to load Admin mentions. Please try again.");
      } else {
        setMentionCandidates(
          (data || []).map(
            (candidate: { id: string; display_name: string; role: "admin" | "super_admin" }) => ({
              id: candidate.id,
              name: candidate.display_name,
              role: candidate.role,
            }),
          ),
        );
      }
    } else {
      setMentionCandidates(
        store.staffUsers
          .filter(
            (staff) =>
              (staff.role === "admin" || staff.role === "super_admin") &&
              staff.accountStatus === "active",
          )
          .map((staff) => ({
            id: staff.id,
            name: staff.name,
            role: staff.role as "admin" | "super_admin",
          })),
      );
    }
    setLoadingMentions(false);
  };

  const updateComment = (value: string) => {
    setComment(value);
    setMentionedUserIds((current) =>
      current.filter((staffId) => {
        const staff = mentionCandidates.find((candidate) => candidate.id === staffId);
        return Boolean(staff && value.includes(`@[${staff.name}]`));
      }),
    );
    if (isPartner && /(^|\s)@$/.test(value)) void loadMentionCandidates();
  };

  const insertMention = (staffId: string, staffName: string) => {
    const token = `@[${staffName}]`;
    setComment((current) => {
      if (current.includes(token)) return current;
      if (/(^|\s)@$/.test(current)) return `${current.slice(0, -1)}${token} `;
      return `${current}${current && !current.endsWith(" ") ? " " : ""}${token} `;
    });
    setMentionedUserIds((current) => (current.includes(staffId) ? current : [...current, staffId]));
    setMentionPickerOpen(false);
  };

  const post = async (priv: boolean) => {
    if (!comment.trim()) {
      toast.error("Comment cannot be empty");
      return;
    }
    const saved = await store.addComment(id, comment.trim(), user!.name, priv, mentionedUserIds);
    if (!saved) return;
    setComment("");
    setMentionedUserIds([]);
    setMentionPickerOpen(false);
    toast.success(priv ? "Private note added" : "Comment posted");
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadingFile(true);
    await store.addAttachment(id, f, user!.name, isAdmin && attachmentPrivate);
    setUploadingFile(false);
    e.target.value = "";
  };

  const saveCall = () => {
    if (!call.date || !call.summary.trim()) {
      toast.error("Date and summary are required");
      return;
    }
    void (async () => {
      const saved = await store.addCall(
        {
          leadId: id,
          date: call.date,
          duration: Number(call.duration) || 30,
          attendees: call.attendees,
          clientAttendees: call.clientAttendees,
          partnerJoined: call.partnerJoined,
          summary: call.summary,
          outcomes: call.outcomes,
          nextSteps: call.nextSteps,
          followUp: call.followUp,
          attachmentName: call.attachmentFile?.name || call.attachmentName,
          attachmentFile: call.attachmentFile,
          private: call.private,
        },
        user!.name,
      );
      if (!saved) return;
      setShowCall(false);
      setCall({
        date: "",
        duration: "30",
        attendees: "",
        clientAttendees: "",
        partnerJoined: false,
        summary: "",
        outcomes: "",
        nextSteps: "",
        followUp: "",
        attachmentName: "",
        attachmentFile: undefined,
        private: false,
      });
    })();
  };

  const changeStage = (stage: LeadStage) => {
    if (
      !user ||
      !canMoveLeadStage(user.role, lead.stage, stage, lead.previousStage, lead.stageAdminLocked)
    ) {
      toast.error("Your role cannot move this lead to that stage.");
      return;
    }
    if (stage === "Closed Won" && lead.stage !== "Closed Won" && !lead.confirmedValue) {
      setConfirmedValue(String(lead.estimatedValue));
      setShowCloseWon(true);
      return;
    }
    if (stage === "Closed Lost" && lead.stage !== "Closed Lost") {
      setPendingStage(stage);
      return;
    }
    store.updateLeadStage(id, stage, user!.name);
  };

  return (
    <>
      <PageHeader
        title={lead.company}
        description={`${lead.contactName} · ${lead.contactTitle} · ${lead.country}`}
        actions={
          <>
            <Link to="/pipeline" search={{ view: "list" }}>
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            {isPartner && (
              <Button
                variant="outline"
                onClick={() => {
                  setEdit({
                    company: lead.company,
                    contactName: lead.contactName,
                    contactTitle: lead.contactTitle,
                    contactEmail: lead.contactEmail,
                    contactPhone: lead.contactPhone || "",
                    clientLinkedin: lead.clientLinkedin || "",
                    country: lead.country,
                    industry: lead.industry,
                    estimatedValue: String(lead.estimatedValue),
                    currency: lead.currency,
                    description: lead.description,
                  });
                  setShowEdit(true);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" /> Edit lead
              </Button>
            )}
            {!dup && (
              <select
                value={lead.stage}
                onChange={(e) => changeStage(e.target.value as LeadStage)}
                className="h-9 max-w-full rounded-md border bg-background px-3 text-sm"
              >
                {STAGES.filter(
                  (stage) =>
                    stage === lead.stage ||
                    Boolean(
                      user &&
                      canMoveLeadStage(
                        user.role,
                        lead.stage,
                        stage,
                        lead.previousStage,
                        lead.stageAdminLocked,
                      ),
                    ),
                ).map((stage) => (
                  <option key={stage}>{stage}</option>
                ))}
              </select>
            )}
          </>
        }
      />
      <PageContainer>
        {dup && (
          <Card className="border-warning/40 bg-warning/10 p-4 text-sm">
            <div>
              <div className="font-semibold">Duplicate Rejected</div>
              <div className="text-xs text-muted-foreground">
                {lead.duplicateReason ||
                  "This lead matched an existing company or contact and did not enter the pipeline."}
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-1 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Status</div>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge status={lead.status} />
                <span className="text-xs text-muted-foreground">{lead.stage}</span>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Estimated value
              </div>
              <div className="mt-1 text-xl font-semibold">
                {fmtCurrency(lead.estimatedValue, lead.currency)}
              </div>
              {isAdmin && isCommercialStage(lead.stage, lead.previousStage) && (
                <Button
                  className="mt-2"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEstimatedValue(String(lead.estimatedValue));
                    setShowEstimatedValue(true);
                  }}
                >
                  Update commercial value
                </Button>
              )}
              {lead.confirmedValue && isAdmin && (
                <div className="text-xs text-success">
                  Confirmed: {fmtCurrency(lead.confirmedValue, lead.currency)}
                </div>
              )}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Submitted by
              </div>
              <div className="mt-1">{partner?.name}</div>
            </div>
            <div className="border-t pt-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Contact</div>
              <div className="mt-1 text-sm">{lead.contactEmail}</div>
              <div className="text-sm">{lead.contactPhone}</div>
              {lead.clientLinkedin && (
                <a
                  className="text-sm text-brand hover:underline"
                  href={lead.clientLinkedin}
                  target="_blank"
                  rel="noreferrer"
                >
                  Client LinkedIn
                </a>
              )}
            </div>
            <div className="border-t pt-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Industry</div>
              <div className="mt-1 text-sm">{lead.industry}</div>
            </div>
            {commission && (
              <div className="rounded-md border border-success/30 bg-success/10 p-3 text-sm">
                <div className="text-xs uppercase tracking-wider text-success">
                  {isPartner ? "Your commission" : "Commission"}
                </div>
                <div className="mt-1 font-semibold">
                  {fmtCurrency(commission.amount)} · {commission.rate}%
                </div>
                <div className="text-xs">{commission.state}</div>
              </div>
            )}
          </Card>

          <div className="lg:col-span-2 space-y-4">
            {isAdmin && <DealPaymentPanel lead={lead} actor={user!.name} />}

            <Card className="p-5">
              <h3 className="mb-2 font-semibold">Description</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {lead.description}
              </p>
              <div className="mt-5 border-t pt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Supporting files
                </div>
                {files.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No supporting files uploaded.</p>
                ) : (
                  <ul className="divide-y text-sm">
                    {files.map((file) => (
                      <li
                        key={file.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2"
                      >
                        <span className="min-w-0 truncate">
                          {file.name}
                          {file.private && (
                            <Lock className="ml-1 inline h-3 w-3 text-warning-foreground" />
                          )}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            store.downloadStoredFile(
                              file.storageBucket,
                              file.storagePath,
                              file.name,
                            )
                          }
                        >
                          <Download className="mr-2 h-4 w-4" /> Download
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {isAdmin && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={attachmentPrivate}
                      onChange={(event) => setAttachmentPrivate(event.target.checked)}
                    />
                    Private/internal file
                  </label>
                )}
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm hover:bg-accent/30">
                  <FileUp className="h-4 w-4" />
                  <input
                    type="file"
                    className="hidden"
                    onChange={upload}
                    disabled={uploadingFile}
                  />
                  {uploadingFile ? "Uploading..." : "Upload supporting file"}
                </label>
              </div>
            </Card>

            <Card
              className={`relative p-0 overflow-visible ${mentionPickerOpen ? "z-20" : "z-auto"}`}
            >
              <Tabs defaultValue="timeline">
                <TabsList className="m-3">
                  <TabsTrigger value="timeline">
                    <Activity className="mr-1 h-3 w-3" />
                    Timeline
                  </TabsTrigger>
                  <TabsTrigger value="comments">
                    <MessageSquare className="mr-1 h-3 w-3" />
                    Comments
                  </TabsTrigger>
                  <TabsTrigger value="calls">
                    <Phone className="mr-1 h-3 w-3" />
                    Discovery Calls
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="timeline" className="p-5 pt-0">
                  <ul className="relative space-y-4 border-l pl-5">
                    {activity.length === 0 && (
                      <li className="text-sm text-muted-foreground">No activity yet.</li>
                    )}
                    {activity.map((a) => (
                      <li key={a.id} className="relative">
                        <span className="absolute -left-[27px] mt-1 h-3 w-3 rounded-full border-2 border-background bg-brand" />
                        <div className="text-sm">
                          {a.private && (
                            <Lock className="mr-1 inline h-3 w-3 text-warning-foreground" />
                          )}
                          {a.text}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {a.user} · {new Date(a.date).toLocaleString()}
                        </div>
                      </li>
                    ))}
                  </ul>
                </TabsContent>

                <TabsContent value="comments" className="p-5 pt-0 space-y-3">
                  <div className="relative rounded-md border bg-background shadow-sm focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-100">
                    <textarea
                      value={comment}
                      onChange={(event) => updateComment(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setMentionPickerOpen(false);
                      }}
                      rows={3}
                      placeholder={
                        isPartner
                          ? "Add an update. Type @ to mention an Admin..."
                          : "Comment (visible to partner unless marked private)"
                      }
                      className="block w-full resize-none border-0 bg-transparent p-3 text-sm outline-none"
                    />
                    <div className="flex min-h-11 flex-wrap items-center gap-2 border-t px-2 py-1.5">
                      {isPartner && (
                        <Button
                          type="button"
                          size="sm"
                          variant={mentionPickerOpen ? "default" : "ghost"}
                          className="h-8 px-2"
                          disabled={loadingMentions}
                          onClick={() =>
                            mentionPickerOpen
                              ? setMentionPickerOpen(false)
                              : void loadMentionCandidates()
                          }
                          title="Mention an Admin or Super Admin"
                        >
                          <AtSign className="mr-1 h-4 w-4" /> Mention
                        </Button>
                      )}
                      {isPartner && mentionedUserIds.length > 0 && (
                        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                          {mentionedUserIds.map((staffId) => {
                            const staff = mentionCandidates.find(
                              (candidate) => candidate.id === staffId,
                            );
                            return staff ? (
                              <span
                                key={staff.id}
                                className="inline-flex h-7 items-center gap-1 rounded-full bg-sky-50 px-2 text-xs font-medium text-sky-800"
                              >
                                @{staff.name}
                                <Check className="h-3 w-3" />
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                      <div className="ml-auto flex gap-2">
                        {isAdmin && (
                          <Button variant="outline" size="sm" onClick={() => void post(true)}>
                            <Lock className="mr-1 h-3 w-3" />
                            Private note
                          </Button>
                        )}
                        <Button size="sm" onClick={() => void post(false)}>
                          Post comment
                        </Button>
                      </div>
                    </div>
                    {isPartner && mentionPickerOpen && (
                      <div className="absolute left-0 top-full z-30 mt-1 w-[min(22rem,calc(100vw-3rem))] overflow-hidden rounded-md border bg-white shadow-elevated">
                        <div className="border-b px-3 py-2 text-xs font-semibold">
                          Mention Admin or Super Admin
                        </div>
                        <div className="max-h-56 overflow-y-auto p-1">
                          {loadingMentions ? (
                            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                              Loading Admins...
                            </div>
                          ) : mentionCandidates.length ? (
                            mentionCandidates.map((staff) => (
                              <button
                                key={staff.id}
                                type="button"
                                onClick={() => insertMention(staff.id, staff.name)}
                                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-zinc-100"
                              >
                                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white">
                                  {staff.name
                                    .split(/\s+/)
                                    .slice(0, 2)
                                    .map((part) => part[0])
                                    .join("")
                                    .toUpperCase()}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium">
                                    {staff.name}
                                  </span>
                                  <span className="block text-[11px] text-muted-foreground">
                                    {staff.role === "super_admin" ? "Super Admin" : "Admin"}
                                  </span>
                                </span>
                                {mentionedUserIds.includes(staff.id) && (
                                  <Check className="h-4 w-4 text-success" />
                                )}
                              </button>
                            ))
                          ) : mentionLoadFailed ? (
                            <div className="space-y-2 px-3 py-4 text-center text-xs text-muted-foreground">
                              <div>Admin names could not be loaded.</div>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void loadMentionCandidates(true)}
                              >
                                Try again
                              </Button>
                            </div>
                          ) : (
                            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                              No active Admins are available.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 border-t pt-3">
                    {activity
                      .filter(
                        (a) =>
                          a.type === "comment" ||
                          a.type === "admin_note" ||
                          a.type === "partner_update",
                      )
                      .map((a) => (
                        <div
                          key={a.id}
                          className={`rounded-md border p-3 text-sm ${a.private ? "bg-warning/10 border-warning/30" : "bg-accent/20"}`}
                        >
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              {a.user}
                              {a.private && <Lock className="ml-1 inline h-3 w-3" />}
                            </span>
                            <span>{new Date(a.date).toLocaleString()}</span>
                          </div>
                          <p className="mt-1">
                            {a.text.split(/(@\[[^\]]+\])/g).map((part, index) => {
                              const mention = part.match(/^@\[([^\]]+)\]$/);
                              return mention ? (
                                <span
                                  key={`${part}-${index}`}
                                  className="rounded bg-sky-100 px-1 font-medium text-sky-800"
                                >
                                  @{mention[1]}
                                </span>
                              ) : (
                                part
                              );
                            })}
                          </p>
                        </div>
                      ))}
                  </div>
                </TabsContent>

                <TabsContent value="calls" className="p-5 pt-0 space-y-3">
                  {calls.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No discovery calls logged for this lead.
                    </p>
                  ) : (
                    calls.map((c) => (
                      <div key={c.id} className="rounded-md border p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">
                            {new Date(c.date).toLocaleString()} · {c.duration} min
                          </div>
                          {c.private && (
                            <span className="text-xs text-warning-foreground">
                              <Lock className="mr-1 inline h-3 w-3" />
                              Private
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Attendees: {c.attendees} · Client: {c.clientAttendees} ·{" "}
                          {c.partnerJoined ? "Partner joined" : "Partner not joined"}
                        </div>
                        <p className="mt-2">{c.summary}</p>
                        {c.outcomes && (
                          <p className="mt-2 text-xs">
                            <strong>Outcomes:</strong> {c.outcomes}
                          </p>
                        )}
                        {c.nextSteps && (
                          <p className="text-xs">
                            <strong>Next:</strong> {c.nextSteps} {c.followUp && `(${c.followUp})`}
                          </p>
                        )}
                        {c.attachmentName && (
                          <p className="text-xs">
                            <strong>Attachment:</strong> {c.attachmentName}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                  {isAdmin && (
                    <Button size="sm" onClick={() => setShowCall(true)}>
                      + Log new call
                    </Button>
                  )}
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </PageContainer>

      <FormDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        title="Edit lead"
        description="Update the business and contact details for this opportunity."
        submitLabel={savingEdit ? "Saving..." : "Save changes"}
        canSubmit={
          !savingEdit &&
          Boolean(edit.company.trim()) &&
          Boolean(edit.contactName.trim()) &&
          Boolean(edit.contactTitle.trim()) &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(edit.contactEmail) &&
          Boolean(edit.country) &&
          Boolean(edit.industry) &&
          Number(edit.estimatedValue) > 0 &&
          edit.description.trim().length >= 50
        }
        onSubmit={async () => {
          setSavingEdit(true);
          const saved = await store.updateOwnLead(id, {
            company: edit.company.trim(),
            contactName: edit.contactName.trim(),
            contactTitle: edit.contactTitle.trim(),
            contactEmail: edit.contactEmail.trim(),
            contactPhone: edit.contactPhone.trim(),
            clientLinkedin: edit.clientLinkedin.trim(),
            country: edit.country,
            industry: edit.industry,
            estimatedValue: Number(edit.estimatedValue),
            currency: edit.currency,
            description: edit.description.trim(),
          });
          setSavingEdit(false);
          if (!saved) return;
          toast.success("Lead details updated.");
          setShowEdit(false);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs">
            Company name
            <input
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={edit.company}
              onChange={(event) => setEdit({ ...edit, company: event.target.value })}
              placeholder="e.g. Acme Corporation"
            />
          </label>
          <label className="text-xs">
            Contact name
            <input
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={edit.contactName}
              onChange={(event) => setEdit({ ...edit, contactName: event.target.value })}
              placeholder="e.g. Jordan Lee"
            />
          </label>
          <label className="text-xs">
            Job title
            <input
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={edit.contactTitle}
              onChange={(event) => setEdit({ ...edit, contactTitle: event.target.value })}
              placeholder="e.g. Chief Operating Officer"
            />
          </label>
          <label className="text-xs">
            Contact email
            <input
              type="email"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={edit.contactEmail}
              onChange={(event) => setEdit({ ...edit, contactEmail: event.target.value })}
              placeholder="jordan@company.com"
            />
          </label>
          <label className="text-xs">
            Contact phone (optional)
            <PhoneInput
              value={edit.contactPhone}
              onChange={(contactPhone) => setEdit({ ...edit, contactPhone })}
              defaultCountry={edit.country}
              placeholder="e.g. 300 1234567"
            />
          </label>
          <label className="text-xs">
            LinkedIn (optional)
            <input
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={edit.clientLinkedin}
              onChange={(event) => setEdit({ ...edit, clientLinkedin: event.target.value })}
              placeholder="https://www.linkedin.com/in/..."
            />
          </label>
          <label className="text-xs">
            Country
            <select
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={edit.country}
              onChange={(event) => setEdit({ ...edit, country: event.target.value })}
            >
              <option value="">Select country</option>
              {COUNTRIES.map((country) => (
                <option key={country}>{country}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Industry
            <select
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={edit.industry}
              onChange={(event) => setEdit({ ...edit, industry: event.target.value })}
            >
              <option value="">Select industry</option>
              {Array.from(new Set([...INDUSTRIES, ...store.settings.industries])).map(
                (industry) => (
                  <option key={industry}>{industry}</option>
                ),
              )}
            </select>
          </label>
          <label className="text-xs">
            Estimated value
            <input
              type="number"
              min="0.01"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={edit.estimatedValue}
              onChange={(event) => setEdit({ ...edit, estimatedValue: event.target.value })}
              placeholder="e.g. 25000"
            />
          </label>
          <label className="text-xs">
            Currency
            <select
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={edit.currency}
              onChange={(event) => setEdit({ ...edit, currency: event.target.value })}
            >
              {store.settings.currencies.map((currency) => (
                <option key={currency}>{currency}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="text-xs">
          Description (minimum 50 characters)
          <textarea
            rows={5}
            className="mt-1 w-full rounded-md border bg-background p-3 text-sm"
            value={edit.description}
            onChange={(event) => setEdit({ ...edit, description: event.target.value })}
            placeholder="Describe the opportunity, relationship, stakeholders, and timing."
          />
        </label>
      </FormDialog>

      <FormDialog
        open={showCall}
        onOpenChange={setShowCall}
        title="Log discovery call"
        canSubmit={!!call.date && !!call.summary.trim()}
        onSubmit={saveCall}
        submitLabel="Save call"
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs">
            Date & time
            <input
              type="datetime-local"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={call.date}
              onChange={(e) => setCall({ ...call, date: e.target.value })}
            />
          </label>
          <label className="text-xs">
            Duration (min)
            <input
              type="number"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={call.duration}
              onChange={(e) => setCall({ ...call, duration: e.target.value })}
              placeholder="e.g. 30"
            />
          </label>
          <label className="text-xs col-span-2">
            Internal attendees
            <input
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={call.attendees}
              onChange={(e) => setCall({ ...call, attendees: e.target.value })}
              placeholder="Names of GoAccelovate attendees"
            />
          </label>
          <label className="text-xs col-span-2">
            Client attendees
            <input
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={call.clientAttendees}
              onChange={(e) => setCall({ ...call, clientAttendees: e.target.value })}
              placeholder="Names and roles of client attendees"
            />
          </label>
          <label className="text-xs col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={call.partnerJoined}
              onChange={(e) => setCall({ ...call, partnerJoined: e.target.checked })}
            />
            Partner attended
          </label>
          <label className="text-xs col-span-2">
            Summary
            <textarea
              rows={3}
              className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
              value={call.summary}
              onChange={(e) => setCall({ ...call, summary: e.target.value })}
              placeholder="Summarize the discussion and client needs"
            />
          </label>
          <label className="text-xs col-span-2">
            Outcomes
            <textarea
              rows={2}
              className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
              value={call.outcomes}
              onChange={(e) => setCall({ ...call, outcomes: e.target.value })}
              placeholder="Key decisions or outcomes"
            />
          </label>
          <label className="text-xs col-span-2">
            Next steps
            <textarea
              rows={2}
              className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
              value={call.nextSteps}
              onChange={(e) => setCall({ ...call, nextSteps: e.target.value })}
              placeholder="Owners, actions, and deadlines"
            />
          </label>
          <label className="text-xs col-span-2">
            Recording link
            <input
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={call.attachmentName}
              onChange={(e) => setCall({ ...call, attachmentName: e.target.value })}
              placeholder="https://..."
            />
          </label>
          <label className="text-xs col-span-2">
            Notes or recording file
            <input
              type="file"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              onChange={(e) => setCall({ ...call, attachmentFile: e.target.files?.[0] })}
            />
          </label>
          <label className="text-xs">
            Follow-up date
            <input
              type="date"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={call.followUp}
              onChange={(e) => setCall({ ...call, followUp: e.target.value })}
            />
          </label>
          <label className="text-xs flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              checked={call.private}
              onChange={(e) => setCall({ ...call, private: e.target.checked })}
            />
            Private (admin only)
          </label>
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
        <label className="text-xs">
          Confirmed deal value
          <input
            type="number"
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={confirmedValue}
            onChange={(e) => setConfirmedValue(e.target.value)}
            placeholder="e.g. 25000"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Partners do not see this confirmed value; they see their commission rate, amount, and
          payout state.
        </p>
      </FormDialog>

      <ReasonDialog
        open={!!pendingStage}
        onOpenChange={(b) => !b && setPendingStage(null)}
        title={`Move to ${pendingStage || "stage"}`}
        description="Provide the reason for this stage change. It will be visible in the lead timeline and audit trail."
        confirmLabel="Save stage change"
        destructive={false}
        onConfirm={(reason) => {
          if (!pendingStage) return;
          store.updateLeadStage(id, pendingStage, user!.name, reason);
          toast.warning(`Lead moved to ${pendingStage}`);
          setPendingStage(null);
        }}
      />

      <FormDialog
        open={showEstimatedValue}
        onOpenChange={setShowEstimatedValue}
        title="Update estimated deal value"
        submitLabel="Save value"
        canSubmit={Number(estimatedValue) > 0}
        onSubmit={() => {
          store.updateEstimatedValue(id, Number(estimatedValue), user!.name);
          toast.success("Estimated deal value updated");
          setShowEstimatedValue(false);
        }}
      >
        <label className="text-xs">
          Commercial value ({lead.currency})
          <input
            type="number"
            min="0.01"
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={estimatedValue}
            onChange={(event) => setEstimatedValue(event.target.value)}
            placeholder="e.g. 25000"
          />
        </label>
      </FormDialog>
    </>
  );
}

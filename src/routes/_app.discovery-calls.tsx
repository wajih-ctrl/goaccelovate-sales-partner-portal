import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { PageHeader, PageContainer } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { Lock, Phone } from "lucide-react";
import { useState } from "react";
import { FormDialog } from "@/components/common/dialogs";

export const Route = createFileRoute("/_app/discovery-calls")({ component: DiscoveryCalls });

function DiscoveryCalls() {
  const { user } = useAuth();
  const { calls, leads, addCall } = useStore();

  const [open, setOpen] = useState(false);
  const empty = {
    leadId: leads[0]?.id || "",
    date: "",
    duration: "30",
    attendees: user?.name || "",
    clientAttendees: "",
    partnerJoined: false,
    summary: "",
    outcomes: "",
    nextSteps: "",
    followUp: "",
    attachmentName: "",
    attachmentFile: undefined as File | undefined,
    private: false,
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  if (user?.role === "partner") return <Navigate to="/access-denied" />;

  return (
    <>
      <PageHeader
        title="Discovery Calls"
        description="All logged discovery calls across active leads."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Phone className="mr-2 h-4 w-4" />
            Log call
          </Button>
        }
      />
      <PageContainer>
        <div className="grid gap-3">
          {calls.length === 0 && (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              No discovery calls logged yet.
            </Card>
          )}
          {calls.map((c) => {
            const lead = leads.find((l) => l.id === c.leadId);
            return (
              <Card key={c.id} className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <Link
                      to="/leads/$id"
                      params={{ id: c.leadId }}
                      className="text-sm font-semibold hover:underline"
                    >
                      {lead?.company || c.leadId}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {new Date(c.date).toLocaleString()} · {c.duration} min · Partner joined:{" "}
                      {c.partnerJoined ? "Yes" : "No"}
                    </div>
                  </div>
                  {c.private && (
                    <span className="text-xs text-warning-foreground">
                      <Lock className="mr-1 inline h-3 w-3" />
                      Private
                    </span>
                  )}
                </div>
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                  <div>
                    <strong>Attendees:</strong> {c.attendees}
                  </div>
                  <div>
                    <strong>Client:</strong> {c.clientAttendees}
                  </div>
                </div>
                <p className="mt-3 text-sm">{c.summary}</p>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                  {c.outcomes && (
                    <div>
                      <strong>Outcomes:</strong> {c.outcomes}
                    </div>
                  )}
                  {c.nextSteps && (
                    <div>
                      <strong>Next steps:</strong> {c.nextSteps}
                    </div>
                  )}
                  {c.followUp && (
                    <div>
                      <strong>Follow-up:</strong> {c.followUp}
                    </div>
                  )}
                  {c.attachmentName && (
                    <div>
                      <strong>Attachment:</strong> {c.attachmentName}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </PageContainer>

      <FormDialog
        open={open}
        onOpenChange={(b) => {
          setOpen(b);
          if (!b) setForm(empty);
        }}
        title="Log discovery call"
        submitLabel={saving ? "Saving..." : "Save call"}
        canSubmit={!!form.leadId && !!form.date && !!form.summary.trim()}
        onSubmit={async () => {
          setSaving(true);
          const saved = await addCall(
            {
              leadId: form.leadId,
              date: form.date,
              duration: Number(form.duration) || 30,
              attendees: form.attendees,
              clientAttendees: form.clientAttendees,
              partnerJoined: form.partnerJoined,
              summary: form.summary,
              outcomes: form.outcomes,
              nextSteps: form.nextSteps,
              followUp: form.followUp,
              attachmentName: form.attachmentFile?.name || form.attachmentName,
              attachmentFile: form.attachmentFile,
              private: form.private,
            },
            user!.name,
          );
          setSaving(false);
          if (!saved) return;
          setOpen(false);
          setForm(empty);
        }}
      >
        <label className="text-xs">
          Lead
          <select
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.leadId}
            onChange={(e) => setForm({ ...form, leadId: e.target.value })}
          >
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.company}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            Date & time
            <input
              type="datetime-local"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </label>
          <label className="text-xs">
            Duration (min)
            <input
              type="number"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
            />
          </label>
        </div>
        <label className="text-xs">
          Internal attendees
          <input
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.attendees}
            onChange={(e) => setForm({ ...form, attendees: e.target.value })}
          />
        </label>
        <label className="text-xs">
          Client attendees
          <input
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.clientAttendees}
            onChange={(e) => setForm({ ...form, clientAttendees: e.target.value })}
          />
        </label>
        <label className="text-xs flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.partnerJoined}
            onChange={(e) => setForm({ ...form, partnerJoined: e.target.checked })}
          />
          Partner attended
        </label>
        <label className="text-xs">
          Summary
          <textarea
            rows={3}
            className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
          />
        </label>
        <label className="text-xs">
          Outcomes
          <textarea
            rows={2}
            className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
            value={form.outcomes}
            onChange={(e) => setForm({ ...form, outcomes: e.target.value })}
          />
        </label>
        <label className="text-xs">
          Next steps
          <textarea
            rows={2}
            className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
            value={form.nextSteps}
            onChange={(e) => setForm({ ...form, nextSteps: e.target.value })}
          />
        </label>
        <label className="text-xs">
          Recording link
          <input
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.attachmentName}
            onChange={(e) => setForm({ ...form, attachmentName: e.target.value })}
          />
        </label>
        <label className="text-xs">
          Notes or recording file
          <input
            type="file"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            onChange={(e) => setForm({ ...form, attachmentFile: e.target.files?.[0] })}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            Follow-up date
            <input
              type="date"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.followUp}
              onChange={(e) => setForm({ ...form, followUp: e.target.value })}
            />
          </label>
          <label className="text-xs flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              checked={form.private}
              onChange={(e) => setForm({ ...form, private: e.target.checked })}
            />
            Private (admin only)
          </label>
        </div>
      </FormDialog>
    </>
  );
}

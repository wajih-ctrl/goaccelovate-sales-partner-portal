import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageContainer } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { isAnnouncementTargeted } from "@/lib/announcements";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { FormDialog } from "@/components/common/dialogs";

export const Route = createFileRoute("/_app/announcements")({ component: AnnouncementsPage });

function PriorityBadge({ p }: { p: string }) {
  const map: Record<string, string> = {
    General: "bg-secondary text-secondary-foreground",
    Important: "bg-info/15 text-info border border-info/20",
    Urgent: "bg-destructive/10 text-destructive border border-destructive/20",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${map[p]}`}>{p}</span>;
}

function AnnouncementsPage() {
  const { user } = useAuth();
  const { announcements, partners, publishAnnouncement, markAnnouncementRead } = useStore();
  const isAdmin = user?.role !== "partner";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", priority: "General" as "General" | "Important" | "Urgent", target: "All partners", selectedPartners: "", email: true });
  const partner = user?.partnerId ? partners.find(p => p.id === user.partnerId) : undefined;
  const visibleAnnouncements = useMemo(
    () => isAdmin ? announcements : announcements.filter(a => isAnnouncementTargeted(a, partner)),
    [announcements, isAdmin, partner]
  );

  return (
    <>
      <PageHeader title="Announcements" description={isAdmin ? "Broadcast updates to partners." : "Latest news and updates from GoAccelovate."}
        actions={isAdmin ? <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />New announcement</Button> : null}
      />
      <PageContainer>
        <div className="grid gap-4">
          {visibleAnnouncements.length === 0 && <Card className="p-10 text-center text-sm text-muted-foreground">No announcements yet.</Card>}
          {visibleAnnouncements.map(a => {
            const unread = user?.partnerId && !a.readBy.includes(user.partnerId);
            return (
              <Card key={a.id} className={`p-5 ${unread ? "ring-2 ring-brand/30" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{a.title}</h3>
                      <PriorityBadge p={a.priority} />
                      {unread && <span className="text-[11px] font-medium text-brand">UNREAD</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{new Date(a.date).toLocaleDateString()} · Target: {a.target}</div>
                  </div>
                  {isAdmin ? <div className="text-xs text-muted-foreground">{a.readBy.length} read</div> : unread && (
                    <Button variant="outline" size="sm" onClick={() => markAnnouncementRead(a.id, user!.partnerId!)}>Mark read</Button>
                  )}
                </div>
                <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">{a.body}</p>
              </Card>
            );
          })}
        </div>
      </PageContainer>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Create announcement"
        submitLabel="Publish"
        canSubmit={!!form.title.trim() && !!form.body.trim() && (form.target !== "Selected partners" || !!form.selectedPartners.trim())}
        onSubmit={() => {
          const target = form.target === "Selected partners" ? `Selected partners: ${form.selectedPartners.trim()}` : form.target;
          publishAnnouncement({ title: form.title.trim(), body: form.body.trim(), priority: form.priority, target }, user!.name);
          toast.success(form.email ? "Announcement published. Email delivery simulated." : "Announcement published");
          setOpen(false);
          setForm({ title: "", body: "", priority: "General", target: "All partners", selectedPartners: "", email: true });
        }}
      >
        <label className="text-xs">Title<input className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
        <label className="text-xs">Body<textarea rows={4} className="mt-1 w-full rounded-md border bg-background p-3 text-sm" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} /></label>
        <label className="text-xs">Priority
          <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as any })}>
            <option>General</option><option>Important</option><option>Urgent</option>
          </select>
        </label>
        <label className="text-xs">Audience
          <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })}>
            <option>All partners</option>
            <option>Partner tier</option>
            <option>Specialist tier</option>
            <option>Associate tier</option>
            <option>APAC region</option>
            <option>EMEA region</option>
            <option>Americas region</option>
            <option>Selected partners</option>
          </select>
        </label>
        {form.target === "Selected partners" && (
          <label className="text-xs">Selected partner names or IDs
            <input className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.selectedPartners} onChange={e => setForm({ ...form, selectedPartners: e.target.value })} placeholder="p1, Priya Shah" />
          </label>
        )}
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.email} onChange={e => setForm({ ...form, email: e.target.checked })} />Also send via email</label>
      </FormDialog>
    </>
  );
}

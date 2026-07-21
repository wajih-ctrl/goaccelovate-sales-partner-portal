import { createFileRoute } from "@tanstack/react-router";
import { Download, MessageCircle, Paperclip, Plus, Send } from "lucide-react";
import { useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { FormDialog } from "@/components/common/dialogs";
import { PageContainer, PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isAnnouncementTargeted } from "@/lib/announcements";
import type { AnnouncementReaction } from "@/lib/domain";
import { validateAnnouncementFile } from "@/lib/file-upload";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_app/announcements")({ component: AnnouncementsPage });

type AnnouncementPriority = "General" | "Important";
type Reaction = AnnouncementReaction["reaction"];
const REACTIONS: Reaction[] = ["Like", "Celebrate", "Insightful"];

function PriorityBadge({ priority }: { priority: string }) {
  const style =
    priority === "Important"
      ? "border-warning/30 bg-warning/10 text-warning-foreground"
      : "border-border bg-secondary text-secondary-foreground";
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${style}`}
    >
      {priority}
    </span>
  );
}

function AnnouncementsPage() {
  const { user } = useAuth();
  const {
    announcements,
    partners,
    settings,
    publishAnnouncement,
    addAnnouncementComment,
    setAnnouncementReaction,
    markAnnouncementRead,
  } = useStore();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [open, setOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    title: "",
    body: "",
    priority: "General" as AnnouncementPriority,
    target: "All Sales Partners",
    selectedPartnerIds: [] as string[],
    attachment: null as File | null,
  });
  const partner = user?.partnerId ? partners.find((item) => item.id === user.partnerId) : undefined;
  const visibleAnnouncements = useMemo(
    () =>
      isAdmin
        ? announcements
        : announcements.filter((item) => isAnnouncementTargeted(item, partner)),
    [announcements, isAdmin, partner],
  );

  const chooseAttachment = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file) {
      const error = validateAnnouncementFile(file, settings.announcementAttachmentMaxBytes);
      if (error) {
        toast.error(error);
        event.target.value = "";
        return;
      }
    }
    setForm((current) => ({ ...current, attachment: file }));
  };

  const openAttachment = async (bucket?: string, path?: string) => {
    if (!supabase || !bucket || !path) return;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Unable to open this attachment. Please try again.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const resetForm = () =>
    setForm({
      title: "",
      body: "",
      priority: "General",
      target: "All Sales Partners",
      selectedPartnerIds: [],
      attachment: null,
    });

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Important business updates from the GoAccelovate partner program."
        actions={
          isAdmin ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New announcement
            </Button>
          ) : null
        }
      />
      <PageContainer>
        <div className="mx-auto grid max-w-3xl gap-4">
          {visibleAnnouncements.length === 0 && (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              No announcements yet.
            </Card>
          )}
          {visibleAnnouncements.map((announcement) => {
            const unread = Boolean(
              user?.partnerId && !announcement.readBy.includes(user.partnerId),
            );
            const myReaction = announcement.reactions.find(
              (item) => item.actorId === user?.id,
            )?.reaction;
            return (
              <Card
                key={announcement.id}
                className={`overflow-hidden ${unread ? "ring-2 ring-brand/30" : ""}`}
              >
                <article className="p-4 sm:p-5">
                  <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold sm:text-lg">{announcement.title}</h2>
                        <PriorityBadge priority={announcement.priority} />
                        {unread && (
                          <span className="text-[11px] font-semibold text-brand">NEW</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        GoAccelovate · {new Date(announcement.date).toLocaleString()}
                      </p>
                    </div>
                    {!isAdmin && unread && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markAnnouncementRead(announcement.id, user!.partnerId!)}
                      >
                        Mark read
                      </Button>
                    )}
                  </header>

                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground/85">
                    {announcement.body}
                  </p>
                  {announcement.attachmentName && (
                    <button
                      type="button"
                      onClick={() =>
                        openAttachment(announcement.attachmentBucket, announcement.attachmentPath)
                      }
                      className="mt-4 flex w-full items-center gap-3 rounded-md border bg-accent/20 p-3 text-left text-sm hover:bg-accent/40"
                    >
                      <Paperclip className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{announcement.attachmentName}</span>
                      <Download className="h-4 w-4 shrink-0" />
                    </button>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-y py-3">
                    {REACTIONS.map((reaction) => {
                      const count = announcement.reactions.filter(
                        (item) => item.reaction === reaction,
                      ).length;
                      return (
                        <Button
                          key={reaction}
                          size="sm"
                          variant={myReaction === reaction ? "default" : "ghost"}
                          onClick={() =>
                            void setAnnouncementReaction(
                              announcement.id,
                              myReaction === reaction ? null : reaction,
                            )
                          }
                        >
                          {reaction}
                          {count > 0 ? ` ${count}` : ""}
                        </Button>
                      );
                    })}
                    <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageCircle className="h-4 w-4" /> {announcement.comments.length}
                    </span>
                  </div>

                  {announcement.comments.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {announcement.comments.map((comment) => (
                        <div key={comment.id} className="rounded-md bg-accent/30 px-3 py-2 text-sm">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <strong>{comment.actorName}</strong>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(comment.date).toLocaleString()}
                            </span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-foreground/80">
                            {comment.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex items-end gap-2">
                    <label className="min-w-0 flex-1 text-xs">
                      Reply
                      <textarea
                        rows={2}
                        value={comments[announcement.id] || ""}
                        onChange={(event) =>
                          setComments((current) => ({
                            ...current,
                            [announcement.id]: event.target.value,
                          }))
                        }
                        className="mt-1 w-full resize-none rounded-md border bg-background p-2 text-sm"
                        placeholder="Write a comment..."
                      />
                    </label>
                    <Button
                      size="icon"
                      title="Post reply"
                      disabled={
                        commentingId === announcement.id ||
                        !(comments[announcement.id] || "").trim()
                      }
                      onClick={async () => {
                        setCommentingId(announcement.id);
                        const saved = await addAnnouncementComment(
                          announcement.id,
                          comments[announcement.id] || "",
                        );
                        setCommentingId(null);
                        if (saved)
                          setComments((current) => ({ ...current, [announcement.id]: "" }));
                      }}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </article>
              </Card>
            );
          })}
        </div>
      </PageContainer>

      <FormDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next && !publishing) resetForm();
        }}
        title="Create announcement"
        description="Publish an important business update to the selected portal audience."
        submitLabel={publishing ? "Publishing..." : "Publish"}
        canSubmit={
          !publishing &&
          Boolean(form.title.trim()) &&
          Boolean(form.body.trim()) &&
          (form.target !== "Selected Sales Partners" || form.selectedPartnerIds.length > 0)
        }
        onSubmit={async () => {
          setPublishing(true);
          const target =
            form.target === "Selected Sales Partners"
              ? `Selected Sales Partners: ${form.selectedPartnerIds.join(",")}`
              : form.target;
          const saved = await publishAnnouncement(
            {
              title: form.title.trim(),
              body: form.body.trim(),
              priority: form.priority,
              target,
              attachmentFile: form.attachment || undefined,
            },
            user!.name,
          );
          setPublishing(false);
          if (!saved) return;
          toast.success("Announcement published.");
          setOpen(false);
          resetForm();
        }}
      >
        <label className="text-xs">
          Title
          <input
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </label>
        <label className="text-xs">
          Announcement
          <textarea
            rows={5}
            className="mt-1 w-full rounded-md border bg-background p-3 text-sm"
            value={form.body}
            onChange={(event) => setForm({ ...form, body: event.target.value })}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs">
            Priority
            <select
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.priority}
              onChange={(event) =>
                setForm({ ...form, priority: event.target.value as AnnouncementPriority })
              }
            >
              <option>General</option>
              <option>Important</option>
            </select>
          </label>
          <label className="text-xs">
            Audience
            <select
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.target}
              onChange={(event) =>
                setForm({ ...form, target: event.target.value, selectedPartnerIds: [] })
              }
            >
              <option>All Portal Partners</option>
              <option>All Admin Users</option>
              <option>All Sales Partners</option>
              <option>Selected Sales Partners</option>
            </select>
          </label>
        </div>
        {form.target === "Selected Sales Partners" && (
          <label className="text-xs">
            Sales Partners
            <select
              multiple
              className="mt-1 min-h-32 w-full rounded-md border bg-background p-2 text-sm"
              value={form.selectedPartnerIds}
              onChange={(event) =>
                setForm({
                  ...form,
                  selectedPartnerIds: Array.from(
                    event.target.selectedOptions,
                    (option) => option.value,
                  ),
                })
              }
            >
              {partners
                .filter((item) => item.status === "Active")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.email})
                  </option>
                ))}
            </select>
            <span className="mt-1 block text-muted-foreground">
              Use Ctrl or Command to select multiple partners.
            </span>
          </label>
        )}
        <label className="text-xs">
          Attachment (optional)
          <input
            type="file"
            className="mt-1 block w-full rounded-md border bg-background p-2 text-sm"
            onChange={chooseAttachment}
          />
          <span className="mt-1 block text-muted-foreground">
            Maximum {(settings.announcementAttachmentMaxBytes / 1024 / 1024).toFixed(0)} MB. The
            limit is configurable in portal settings.
          </span>
        </label>
      </FormDialog>
    </>
  );
}

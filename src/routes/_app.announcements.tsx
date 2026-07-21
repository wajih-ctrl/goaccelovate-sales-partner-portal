import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import {
  AtSign,
  BellRing,
  Check,
  Download,
  FileText,
  ImageIcon,
  Lightbulb,
  MessageCircle,
  Paperclip,
  PartyPopper,
  Plus,
  Send,
  SmilePlus,
  ThumbsUp,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { FormDialog } from "@/components/common/dialogs";
import { PageContainer, PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { isAnnouncementTargeted } from "@/lib/announcements";
import { useAuth } from "@/lib/auth";
import type { Announcement, AnnouncementReaction, Role, User } from "@/lib/domain";
import { validateAnnouncementFile } from "@/lib/file-upload";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_app/announcements")({ component: AnnouncementsPage });

type AnnouncementPriority = "General" | "Important";
type Reaction = AnnouncementReaction["reaction"];
type MentionCandidate = Pick<User, "id" | "name" | "role" | "avatar">;
type MentionRow = {
  id: string;
  display_name: string;
  role: Role;
  avatar_url: string | null;
};

const REACTIONS: Array<{ value: Reaction; label: string; icon: LucideIcon }> = [
  { value: "Like", label: "Like", icon: ThumbsUp },
  { value: "Celebrate", label: "Celebrate", icon: PartyPopper },
  { value: "Insightful", label: "Insightful", icon: Lightbulb },
];

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  partner: "Sales Partner",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function Avatar({
  name,
  avatar,
  size = "md",
}: {
  name: string;
  avatar?: string;
  size?: "sm" | "md";
}) {
  const dimensions = size === "sm" ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-xs";
  return avatar ? (
    <img src={avatar} alt="" className={`${dimensions} shrink-0 rounded-full object-cover`} />
  ) : (
    <span
      className={`${dimensions} inline-flex shrink-0 items-center justify-center rounded-full bg-zinc-900 font-semibold text-white`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

function BrandAvatar() {
  return (
    <span
      className="h-11 w-11 shrink-0 rounded-md bg-black bg-no-repeat"
      style={{
        backgroundImage: "url('/Tagline-Version.png')",
        backgroundPosition: "-23px center",
        backgroundSize: "187px 44px",
      }}
      aria-label="GoAccelovate"
      role="img"
    />
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  return priority === "Important" ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
      <BellRing className="h-3 w-3" /> Important
    </span>
  ) : (
    <span className="inline-flex rounded-full border bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
      General
    </span>
  );
}

function audienceLabel(target: string) {
  if (target === "all_users") return "All Portal Partners";
  if (target === "staff_roles") return "All Admin Users";
  if (target === "selected_partners") return "Selected Sales Partners";
  return "All Sales Partners";
}

function relativeDate(value: string) {
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

function renderCommentBody(body: string): ReactNode {
  return body.split(/(@\[[^\]]+\])/g).map((part, index) => {
    const match = part.match(/^@\[([^\]]+)\]$/);
    return match ? (
      <span key={`${part}-${index}`} className="rounded bg-sky-100 px-1 font-medium text-sky-800">
        @{match[1]}
      </span>
    ) : (
      part
    );
  });
}

function formatFileSize(bytes?: number) {
  if (!bytes) return "Attachment";
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function useSignedAttachment(announcement: Announcement) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!supabase || !announcement.attachmentBucket || !announcement.attachmentPath) {
      setSignedUrl(null);
      return;
    }
    void supabase.storage
      .from(announcement.attachmentBucket)
      .createSignedUrl(announcement.attachmentPath, 60 * 10)
      .then(({ data }) => {
        if (active) setSignedUrl(data?.signedUrl || null);
      });
    return () => {
      active = false;
    };
  }, [announcement.attachmentBucket, announcement.attachmentPath]);

  return signedUrl;
}

function AnnouncementAttachment({ announcement }: { announcement: Announcement }) {
  const signedUrl = useSignedAttachment(announcement);
  if (!announcement.attachmentName) return null;
  const isImage = announcement.attachmentType?.startsWith("image/");

  if (isImage && signedUrl) {
    return (
      <a
        href={signedUrl}
        target="_blank"
        rel="noreferrer"
        className="group mt-4 block overflow-hidden rounded-md border bg-zinc-50"
      >
        <img
          src={signedUrl}
          alt={announcement.attachmentName}
          className="max-h-[440px] w-full object-contain transition-transform duration-300 group-hover:scale-[1.01]"
        />
        <span className="flex items-center gap-2 border-t bg-white px-3 py-2 text-xs text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
          <span className="min-w-0 flex-1 truncate">{announcement.attachmentName}</span>
          <span>{formatFileSize(announcement.attachmentSize)}</span>
          <Download className="h-4 w-4 text-foreground" />
        </span>
      </a>
    );
  }

  return (
    <a
      href={signedUrl || undefined}
      target="_blank"
      rel="noreferrer"
      aria-disabled={!signedUrl}
      className={`mt-4 flex items-center gap-3 rounded-md border bg-zinc-50 p-3 text-left text-sm transition-colors ${signedUrl ? "hover:border-zinc-400 hover:bg-zinc-100" : "cursor-wait opacity-70"}`}
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-white shadow-sm">
        <FileText className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{announcement.attachmentName}</span>
        <span className="text-xs text-muted-foreground">
          {signedUrl ? formatFileSize(announcement.attachmentSize) : "Preparing preview..."}
        </span>
      </span>
      <Download className="h-4 w-4 shrink-0" />
    </a>
  );
}

function DraftAttachmentPreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="relative overflow-hidden rounded-md border bg-zinc-50">
      {previewUrl ? (
        <img src={previewUrl} alt="Attachment preview" className="max-h-48 w-full object-contain" />
      ) : (
        <div className="flex items-center gap-3 p-3 text-sm">
          <FileText className="h-5 w-5" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
        </div>
      )}
      <Button
        type="button"
        size="icon"
        variant="secondary"
        title="Remove attachment"
        className="absolute right-2 top-2 h-8 w-8 shadow"
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function AnnouncementsPage() {
  const { user } = useAuth();
  const {
    announcements,
    partners,
    settings,
    staffUsers,
    publishAnnouncement,
    addAnnouncementComment,
    setAnnouncementReaction,
    markAnnouncementRead,
  } = useStore();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [open, setOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [reactingKey, setReactingKey] = useState<string | null>(null);
  const [reactionPickerId, setReactionPickerId] = useState<string | null>(null);
  const [mentionPickerId, setMentionPickerId] = useState<string | null>(null);
  const [loadingMentionsId, setLoadingMentionsId] = useState<string | null>(null);
  const [mentionCandidates, setMentionCandidates] = useState<Record<string, MentionCandidate[]>>(
    {},
  );
  const [mentionedUsers, setMentionedUsers] = useState<Record<string, string[]>>({});
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

  const resetForm = () =>
    setForm({
      title: "",
      body: "",
      priority: "General",
      target: "All Sales Partners",
      selectedPartnerIds: [],
      attachment: null,
    });

  const toggleMentionPicker = async (announcementId: string) => {
    setReactionPickerId(null);
    if (mentionPickerId === announcementId) {
      setMentionPickerId(null);
      return;
    }
    setMentionPickerId(announcementId);
    if (mentionCandidates[announcementId]) return;
    setLoadingMentionsId(announcementId);

    if (supabase) {
      const announcementClient = supabase as unknown as {
        rpc: (
          name: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: MentionRow[] | null; error: { message: string } | null }>;
      };
      const { data, error } = await announcementClient.rpc("get_announcement_mention_candidates", {
        target_announcement: announcementId,
      });
      setLoadingMentionsId(null);
      if (error) {
        toast.error("Unable to load mention suggestions.");
        return;
      }
      setMentionCandidates((current) => ({
        ...current,
        [announcementId]: (data || []).map((item) => ({
          id: item.id,
          name: item.display_name,
          role: item.role,
          avatar: item.avatar_url || undefined,
        })),
      }));
      return;
    }

    setLoadingMentionsId(null);
    setMentionCandidates((current) => ({
      ...current,
      [announcementId]: staffUsers.filter((item) => item.id !== user?.id),
    }));
  };

  const insertMention = (announcementId: string, candidate: MentionCandidate) => {
    const marker = `@[${candidate.name}]`;
    setComments((current) => {
      const existing = current[announcementId] || "";
      const spacer = existing && !existing.endsWith(" ") ? " " : "";
      return { ...current, [announcementId]: `${existing}${spacer}${marker} ` };
    });
    setMentionedUsers((current) => ({
      ...current,
      [announcementId]: Array.from(new Set([...(current[announcementId] || []), candidate.id])),
    }));
    setMentionPickerId(null);
  };

  const postComment = async (announcementId: string) => {
    const body = (comments[announcementId] || "").trim();
    if (!body || commentingId) return;
    const candidates = mentionCandidates[announcementId] || [];
    const activeMentionIds = (mentionedUsers[announcementId] || []).filter((id) => {
      const candidate = candidates.find((item) => item.id === id);
      return candidate ? body.includes(`@[${candidate.name}]`) : false;
    });
    setCommentingId(announcementId);
    const saved = await addAnnouncementComment(announcementId, body, activeMentionIds);
    setCommentingId(null);
    if (!saved) return;
    setComments((current) => ({ ...current, [announcementId]: "" }));
    setMentionedUsers((current) => ({ ...current, [announcementId]: [] }));
  };

  const handleCommentKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>, id: string) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void postComment(id);
    }
  };

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
        <div className="mx-auto max-w-5xl overflow-hidden rounded-md border bg-white shadow-card">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold"># partner-announcements</span>
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                Official updates, decisions, and partner program news
              </p>
            </div>
            <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <Users className="h-4 w-4" /> Portal community
            </div>
          </div>

          <div className="divide-y">
            {visibleAnnouncements.length === 0 && (
              <div className="px-6 py-16 text-center">
                <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium">No announcements yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  New program updates will appear here.
                </p>
              </div>
            )}

            {visibleAnnouncements.map((announcement) => {
              const unread = Boolean(
                user?.partnerId && !announcement.readBy.includes(user.partnerId),
              );
              const myReaction = announcement.reactions.find(
                (item) => item.actorId === user?.id,
              )?.reaction;
              const candidates = mentionCandidates[announcement.id] || [];
              return (
                <article
                  key={announcement.id}
                  className={`relative px-4 py-5 transition-colors sm:px-5 ${unread ? "bg-sky-50/45" : "bg-white"}`}
                >
                  {unread && <span className="absolute left-0 top-0 h-full w-1 bg-sky-500" />}
                  <div className="flex gap-3 sm:gap-4">
                    <BrandAvatar />
                    <div className="min-w-0 flex-1">
                      <header className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">GoAccelovate Team</span>
                            <PriorityBadge priority={announcement.priority} />
                            {unread && (
                              <span className="rounded bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                NEW
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                            <time title={new Date(announcement.date).toLocaleString()}>
                              {relativeDate(announcement.date)}
                            </time>
                            <span aria-hidden="true">·</span>
                            <span>{audienceLabel(announcement.target)}</span>
                          </div>
                        </div>
                        {!isAdmin && unread && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            onClick={() => markAnnouncementRead(announcement.id, user!.partnerId!)}
                          >
                            <Check className="mr-1 h-3.5 w-3.5" /> Mark read
                          </Button>
                        )}
                      </header>

                      <h2 className="mt-3 text-base font-semibold sm:text-lg">
                        {announcement.title}
                      </h2>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                        {announcement.body}
                      </p>
                      <AnnouncementAttachment announcement={announcement} />

                      <div className="relative mt-4 flex flex-wrap items-center gap-1.5">
                        {REACTIONS.map(({ value, label, icon: Icon }) => {
                          const count = announcement.reactions.filter(
                            (item) => item.reaction === value,
                          ).length;
                          if (!count && myReaction !== value) return null;
                          return (
                            <button
                              key={value}
                              type="button"
                              title={label}
                              disabled={reactingKey === `${announcement.id}:${value}`}
                              onClick={async () => {
                                setReactingKey(`${announcement.id}:${value}`);
                                await setAnnouncementReaction(
                                  announcement.id,
                                  myReaction === value ? null : value,
                                );
                                setReactingKey(null);
                              }}
                              className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors ${myReaction === value ? "border-sky-300 bg-sky-50 text-sky-800" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
                            >
                              <Icon className="h-3.5 w-3.5" /> {count}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          title="Add reaction"
                          onClick={() => {
                            setMentionPickerId(null);
                            setReactionPickerId((current) =>
                              current === announcement.id ? null : announcement.id,
                            );
                          }}
                          className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-white px-2.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-50"
                        >
                          <SmilePlus className="h-3.5 w-3.5" /> React
                        </button>
                        <span className="ml-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageCircle className="h-3.5 w-3.5" />
                          {announcement.comments.length}
                        </span>
                        {reactionPickerId === announcement.id && (
                          <div className="absolute bottom-10 left-0 z-20 flex gap-1 rounded-md border bg-white p-1.5 shadow-elevated">
                            {REACTIONS.map(({ value, label, icon: Icon }) => (
                              <button
                                key={value}
                                type="button"
                                title={label}
                                className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs hover:bg-zinc-100"
                                onClick={async () => {
                                  setReactionPickerId(null);
                                  setReactingKey(`${announcement.id}:${value}`);
                                  await setAnnouncementReaction(
                                    announcement.id,
                                    myReaction === value ? null : value,
                                  );
                                  setReactingKey(null);
                                }}
                              >
                                <Icon className="h-4 w-4" /> {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {announcement.comments.length > 0 && (
                        <div className="mt-4 space-y-3 border-l-2 border-zinc-100 pl-3 sm:pl-4">
                          {announcement.comments.map((comment) => (
                            <div key={comment.id} className="flex gap-2.5">
                              <Avatar name={comment.actorName} size="sm" />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-x-2">
                                  <strong className="text-sm">{comment.actorName}</strong>
                                  <time
                                    className="text-[11px] text-muted-foreground"
                                    title={new Date(comment.date).toLocaleString()}
                                  >
                                    {relativeDate(comment.date)}
                                  </time>
                                </div>
                                <p className="mt-0.5 whitespace-pre-wrap text-sm leading-5 text-zinc-700">
                                  {renderCommentBody(comment.body)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="relative mt-4 flex gap-2.5">
                        <Avatar
                          name={user?.name || "Portal user"}
                          avatar={user?.avatar}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1 rounded-md border bg-white shadow-sm focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-100">
                          <textarea
                            rows={2}
                            aria-label={`Reply to ${announcement.title}`}
                            value={comments[announcement.id] || ""}
                            onChange={(event) =>
                              setComments((current) => ({
                                ...current,
                                [announcement.id]: event.target.value,
                              }))
                            }
                            onKeyDown={(event) => handleCommentKeyDown(event, announcement.id)}
                            className="block w-full resize-none border-0 bg-transparent px-3 pt-2.5 text-sm outline-none"
                            placeholder="Reply to this announcement..."
                          />
                          <div className="flex items-center justify-between border-t px-1.5 py-1">
                            <button
                              type="button"
                              title="Mention someone"
                              onClick={() => void toggleMentionPicker(announcement.id)}
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${mentionPickerId === announcement.id ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100"}`}
                            >
                              <AtSign className="h-4 w-4" />
                            </button>
                            <div className="flex items-center gap-2">
                              <span className="hidden text-[10px] text-muted-foreground sm:inline">
                                Enter to send
                              </span>
                              <Button
                                size="icon"
                                title="Post reply"
                                className="h-7 w-7"
                                disabled={
                                  commentingId === announcement.id ||
                                  !(comments[announcement.id] || "").trim()
                                }
                                onClick={() => void postComment(announcement.id)}
                              >
                                <Send className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {mentionPickerId === announcement.id && (
                          <div className="absolute bottom-10 left-10 z-20 w-[min(19rem,calc(100vw-5rem))] overflow-hidden rounded-md border bg-white shadow-elevated">
                            <div className="border-b px-3 py-2 text-xs font-semibold">
                              Mention someone
                            </div>
                            <div className="max-h-56 overflow-y-auto p-1">
                              {loadingMentionsId === announcement.id ? (
                                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                                  Loading people...
                                </div>
                              ) : candidates.length ? (
                                candidates.map((candidate) => (
                                  <button
                                    key={candidate.id}
                                    type="button"
                                    onClick={() => insertMention(announcement.id, candidate)}
                                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-zinc-100"
                                  >
                                    <Avatar
                                      name={candidate.name}
                                      avatar={candidate.avatar}
                                      size="sm"
                                    />
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-medium">
                                        {candidate.name}
                                      </span>
                                      <span className="block text-[11px] text-muted-foreground">
                                        {ROLE_LABEL[candidate.role]}
                                      </span>
                                    </span>
                                  </button>
                                ))
                              ) : (
                                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                                  No people available to mention.
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
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
            placeholder="What does the community need to know?"
          />
        </label>
        <label className="text-xs">
          Announcement
          <textarea
            rows={5}
            className="mt-1 w-full rounded-md border bg-background p-3 text-sm"
            value={form.body}
            onChange={(event) => setForm({ ...form, body: event.target.value })}
            placeholder="Write the update with enough context for partners to act on it."
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
          <span className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed bg-zinc-50 px-3 py-4 text-sm text-zinc-600 transition-colors hover:border-zinc-400 hover:bg-zinc-100">
            <Paperclip className="h-4 w-4" /> Add an image or document
            <input type="file" className="sr-only" onChange={chooseAttachment} />
          </span>
          <span className="mt-1 block text-muted-foreground">
            Maximum {(settings.announcementAttachmentMaxBytes / 1024 / 1024).toFixed(0)} MB. The
            limit is configurable in portal settings.
          </span>
        </label>
        {form.attachment && (
          <DraftAttachmentPreview
            file={form.attachment}
            onRemove={() => setForm((current) => ({ ...current, attachment: null }))}
          />
        )}
        {(form.title.trim() || form.body.trim()) && (
          <div className="rounded-md border bg-zinc-50 p-3">
            <div className="mb-2 text-[10px] font-semibold uppercase text-muted-foreground">
              Live preview
            </div>
            <div className="flex gap-3">
              <BrandAvatar />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">GoAccelovate Team</span>
                  <PriorityBadge priority={form.priority} />
                </div>
                <h3 className="mt-2 text-sm font-semibold">{form.title || "Announcement title"}</h3>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-zinc-600">
                  {form.body || "Your update will appear here."}
                </p>
              </div>
            </div>
          </div>
        )}
      </FormDialog>
    </>
  );
}

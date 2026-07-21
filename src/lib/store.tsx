/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useAuth } from "./auth";
import {
  buildStoragePath,
  STORAGE_BUCKETS,
  validateAnnouncementFile,
  validateUploadFile,
} from "./file-upload";
import type { Json } from "./database.types";
import { isSupabaseConfigured, supabase } from "./supabase";
import { isAnnouncementTargeted } from "./announcements";
import { canMoveLeadStage, INDUSTRIES, isCommercialStage, LEAD_STAGES } from "./program";
import {
  ONBOARDING_STEPS,
  fmtCurrency,
  type Partner,
  type Lead,
  type LeadStage,
  type LeadStatus,
  type Commission,
  type CommissionState,
  type Payout,
  type ClientPayment,
  type DiscoveryCall,
  type ActivityEntry,
  type Announcement,
  type Notification,
  type AuditEntry,
  type User,
  type Tier,
} from "./domain";

export interface Settings {
  defaultRate: number;
  defaultRates: Record<Tier, number>;
  staleThreshold: number;
  payoutWindow: number;
  invitationExpiry: number;
  currency: string;
  currencies: string[];
  industries: string[];
  pipelineLabels: string[];
  onboardingSteps: string[];
  tierLabels: string[];
  announcementAttachmentMaxBytes: number;
  welcomeIntroVideoUrl: string;
}

export interface InvitedUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "partner";
  commissionRate?: number;
  invitedDate: string;
  status: "Invited";
}

export interface PartnerDocument {
  id: string;
  partnerId: string;
  name: string;
  type: "Agreement" | "NDA" | "Commission Schedule" | "Compliance" | "Other";
  uploadedDate: string;
  uploadedBy: string;
  storageBucket?: string;
  storagePath?: string;
  private?: boolean;
}

export interface StoredAttachment {
  id: string;
  name: string;
  date: string;
  storageBucket?: string;
  storagePath?: string;
  private?: boolean;
}

interface AppState {
  hydrated: boolean;
  partners: Partner[];
  leads: Lead[];
  commissions: Commission[];
  payouts: Payout[];
  clientPayments: ClientPayment[];
  calls: DiscoveryCall[];
  activity: ActivityEntry[];
  announcements: Announcement[];
  notifications: Notification[];
  audit: AuditEntry[];
  onboarding: Record<string, Record<string, boolean>>;
  invites: InvitedUser[];
  staffUsers: User[];
  settings: Settings;
  attachments: Record<string, StoredAttachment[]>;
  partnerDocuments: Record<string, PartnerDocument[]>;
}

interface AppActions {
  // Leads
  addLead: (
    l: Omit<Lead, "id" | "createdAt" | "lastActivity" | "stage" | "status"> & {
      isDuplicate?: boolean;
    },
    actor: string,
  ) => Promise<Lead>;
  updateLeadStage: (id: string, stage: LeadStage, actor: string, reason?: string) => void;
  updateLeadStatus: (id: string, status: LeadStatus, actor: string, reason?: string) => void;
  updateOwnLead: (leadId: string, patch: Partial<Lead>) => Promise<boolean>;
  closeLeadWon: (id: string, confirmedValue: number, actor: string) => void;
  addComment: (
    leadId: string,
    text: string,
    actor: string,
    isPrivate?: boolean,
    mentionedUserIds?: string[],
  ) => Promise<boolean>;
  addAttachment: (
    leadId: string,
    file: File,
    actor: string,
    isPrivate?: boolean,
  ) => Promise<boolean>;
  deleteLead: (leadId: string, actor: string) => Promise<boolean>;
  updateEstimatedValue: (leadId: string, value: number, actor: string) => void;
  // Discovery calls
  addCall: (
    c: Omit<DiscoveryCall, "id"> & { attachmentFile?: File },
    actor: string,
  ) => Promise<boolean>;
  // Commissions
  overrideCommissionRate: (
    commissionId: string,
    newRate: number,
    actor: string,
    reason: string,
  ) => void;
  addManualCommission: (
    payload: {
      leadId: string;
      partnerId: string;
      kind: "Monthly Retainer" | "One-off Bonus";
      label: string;
      amount: number;
      rate?: number;
      notes?: string;
    },
    actor: string,
  ) => void;
  setCommissionState: (commissionId: string, state: CommissionState, actor: string) => void;
  waiveCommission: (commissionId: string, actor: string, reason: string) => void;
  // Payouts
  requestPayout: (
    partnerId: string,
    commissionIds: string[],
    payload: {
      amount: number;
      preferredBank: string;
      preferredMethod: "Bank Transfer" | "ACH Transfer" | "Wire Transfer";
      taxLiability: boolean;
      message: string;
    },
    actor: string,
  ) => Promise<boolean>;
  approvePayout: (payoutId: string, actor: string) => Promise<boolean>;
  rejectPayout: (payoutId: string, reason: string, actor: string) => Promise<boolean>;
  recordPayoutPayment: (
    payoutId: string,
    payload: { amount: number; method: string; reference: string; date: string },
    actor: string,
  ) => Promise<boolean>;
  // Client payments
  recordClientPayment: (
    payload: Omit<ClientPayment, "id"> & { triggerEligibility?: boolean },
    actor: string,
  ) => Promise<boolean>;
  // Announcements
  publishAnnouncement: (
    a: Omit<Announcement, "id" | "date" | "readBy" | "comments" | "reactions"> & {
      attachmentFile?: File;
    },
    actor: string,
  ) => Promise<boolean>;
  addAnnouncementComment: (
    announcementId: string,
    body: string,
    mentionedUserIds?: string[],
  ) => Promise<boolean>;
  setAnnouncementReaction: (
    announcementId: string,
    reaction: "Like" | "Celebrate" | "Insightful" | null,
  ) => Promise<boolean>;
  markAnnouncementRead: (id: string, partnerId: string) => void;
  // Notifications
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  // Users
  inviteUser: (
    payload: {
      id?: string;
      name: string;
      email: string;
      role: "admin" | "partner";
      commissionRate?: number;
      invitedDate?: string;
    },
    actor: string,
  ) => void;
  revokeInvitation: (id: string, actor: string) => void;
  suspendUser: (id: string, actor: string) => void;
  reactivateUser: (id: string, actor: string) => void;
  deleteUser: (id: string, actor: string) => void;
  changeUserRole: (id: string, role: "admin" | "partner", actor: string) => void;
  changePartnerTier: (id: string, tier: string, actor: string) => void;
  changePartnerRate: (id: string, rate: number, actor: string) => void;
  updatePartnerProfile: (id: string, patch: Partial<Partner>, actor?: string) => void;
  addPartnerDocument: (
    partnerId: string,
    payload: { file: File; type: PartnerDocument["type"]; private?: boolean },
    actor: string,
  ) => Promise<boolean>;
  downloadStoredFile: (
    bucket: string | undefined,
    path: string | undefined,
    name: string,
  ) => Promise<void>;
  setOnboardingStep: (partnerId: string, key: string, value: boolean, actor: string) => void;
  // Settings
  updateSettings: (patch: Partial<Settings>, actor: string) => void;
}

type Ctx = AppState & AppActions;

const StoreContext = createContext<Ctx | null>(null);

const nowIso = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Math.floor(Math.random() * 90000 + 10000)}`;

const DEFAULT_SETTINGS: Settings = {
  defaultRate: 10,
  defaultRates: { Associate: 8, Specialist: 10, Partner: 12 },
  staleThreshold: 21,
  payoutWindow: 30,
  invitationExpiry: 72,
  currency: "USD",
  currencies: ["USD", "EUR", "GBP", "JPY", "INR", "AED", "BRL"],
  industries: [...INDUSTRIES],
  pipelineLabels: [...LEAD_STAGES],
  onboardingSteps: ONBOARDING_STEPS.map((s) => s.label),
  tierLabels: ["Associate", "Specialist", "Partner"],
  announcementAttachmentMaxBytes: 2 * 1024 * 1024,
  welcomeIntroVideoUrl: "https://youtu.be/RaHdE6QYr98?si=9ZyHGdKMQ8gICvvr",
};

const EMPTY_ONBOARDING: Record<string, Record<string, boolean>> = {};
const EMPTY_ATTACHMENTS: Record<string, StoredAttachment[]> = {};
const EMPTY_PARTNER_DOCS: Record<string, PartnerDocument[]> = {};

const asPartnerStatus = (status: string): Partner["status"] => {
  if (status === "deactivated") return "Deactivated";
  if (status === "suspended") return "Suspended";
  if (status === "pending") return "Pending";
  return "Active";
};

const toDbPartnerStatus = (status?: Partner["status"]) => {
  if (status === "Deactivated") return "deactivated";
  if (status === "Suspended") return "suspended";
  if (status === "Pending") return "pending";
  if (status === "Active") return "active";
  return undefined;
};

type DisplayContext = {
  labels: Map<string, string>;
  payouts: Map<string, { label: string; amount: number }>;
};

const internalAuditKeys = new Set([
  "id",
  "actor_id",
  "partner_id",
  "lead_id",
  "requested_by",
  "approved_by",
  "created_by",
  "uploaded_by",
  "created_at",
  "updated_at",
  "user_agent",
  "ip_address",
]);

const humanizeText = (value: string, context: DisplayContext) => {
  let result = value;
  for (const [id, label] of context.labels) result = result.replaceAll(id, label);
  return result
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      "the related record",
    )
    .replace(/\s*[·:]\s*$/g, "")
    .trim();
};

const labelKey = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const parseJsonValue = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || !["{", "["].includes(trimmed[0])) return value;
  try {
    return parseJsonValue(JSON.parse(trimmed));
  } catch {
    return value;
  }
};

const unwrapAuditValue = (value: unknown): unknown => {
  const parsed = parseJsonValue(value);
  if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    Object.keys(parsed as Record<string, unknown>).length === 1 &&
    "value" in (parsed as Record<string, unknown>)
  ) {
    return unwrapAuditValue((parsed as Record<string, unknown>).value);
  }
  return parsed;
};

const formatAuditValue = (value: unknown, context: DisplayContext): string | undefined => {
  value = unwrapAuditValue(value);
  if (value == null) return undefined;
  if (typeof value === "string") return humanizeText(value, context);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => formatAuditValue(item, context))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    if (Object.keys(object).length === 1 && "value" in object) {
      return formatAuditValue(object.value, context);
    }
    return Object.entries(object)
      .filter(([key]) => !internalAuditKeys.has(key))
      .slice(0, 10)
      .map(([key, item]) => `${labelKey(key)}: ${formatAuditValue(item, context) || "None"}`)
      .join("; ");
  }
  return String(value);
};

const comparableAuditValue = (value: unknown) => JSON.stringify(unwrapAuditValue(value));

const formatAuditFieldValue = (key: string, value: unknown, context: DisplayContext) => {
  const parsed = unwrapAuditValue(value);
  if (typeof parsed === "number") {
    if (/rate|percentage/i.test(key)) return `${parsed}%`;
    if (/amount|value|commission|paid/i.test(key)) return fmtCurrency(parsed);
  }
  if (typeof parsed === "string" && /(_at|_date|date)$/i.test(key)) {
    const date = new Date(parsed);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  return formatAuditValue(parsed, context)?.replace(/[.!?]+$/g, "");
};

const describeAuditChanges = (
  oldValue: unknown,
  newValue: unknown,
  context: DisplayContext,
): string[] => {
  const oldParsed = unwrapAuditValue(oldValue);
  const newParsed = unwrapAuditValue(newValue);
  const oldObject =
    oldParsed && typeof oldParsed === "object" && !Array.isArray(oldParsed)
      ? (oldParsed as Record<string, unknown>)
      : null;
  const newObject =
    newParsed && typeof newParsed === "object" && !Array.isArray(newParsed)
      ? (newParsed as Record<string, unknown>)
      : null;

  if (!oldObject && !newObject) {
    const before = formatAuditValue(oldParsed, context);
    const after = formatAuditValue(newParsed, context);
    if (before && after && before !== after) return [`Value changed from ${before} to ${after}.`];
    if (after) return [`Recorded as ${after}.`];
    if (before) return [`Removed ${before}.`];
    return [];
  }

  const keys = new Set([...Object.keys(oldObject || {}), ...Object.keys(newObject || {})]);
  return [...keys]
    .filter((key) => !internalAuditKeys.has(key))
    .filter(
      (key) => comparableAuditValue(oldObject?.[key]) !== comparableAuditValue(newObject?.[key]),
    )
    .slice(0, 12)
    .map((key) => {
      const before = formatAuditFieldValue(key, oldObject?.[key], context);
      const after = formatAuditFieldValue(key, newObject?.[key], context);
      const field = labelKey(key);
      if (before && after) return `${field} changed from ${before} to ${after}.`;
      if (after) return `${field} set to ${after}.`;
      return `${field} was removed${before ? ` (previously ${before})` : ""}.`;
    });
};

const stringifyValue = (value: unknown) => {
  if (value == null) return undefined;
  return typeof value === "string" ? value : JSON.stringify(value);
};

function buildDisplayContext(data: {
  profiles: any[];
  partners: any[];
  leads: any[];
  commissions: any[];
  payouts: any[];
  calls: any[];
  payments: any[];
  invitations: any[];
}): DisplayContext {
  const labels = new Map<string, string>();
  data.profiles.forEach((row) => labels.set(row.id, row.full_name || row.email || "Portal user"));
  data.partners.forEach((row) => labels.set(row.id, row.name || row.email || "Sales Partner"));
  data.leads.forEach((row) => labels.set(row.id, row.company_name || row.public_id || "Lead"));
  data.invitations.forEach((row) => labels.set(row.id, row.email || "Pending invitation"));
  data.calls.forEach((row) => {
    const lead = labels.get(row.lead_id) || "lead";
    labels.set(row.id, `Discovery call for ${lead}`);
  });
  data.payments.forEach((row) => {
    const lead = labels.get(row.lead_id) || "lead";
    labels.set(row.id, `Client payment for ${lead}`);
  });
  data.commissions.forEach((row) => {
    const lead = labels.get(row.lead_id) || "lead";
    labels.set(row.id, `Commission for ${lead}`);
  });
  const payouts = new Map<string, { label: string; amount: number }>();
  data.payouts.forEach((row) => {
    const partner = labels.get(row.partner_id) || "Sales Partner";
    const label = `Payout request for ${partner}`;
    labels.set(row.id, label);
    payouts.set(row.id, { label, amount: Number(row.amount || 0) });
  });
  return { labels, payouts };
}

const publicId = (prefix: string) => `${prefix}-${Math.floor(Math.random() * 90000 + 10000)}`;

function announcementTarget(target: string, partners: Partner[]) {
  if (["All Portal Partners", "All portal users"].includes(target))
    return { target_type: "all_users", target_rules: {} };
  if (["All Admin Users", "Admin users"].includes(target))
    return { target_type: "staff_roles", target_rules: { roles: ["admin", "super_admin"] } };
  if (target === "Super Admin users")
    return { target_type: "staff_roles", target_rules: { roles: ["super_admin"] } };
  if (["All Sales Partners", "All partners"].includes(target))
    return { target_type: "all_partners", target_rules: {} };
  if (target === "Partner tier")
    return { target_type: "tier", target_rules: { tiers: ["Partner"] } };
  if (target === "Specialist tier")
    return { target_type: "tier", target_rules: { tiers: ["Specialist"] } };
  if (target === "Associate tier")
    return { target_type: "tier", target_rules: { tiers: ["Associate"] } };
  if (target === "APAC region")
    return {
      target_type: "region",
      target_rules: { countries: ["India", "Japan", "Vietnam", "China", "South Korea"] },
    };
  if (target === "EMEA region")
    return {
      target_type: "region",
      target_rules: {
        countries: ["Nigeria", "Italy", "United Kingdom", "Germany", "UAE", "Portugal", "France"],
      },
    };
  if (target === "Americas region")
    return {
      target_type: "region",
      target_rules: { countries: ["USA", "Brazil", "Mexico", "Chile"] },
    };
  if (target.startsWith("Selected partners:") || target.startsWith("Selected Sales Partners:")) {
    const raw = target.replace(/^Selected (?:Sales Partners|partners):/, "");
    const tokens = raw
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const partnerIds = partners
      .filter(
        (partner) =>
          tokens.includes(partner.id.toLowerCase()) || tokens.includes(partner.name.toLowerCase()),
      )
      .map((partner) => partner.id);
    return { target_type: "selected_partners", target_rules: { partner_ids: partnerIds } };
  }
  return { target_type: "all_partners", target_rules: {} };
}

function mapPartner(row: any): Partner {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || "",
    linkedin: row.linkedin || "",
    city: row.city || "",
    country: row.country || "",
    bio: row.bio || "",
    tier: row.tier,
    commissionRate: Number(row.commission_rate || 0),
    status: asPartnerStatus(row.status),
    assignedContact: row.assigned_contact || "",
    joinedDate: row.joined_date || row.created_at,
  };
}

function mapLead(row: any): Lead {
  return {
    id: row.id,
    company: row.company_name,
    contactName: row.contact_name,
    contactTitle: row.contact_title,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone || "",
    clientLinkedin: row.client_linkedin || undefined,
    country: row.country,
    industry: row.industry,
    estimatedValue: Number(row.estimated_value || 0),
    currency: row.currency,
    description: row.description,
    stage: row.stage,
    status: row.status,
    partnerId: row.partner_id,
    createdAt: row.created_at,
    lastActivity: row.last_activity_at,
    confirmedValue: row.confirmed_value == null ? undefined : Number(row.confirmed_value),
    duplicateReason: row.duplicate_reason || undefined,
    previousStage: row.previous_stage || undefined,
    stageAdminLocked: Boolean(row.stage_admin_locked),
    paymentCycle: Number(row.payment_cycle || 0),
  };
}

function mapCommission(row: any): Commission {
  return {
    id: row.id,
    leadId: row.lead_id,
    partnerId: row.partner_id,
    rate: Number(row.rate || 0),
    amount: Number(row.amount || 0),
    state: row.state,
    closedDate: row.closed_date || row.created_at,
    kind: row.kind,
    label: row.label || undefined,
    notes: row.override_reason || row.waived_reason || undefined,
    eligibleAmount: Number(row.eligible_amount || 0),
    paidAmount: Number(row.paid_amount || 0),
  };
}

function mapPayout(row: any, items: any[]): Payout {
  return {
    id: row.id,
    partnerId: row.partner_id,
    commissionIds: items
      .filter((item) => item.payout_request_id === row.id)
      .map((item) => item.commission_id),
    amount: Number(row.amount || 0),
    status: row.status,
    requestedDate: row.created_at,
    paidDate: row.paid_date || undefined,
    method: row.payment_method || undefined,
    reference: row.transaction_reference || undefined,
    message: row.message || undefined,
    rejectReason: row.reject_reason || undefined,
    preferredBank: row.preferred_bank || undefined,
    preferredMethod: row.preferred_payment_method || undefined,
    taxLiability: row.tax_liability == null ? undefined : Boolean(row.tax_liability),
  };
}

function mapClientPayment(row: any): ClientPayment {
  return {
    id: row.id,
    leadId: row.lead_id,
    amount: Number(row.amount_received || 0),
    date: row.received_date,
    reference: row.payment_reference,
    method: row.payment_method,
    notes: row.notes || undefined,
    paymentType: row.payment_type || undefined,
    paymentCycle: Number(row.payment_cycle || 0),
  };
}

function mapCall(row: any): DiscoveryCall {
  return {
    id: row.id,
    leadId: row.lead_id,
    date: row.call_at,
    duration: Number(row.duration_minutes || 0),
    attendees: row.goaccelovate_attendees,
    clientAttendees: row.client_attendees,
    partnerJoined: Boolean(row.partner_joined),
    summary: row.summary,
    outcomes: row.outcomes,
    nextSteps: row.next_steps,
    followUp: row.follow_up_date || "",
    attachmentName: row.recording_url || undefined,
    private: Boolean(row.is_private),
  };
}

function mapActivity(row: any): ActivityEntry {
  return {
    id: row.id,
    leadId: row.lead_id || undefined,
    type: row.type,
    user: row.actor_name,
    text: row.text,
    date: row.created_at,
    private: Boolean(row.is_private),
  };
}

function mapNotification(row: any, context: DisplayContext): Notification {
  const rawBody = String(row.body || "").trim();
  const payout = [...context.payouts.entries()].find(([id]) => rawBody.includes(id));
  let body = humanizeText(rawBody, context).replace(/\s+->\s+/g, " moved to ");
  if (payout && ["Payout request submitted", "New payout request"].includes(row.title)) {
    body = `${payout[1].label} totaling ${fmtCurrency(payout[1].amount)} is ready for review.`;
  } else if (/^[0-9a-f-]{30,}$/i.test(rawBody)) {
    const fallback: Record<string, string> = {
      "Invitation revoked": "The pending invitation was revoked.",
      "Account suspended": "The selected portal account was suspended.",
      "Account reactivated": "The selected portal account was reinstated.",
      "Account deleted": "The selected portal account was deleted.",
    };
    body = fallback[row.title] || "This portal record was updated.";
  }
  return {
    id: row.id,
    title: row.title,
    body,
    date: row.created_at,
    read: Boolean(row.read_at),
    type: row.type,
    mandatory: row.mandatory,
  };
}

function mapAnnouncement(row: any, reads: any[], comments: any[], reactions: any[]): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    priority: row.priority,
    target: row.target_type,
    date: row.published_at,
    readBy: reads.filter((read) => read.announcement_id === row.id).map((read) => read.partner_id),
    attachmentName: row.attachment_name || undefined,
    attachmentBucket: row.attachment_bucket || undefined,
    attachmentPath: row.attachment_path || undefined,
    attachmentType: row.attachment_type || undefined,
    attachmentSize: row.attachment_size == null ? undefined : Number(row.attachment_size),
    comments: comments
      .filter((comment) => comment.announcement_id === row.id)
      .map((comment) => ({
        id: comment.id,
        announcementId: comment.announcement_id,
        actorId: comment.actor_id,
        actorName: comment.actor_name,
        body: comment.body,
        date: comment.created_at,
        mentionedUserIds: comment.mentioned_user_ids || [],
      })),
    reactions: reactions
      .filter((reaction) => reaction.announcement_id === row.id)
      .map((reaction) => ({
        id: reaction.id,
        announcementId: reaction.announcement_id,
        actorId: reaction.actor_id,
        reaction: reaction.reaction,
      })),
  };
}

function mapAudit(row: any, context: DisplayContext): AuditEntry {
  const rawDetail = row.record_name || row.record_id || `${row.action} in ${row.module}`;
  const details =
    row.action === "Settings Updated"
      ? "Portal configuration"
      : humanizeText(String(rawDetail), context);
  return {
    id: row.id,
    user: row.actor_name,
    action: row.action,
    module: row.module,
    date: row.created_at,
    details,
    oldValue: formatAuditValue(row.old_value, context),
    newValue: formatAuditValue(row.new_value, context),
    changes: describeAuditChanges(row.old_value, row.new_value, context),
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export function mapStandaloneAudit(row: any): AuditEntry {
  return mapAudit(row, { labels: new Map(), payouts: new Map() });
}

function mapSettings(rows: any[]): Settings {
  const value = (key: string, fallback: unknown) =>
    rows.find((row) => row.key === key)?.value ?? fallback;

  const defaultRates = value("default_commission_rates", DEFAULT_SETTINGS.defaultRates) as Record<
    Tier,
    number
  >;

  return {
    ...DEFAULT_SETTINGS,
    defaultRate: defaultRates.Partner ?? DEFAULT_SETTINGS.defaultRate,
    defaultRates,
    staleThreshold: Number(value("lead_staleness_threshold_days", DEFAULT_SETTINGS.staleThreshold)),
    payoutWindow: Number(value("payout_window_days", DEFAULT_SETTINGS.payoutWindow)),
    invitationExpiry: Number(value("invitation_expiry_hours", DEFAULT_SETTINGS.invitationExpiry)),
    currencies: value("supported_currencies", DEFAULT_SETTINGS.currencies) as string[],
    currency:
      (value("supported_currencies", DEFAULT_SETTINGS.currencies) as string[])[0] ||
      DEFAULT_SETTINGS.currency,
    industries: value("industries", DEFAULT_SETTINGS.industries) as string[],
    pipelineLabels: value("pipeline_stage_labels", DEFAULT_SETTINGS.pipelineLabels) as string[],
    tierLabels: value("partner_tier_labels", DEFAULT_SETTINGS.tierLabels) as string[],
    announcementAttachmentMaxBytes: Number(
      value("announcement_attachment_max_bytes", DEFAULT_SETTINGS.announcementAttachmentMaxBytes),
    ),
    welcomeIntroVideoUrl: String(
      value("welcome_intro_video_url", DEFAULT_SETTINGS.welcomeIntroVideoUrl),
    ),
  };
}

function groupAttachments(rows: any[]) {
  return rows.reduce<Record<string, StoredAttachment[]>>((acc, row) => {
    acc[row.lead_id] = [
      ...(acc[row.lead_id] || []),
      {
        id: row.id,
        name: row.name,
        date: row.uploaded_at,
        storageBucket: row.storage_bucket,
        storagePath: row.storage_path,
        private: row.is_private,
      },
    ];
    return acc;
  }, {});
}

function groupPartnerDocuments(rows: any[]) {
  return rows.reduce<Record<string, PartnerDocument[]>>((acc, row) => {
    acc[row.partner_id] = [
      ...(acc[row.partner_id] || []),
      {
        id: row.id,
        partnerId: row.partner_id,
        name: row.name,
        type: row.document_type,
        uploadedDate: row.uploaded_at,
        uploadedBy: row.uploaded_by || "GoAccelovate",
        storageBucket: row.storage_bucket,
        storagePath: row.storage_path,
        private: row.is_private,
      },
    ];
    return acc;
  }, {});
}

function groupOnboarding(rows: any[]) {
  return rows.reduce<Record<string, Record<string, boolean>>>((acc, row) => {
    const key = row.onboarding_steps?.key;
    if (!key) return acc;
    acc[row.partner_id] = { ...(acc[row.partner_id] || {}), [key]: Boolean(row.completed) };
    return acc;
  }, {});
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user, ready, authMode } = useAuth();
  const businessUserId = user?.id;
  const businessUserRole = user?.role;
  const businessAgreementsComplete = user?.agreementsComplete;
  const realMode = ready && authMode === "supabase" && isSupabaseConfigured && Boolean(supabase);
  const [hydrated, setHydrated] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [clientPayments, setClientPayments] = useState<ClientPayment[]>([]);
  const [calls, setCalls] = useState<DiscoveryCall[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [onboarding, setOnboarding] = useState<Record<string, Record<string, boolean>>>({});
  const [invites, setInvites] = useState<InvitedUser[]>([]);
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [attachments, setAttachments] = useState<Record<string, StoredAttachment[]>>({});
  const [partnerDocuments, setPartnerDocuments] = useState<Record<string, PartnerDocument[]>>({});
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedAccessRef = useRef<{
    userId: string;
    role: User["role"];
    agreementsComplete?: boolean;
  } | null>(null);

  const clearBusinessState = useCallback(() => {
    setPartners([]);
    setLeads([]);
    setCommissions([]);
    setPayouts([]);
    setClientPayments([]);
    setCalls([]);
    setActivity([]);
    setAnnouncements([]);
    setNotifications([]);
    setAudit([]);
    setOnboarding(EMPTY_ONBOARDING);
    setInvites([]);
    setStaffUsers([]);
    setSettings(DEFAULT_SETTINGS);
    setAttachments(EMPTY_ATTACHMENTS);
    setPartnerDocuments(EMPTY_PARTNER_DOCS);
  }, []);

  const refreshSupabaseState = useCallback(async () => {
    if (!supabase || !businessUserId) return;
    const isPartner = businessUserRole === "partner";
    const isPreAgreementPartner = isPartner && businessAgreementsComplete !== true;
    const canViewAudit = businessUserRole === "super_admin";
    const skippedQuery = () => Promise.resolve({ data: [] as any[], error: null });

    const [
      partnersRes,
      leadsRes,
      commissionsRes,
      payoutRequestsRes,
      payoutItemsRes,
      clientPaymentsRes,
      callsRes,
      activityRes,
      announcementsRes,
      announcementReadsRes,
      announcementCommentsRes,
      announcementReactionsRes,
      notificationsRes,
      auditRes,
      onboardingRes,
      attachmentsRes,
      documentsRes,
      settingsRes,
      profilesRes,
      invitationsRes,
    ] = await Promise.all([
      supabase.from("partner_profiles").select("*").order("name"),
      isPreAgreementPartner
        ? skippedQuery()
        : supabase.from("leads").select("*").order("created_at", { ascending: false }),
      isPreAgreementPartner
        ? skippedQuery()
        : supabase.from("commissions").select("*").order("created_at", { ascending: false }),
      isPreAgreementPartner
        ? skippedQuery()
        : supabase.from("payout_requests").select("*").order("created_at", { ascending: false }),
      isPreAgreementPartner ? skippedQuery() : supabase.from("payout_request_items").select("*"),
      isPartner
        ? skippedQuery()
        : supabase.from("client_payments").select("*").order("created_at", { ascending: false }),
      isPreAgreementPartner
        ? skippedQuery()
        : supabase.from("discovery_calls").select("*").order("call_at", { ascending: false }),
      isPreAgreementPartner
        ? skippedQuery()
        : supabase.from("lead_activity_log").select("*").order("created_at", { ascending: false }),
      isPreAgreementPartner
        ? skippedQuery()
        : supabase.from("announcements").select("*").order("published_at", { ascending: false }),
      isPreAgreementPartner ? skippedQuery() : supabase.from("announcement_reads").select("*"),
      isPreAgreementPartner
        ? skippedQuery()
        : (supabase as any)
            .from("announcement_comments")
            .select("*")
            .order("created_at", { ascending: true }),
      isPreAgreementPartner
        ? skippedQuery()
        : (supabase as any).from("announcement_reactions").select("*"),
      supabase.from("notifications").select("*").order("created_at", { ascending: false }),
      canViewAudit
        ? supabase.from("audit_log").select("*").order("created_at", { ascending: false })
        : skippedQuery(),
      isPreAgreementPartner
        ? skippedQuery()
        : supabase
            .from("partner_onboarding_steps")
            .select("partner_id,completed,onboarding_steps(key)"),
      isPreAgreementPartner
        ? skippedQuery()
        : supabase.from("lead_attachments").select("*").order("uploaded_at", { ascending: false }),
      isPreAgreementPartner
        ? skippedQuery()
        : supabase.from("partner_documents").select("*").order("uploaded_at", { ascending: false }),
      isPreAgreementPartner ? skippedQuery() : supabase.from("settings").select("*"),
      isPartner
        ? skippedQuery()
        : supabase
            .from("profiles")
            .select("id,email,full_name,role,account_status,partner_id,avatar_url"),
      isPartner
        ? skippedQuery()
        : supabase
            .from("invitations")
            .select("*")
            .is("accepted_at", null)
            .is("revoked_at", null)
            .gt("expires_at", nowIso())
            .order("created_at", { ascending: false }),
    ]);

    const responses = [
      partnersRes,
      leadsRes,
      commissionsRes,
      payoutRequestsRes,
      payoutItemsRes,
      clientPaymentsRes,
      callsRes,
      activityRes,
      announcementsRes,
      announcementReadsRes,
      announcementCommentsRes,
      announcementReactionsRes,
      notificationsRes,
      auditRes,
      onboardingRes,
      attachmentsRes,
      documentsRes,
      settingsRes,
      profilesRes,
      invitationsRes,
    ];
    const firstError = responses.find((response) => response.error)?.error;
    if (firstError) throw firstError;

    const payoutItems = payoutItemsRes.data || [];
    const reads = announcementReadsRes.data || [];
    const announcementComments = announcementCommentsRes.data || [];
    const announcementReactions = announcementReactionsRes.data || [];
    const displayContext = buildDisplayContext({
      profiles: profilesRes.data || [],
      partners: partnersRes.data || [],
      leads: leadsRes.data || [],
      commissions: commissionsRes.data || [],
      payouts: payoutRequestsRes.data || [],
      calls: callsRes.data || [],
      payments: clientPaymentsRes.data || [],
      invitations: invitationsRes.data || [],
    });

    setPartners((partnersRes.data || []).filter((row: any) => !row.deleted_at).map(mapPartner));
    setLeads(
      (leadsRes.data || []).filter((row: any) => row.status !== "Duplicate Rejected").map(mapLead),
    );
    setCommissions((commissionsRes.data || []).map(mapCommission));
    setPayouts((payoutRequestsRes.data || []).map((row) => mapPayout(row, payoutItems)));
    setClientPayments((clientPaymentsRes.data || []).map(mapClientPayment));
    setCalls((callsRes.data || []).map(mapCall));
    setActivity((activityRes.data || []).map(mapActivity));
    setAnnouncements(
      (announcementsRes.data || []).map((row) =>
        mapAnnouncement(row, reads, announcementComments, announcementReactions),
      ),
    );
    setNotifications(
      (notificationsRes.data || []).map((row) => mapNotification(row, displayContext)),
    );
    setAudit((auditRes.data || []).map((row) => mapAudit(row, displayContext)));
    setOnboarding(groupOnboarding(onboardingRes.data || []));
    setAttachments(groupAttachments(attachmentsRes.data || []));
    setPartnerDocuments(groupPartnerDocuments(documentsRes.data || []));
    setSettings(mapSettings(settingsRes.data || []));
    setStaffUsers(
      (profilesRes.data || []).map((profile: any) => ({
        id: profile.id,
        name: profile.full_name || profile.email,
        email: profile.email,
        role: profile.role,
        accountStatus: profile.account_status,
        partnerId: profile.partner_id || undefined,
        avatar: profile.avatar_url || undefined,
      })),
    );
    const profilesByEmail = new Map(
      (profilesRes.data || []).map((profile: any) => [
        String(profile.email).toLowerCase(),
        profile,
      ]),
    );
    setInvites(
      (invitationsRes.data || []).map((invitation: any) => ({
        id: invitation.id,
        name:
          profilesByEmail.get(String(invitation.email).toLowerCase())?.full_name ||
          invitation.email,
        email: invitation.email,
        role: invitation.role,
        commissionRate:
          invitation.commission_rate == null ? undefined : Number(invitation.commission_rate),
        invitedDate: invitation.created_at,
        status: "Invited",
      })),
    );
  }, [businessAgreementsComplete, businessUserId, businessUserRole]);

  useEffect(() => {
    let active = true;
    if (!ready) {
      setHydrated(false);
      hydratedAccessRef.current = null;
      return () => {
        active = false;
      };
    }
    if (!realMode) {
      clearBusinessState();
      hydratedAccessRef.current = null;
      setHydrated(true);
      return () => {
        active = false;
      };
    }
    const previousAccess = hydratedAccessRef.current;
    const unlockingPartner =
      previousAccess !== null &&
      previousAccess.userId === businessUserId &&
      previousAccess.role === "partner" &&
      businessUserRole === "partner" &&
      previousAccess.agreementsComplete !== true &&
      businessAgreementsComplete === true;
    if (!unlockingPartner) setHydrated(false);
    refreshSupabaseState()
      .catch((error) => {
        console.error(error);
        toast.error("Unable to load Supabase business data.");
        clearBusinessState();
      })
      .finally(() => {
        if (active && businessUserId && businessUserRole) {
          hydratedAccessRef.current = {
            userId: businessUserId,
            role: businessUserRole,
            agreementsComplete: businessAgreementsComplete,
          };
          setHydrated(true);
        }
      });
    return () => {
      active = false;
    };
  }, [
    businessAgreementsComplete,
    businessUserId,
    businessUserRole,
    clearBusinessState,
    ready,
    realMode,
    refreshSupabaseState,
  ]);

  const handleWriteError = useCallback(
    (error: unknown, fallback = "Unable to save this change. Please try again.") => {
      console.error(error);
      const raw =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message || "")
          : error instanceof Error
            ? error.message
            : "";
      const message = /failed to fetch|network|load failed/i.test(raw)
        ? "The portal could not reach Supabase. Check your connection and try again."
        : /jwt|session|refresh token/i.test(raw)
          ? "Your session expired. Sign in again, then retry the action."
          : /row-level security|permission denied|not authorized/i.test(raw)
            ? "You do not have permission to make this change."
            : /duplicate key|already exists|unique constraint/i.test(raw)
              ? "This record already exists. Refresh the page and review the existing entry."
              : raw && !/^supabase write failed\.?$/i.test(raw)
                ? raw
                : fallback;
      toast.error(message);
    },
    [],
  );

  const reloadAfterWrite = useCallback(() => {
    if (!realMode) return;
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void refreshSupabaseState().catch((error) =>
        handleWriteError(error, "Unable to refresh data."),
      );
    }, 150);
  }, [handleWriteError, realMode, refreshSupabaseState]);

  useEffect(() => {
    if (!realMode || !supabase || !businessUserId) return;

    const client = supabase;
    const channel = client
      .channel(`business-live-${businessUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payout_requests" },
        (payload: any) => {
          const row = payload.eventType === "DELETE" ? payload.old : payload.new;
          if (!row?.id) return;

          if (payload.eventType === "DELETE") {
            setPayouts((current) => current.filter((payout) => payout.id !== row.id));
            return;
          }

          const mapped = mapPayout(row, []);
          setPayouts((current) => {
            const existing = current.find((payout) => payout.id === row.id);
            if (!existing) return current;
            return current.map((payout) =>
              payout.id === row.id ? { ...mapped, commissionIds: existing.commissionIds } : payout,
            );
          });

          if (payload.eventType === "INSERT") reloadAfterWrite();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "commissions" },
        (payload: any) => {
          const row = payload.eventType === "DELETE" ? payload.old : payload.new;
          if (!row?.id) return;

          if (payload.eventType === "DELETE") {
            setCommissions((current) => current.filter((commission) => commission.id !== row.id));
            return;
          }

          const mapped = mapCommission(row);
          setCommissions((current) => {
            const exists = current.some((commission) => commission.id === mapped.id);
            return exists
              ? current.map((commission) => (commission.id === mapped.id ? mapped : commission))
              : [mapped, ...current];
          });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "payout_request_items" }, () =>
        reloadAfterWrite(),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () =>
        reloadAfterWrite(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () =>
        reloadAfterWrite(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcement_comments" },
        () => reloadAfterWrite(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcement_reactions" },
        () => reloadAfterWrite(),
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [businessUserId, realMode, reloadAfterWrite]);

  useEffect(
    () => () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    },
    [],
  );

  const pushActivity = (entry: Omit<ActivityEntry, "id" | "date">) => {
    setActivity((a) => [{ ...entry, id: uid("A"), date: nowIso() }, ...a]);
    if (!realMode || !supabase) return;
    if (entry.type === "system" && entry.text.startsWith("Lead created:")) return;
    void supabase
      .from("lead_activity_log")
      .insert({
        lead_id: entry.leadId || null,
        type: entry.type,
        actor_id: user?.id || null,
        actor_name: entry.user,
        text: entry.text,
        is_private: Boolean(entry.private),
      })
      .then(({ error }) => {
        if (error) handleWriteError(error);
      });
  };

  const pushAudit = (entry: Omit<AuditEntry, "id" | "date" | "changes">) => {
    const context = { labels: new Map<string, string>(), payouts: new Map() };
    setAudit((a) => [
      {
        ...entry,
        id: uid("AU"),
        date: nowIso(),
        changes: describeAuditChanges(entry.oldValue, entry.newValue, context),
      },
      ...a,
    ]);
    if (!realMode || !supabase) return;
    if (entry.action === "Lead Submitted") return;
    void supabase
      .rpc("record_audit", {
        action: entry.action,
        module: entry.module,
        record_id: entry.details || undefined,
        record_name: entry.details || undefined,
        old_value: entry.oldValue ? { value: entry.oldValue } : null,
        new_value: entry.newValue ? { value: entry.newValue } : null,
      })
      .then(({ error }) => {
        if (error) handleWriteError(error);
      });
  };

  const notify = (n: Omit<Notification, "id" | "date" | "read">) => {
    if (realMode) return;
    setNotifications((ns) => [{ ...n, id: uid("N"), date: nowIso(), read: false }, ...ns]);
  };

  const notifyPartner = useCallback(
    async (partnerId: string, payload: Omit<Notification, "id" | "date" | "read">) => {
      if (!realMode || !supabase) {
        notify(payload);
        return;
      }
      const { error } = await supabase.from("notifications").insert({
        partner_id: partnerId,
        title: payload.title,
        body: payload.body,
        type: payload.type,
        mandatory: Boolean(payload.mandatory),
      });
      if (error) handleWriteError(error);
    },
    [handleWriteError, realMode],
  );

  const addLead: AppActions["addLead"] = useCallback(
    async (l, actor) => {
      if (realMode && supabase) {
        const id = crypto.randomUUID();
        const { data, error } = await (supabase as any).rpc("submit_partner_lead", {
          lead_id: id,
          company_name: l.company,
          contact_name: l.contactName,
          contact_title: l.contactTitle,
          contact_email: l.contactEmail,
          contact_phone: l.contactPhone,
          client_linkedin: l.clientLinkedin || null,
          country: l.country,
          industry: l.industry,
          estimated_value: l.estimatedValue,
          currency: l.currency,
          description: l.description,
        });
        if (error) {
          handleWriteError(error);
          throw error;
        }
        if (!data?.accepted || !data?.lead) {
          const duplicateError = new Error(
            data?.reason || "A lead with this contact email or phone number already exists.",
          );
          duplicateError.name = "DuplicateLeadError";
          throw duplicateError;
        }
        const realLead = mapLead(data.lead);
        setLeads((prev) => [realLead, ...prev.filter((item) => item.id !== realLead.id)]);
        setActivity((prev) => [
          {
            id: uid("A"),
            leadId: realLead.id,
            type: "system",
            user: "System",
            text: "Lead accepted automatically into Identified Opportunity",
            date: nowIso(),
          },
          ...prev,
        ]);
        setOnboarding((prev) => ({
          ...prev,
          [l.partnerId]: { ...(prev[l.partnerId] || {}), firstLead: true },
        }));
        setNotifications((prev) => [
          {
            id: uid("N"),
            title: "Lead accepted into pipeline",
            body: `${realLead.company} entered Identified Opportunity.`,
            type: "success",
            mandatory: false,
            read: false,
            date: nowIso(),
          },
          ...prev,
        ]);
        return realLead;
      }

      if (l.isDuplicate) {
        const duplicateError = new Error(
          "A lead with this contact email or phone number already exists.",
        );
        duplicateError.name = "DuplicateLeadError";
        throw duplicateError;
      }
      const id = `L-${1100 + Math.floor(Math.random() * 9000)}`;
      const status: LeadStatus = "Open";
      const lead: Lead = {
        ...l,
        id,
        stage: "Identified Opportunity",
        status,
        createdAt: nowIso(),
        lastActivity: nowIso(),
      };
      setLeads((prev) => [lead, ...prev]);
      pushActivity({ leadId: id, type: "system", user: actor, text: `Lead created: ${l.company}` });
      pushAudit({
        user: actor,
        action: "Lead Submitted",
        module: "Leads",
        details: `${id} ${l.company}`,
      });
      notify({
        title: l.isDuplicate ? "Duplicate flagged for review" : "New lead submitted",
        body: `${l.company} · ${actor}`,
        type: l.isDuplicate ? "warning" : "info",
      });
      return lead;
    },
    [handleWriteError, realMode],
  );

  const updateLeadStage: AppActions["updateLeadStage"] = useCallback(
    (id, stage, actor, reason) => {
      const existing = leads.find((lead) => lead.id === id);
      if (!existing || !user) return;
      if (
        !canMoveLeadStage(
          user.role,
          existing.stage,
          stage,
          existing.previousStage,
          existing.stageAdminLocked,
        )
      ) {
        toast.error("Your role cannot move this lead to that stage.");
        return;
      }
      if (stage === "Closed Lost" && !reason?.trim()) {
        toast.error("A Closed Lost reason is required.");
        return;
      }
      if (stage === "Closed Won" && !existing.confirmedValue) {
        toast.error("Closed Won requires a confirmed deal value.");
        return;
      }
      if (realMode && supabase) {
        void (supabase as any)
          .rpc("update_lead_stage_secure", {
            target_lead: id,
            target_stage: stage,
            change_reason: reason || null,
          })
          .then(({ error }: { error: unknown }) => {
            if (error) handleWriteError(error);
            reloadAfterWrite();
          });
        return;
      }
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== id) return l;
          const next = {
            ...l,
            stage,
            previousStage: stage === "On Hold" && l.stage !== "On Hold" ? l.stage : l.previousStage,
            status:
              stage === "Closed Won"
                ? "Closed Won"
                : stage === "Closed Lost"
                  ? "Closed Lost"
                  : "Open",
            lastActivity: nowIso(),
            stageAdminLocked:
              user.role === "admin" || user.role === "super_admin" ? true : l.stageAdminLocked,
          } as Lead;
          // Auto-create commission on Closed Won
          if (stage === "Closed Won") {
            const partner = partners.find((p) => p.id === l.partnerId);
            if (partner && !commissions.find((c) => c.leadId === id)) {
              const amount =
                (l.confirmedValue || l.estimatedValue) * (partner.commissionRate / 100);
              setCommissions((cs) => [
                ...cs,
                {
                  id: uid("C"),
                  leadId: id,
                  partnerId: l.partnerId,
                  rate: partner.commissionRate,
                  amount,
                  state: "On Hold",
                  closedDate: nowIso(),
                  kind: "Deal",
                },
              ]);
            }
          }
          const reasonText = reason ? ` Reason: ${reason}` : "";
          pushActivity({
            leadId: id,
            type: "stage_change",
            user: actor,
            text: `Stage changed: ${l.stage} -> ${stage}.${reasonText}`,
          });
          pushAudit({
            user: actor,
            action: "Stage Change",
            module: "Leads",
            details: reason ? `${id}: ${reason}` : `${id}`,
            oldValue: l.stage,
            newValue: stage,
          });
          notify({ title: "Lead stage updated", body: `${l.company} -> ${stage}`, type: "info" });
          return next;
        }),
      );
    },
    [commissions, handleWriteError, leads, partners, realMode, reloadAfterWrite, user],
  );

  const updateLeadStatus: AppActions["updateLeadStatus"] = useCallback(
    (id, status, actor, reason) => {
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== id) return l;
          const reasonText = reason ? ` Reason: ${reason}` : "";
          pushActivity({
            leadId: id,
            type: "status_change",
            user: actor,
            text: `Status changed: ${l.status} -> ${status}.${reasonText}`,
          });
          pushAudit({
            user: actor,
            action: "Status Change",
            module: "Leads",
            details: reason ? `${id}: ${reason}` : id,
            oldValue: l.status,
            newValue: status,
          });
          return { ...l, status, lastActivity: nowIso() };
        }),
      );
      if (realMode && supabase) {
        const patch: Record<string, unknown> = { status, last_activity_at: nowIso() };
        if (["Closed Lost"].includes(status)) {
          patch.closed_reason = reason || status;
        }
        if (status === "Duplicate Rejected") {
          patch.duplicate_reason = reason || "Duplicate rejected";
        }
        void (supabase as any)
          .from("leads")
          .update(patch)
          .eq("id", id)
          .then(({ error }: { error: unknown }) => {
            if (error) handleWriteError(error);
            const lead = leads.find((item) => item.id === id);
            if (!error && lead) {
              void notifyPartner(lead.partnerId, {
                title: "Lead status updated",
                body: `${lead.company} status changed to ${status}.${reason ? ` Reason: ${reason}` : ""}`,
                type:
                  status === "Closed Lost" || status === "Duplicate Rejected" ? "warning" : "info",
              });
            }
            reloadAfterWrite();
          });
      }
    },
    [handleWriteError, leads, notifyPartner, realMode, reloadAfterWrite],
  );

  const updateOwnLead: AppActions["updateOwnLead"] = useCallback(
    async (leadId, patch) => {
      const existing = leads.find((lead) => lead.id === leadId);
      if (!existing || user?.role !== "partner" || existing.partnerId !== user.partnerId) {
        toast.error("You can edit only your own leads.");
        return false;
      }
      if (realMode && supabase) {
        const next = { ...existing, ...patch };
        const { data, error } = await (supabase as any).rpc("update_own_partner_lead", {
          target_lead: leadId,
          company_name: next.company,
          contact_name: next.contactName,
          contact_title: next.contactTitle,
          contact_email: next.contactEmail,
          contact_phone: next.contactPhone || "",
          client_linkedin: next.clientLinkedin || "",
          country: next.country,
          industry: next.industry,
          estimated_value: next.estimatedValue,
          currency: next.currency,
          description: next.description,
        });
        if (error) {
          handleWriteError(error, "Unable to update the lead.");
          return false;
        }
        setLeads((current) => current.map((lead) => (lead.id === leadId ? mapLead(data) : lead)));
        reloadAfterWrite();
        return true;
      }
      setLeads((current) =>
        current.map((lead) =>
          lead.id === leadId ? { ...lead, ...patch, lastActivity: nowIso() } : lead,
        ),
      );
      return true;
    },
    [handleWriteError, leads, realMode, reloadAfterWrite, user],
  );

  const closeLeadWon: AppActions["closeLeadWon"] = useCallback(
    (id, confirmedValue, actor) => {
      const lead = leads.find((l) => l.id === id);
      if (!lead || !user) return;
      if (
        !canMoveLeadStage(
          user.role,
          lead.stage,
          "Closed Won",
          lead.previousStage,
          lead.stageAdminLocked,
        )
      ) {
        toast.error("Only Admin or Super Admin can close a deal as won.");
        return;
      }
      if (!Number.isFinite(confirmedValue) || confirmedValue <= 0) {
        toast.error("Confirmed deal value must be a positive number.");
        return;
      }
      const partner = partners.find((p) => p.id === lead.partnerId);
      if (!partner) return;
      const amount = confirmedValue * (partner.commissionRate / 100);
      setLeads((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                stage: "Closed Won",
                status: "Closed Won",
                confirmedValue,
                stageAdminLocked: true,
                lastActivity: nowIso(),
              }
            : l,
        ),
      );
      setCommissions((prev) => {
        const existing = prev.find((c) => c.leadId === id && (c.kind || "Deal") === "Deal");
        if (existing) {
          return prev.map((c) =>
            c.id === existing.id
              ? {
                  ...c,
                  rate: partner.commissionRate,
                  amount,
                  state: c.state,
                  closedDate: nowIso(),
                  kind: "Deal",
                }
              : c,
          );
        }
        return [
          ...prev,
          {
            id: uid("C"),
            leadId: id,
            partnerId: lead.partnerId,
            rate: partner.commissionRate,
            amount,
            state: "On Hold",
            closedDate: nowIso(),
            kind: "Deal",
          },
        ];
      });
      pushActivity({
        leadId: id,
        type: "stage_change",
        user: actor,
        text: `Deal closed won with confirmed value $${confirmedValue.toLocaleString()}`,
      });
      pushAudit({
        user: actor,
        action: "Deal Closed Won",
        module: "Leads",
        details: id,
        oldValue: lead.stage,
        newValue: `Closed Won · $${confirmedValue}`,
      });
      notify({
        title: "Deal closed won",
        body: `${lead.company} closed at $${confirmedValue.toLocaleString()}. Commission is on hold until client payment.`,
        type: "success",
        mandatory: true,
      });
      if (realMode && supabase) {
        void (supabase as any)
          .rpc("close_lead_won_secure", {
            target_lead: id,
            confirmed_deal_value: confirmedValue,
          })
          .then(({ error }: { error: unknown }) => {
            if (error) handleWriteError(error);
            reloadAfterWrite();
          });
      }
    },
    [commissions, handleWriteError, leads, partners, realMode, reloadAfterWrite, user],
  );

  const addComment: AppActions["addComment"] = useCallback(
    async (leadId, text, actor, isPrivate = false, mentionedUserIds = []) => {
      if (realMode && supabase) {
        const { data, error } = await (supabase as any).rpc("add_lead_comment_secure", {
          target_lead: leadId,
          comment_text: text,
          private_comment: isPrivate,
          mentioned_users: mentionedUserIds,
        });
        if (error) {
          handleWriteError(error, "Unable to post the comment.");
          return false;
        }
        if (data) setActivity((current) => [mapActivity(data), ...current]);
        setLeads((current) =>
          current.map((lead) => (lead.id === leadId ? { ...lead, lastActivity: nowIso() } : lead)),
        );
        reloadAfterWrite();
        return true;
      }
      pushActivity({
        leadId,
        type: isPrivate ? "admin_note" : "comment",
        user: actor,
        text,
        private: isPrivate,
      });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, lastActivity: nowIso() } : l)));
      if (!isPrivate) {
        notify({
          title: "New lead comment",
          body: `${leadId} - ${actor}: ${text.slice(0, 80)}`,
          type: "info",
        });
      }
      return true;
    },
    [handleWriteError, realMode, reloadAfterWrite, user?.role],
  );

  const addAttachment: AppActions["addAttachment"] = useCallback(
    async (leadId, file, actor, isPrivate = false) => {
      const validationError = validateUploadFile(file, STORAGE_BUCKETS.leadAttachments);
      if (validationError) {
        toast.error(validationError);
        return false;
      }

      if (realMode && supabase) {
        const attachmentId = crypto.randomUUID();
        const storagePath = buildStoragePath(user?.id, leadId, file);
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKETS.leadAttachments)
          .upload(storagePath, file, { contentType: file.type, upsert: false });
        if (uploadError) {
          handleWriteError(uploadError, "Attachment upload failed.");
          return false;
        }

        const { error: metadataError } = await supabase.from("lead_attachments").insert({
          id: attachmentId,
          lead_id: leadId,
          name: file.name,
          storage_bucket: STORAGE_BUCKETS.leadAttachments,
          storage_path: storagePath,
          is_private: isPrivate,
          uploaded_by: user?.id || null,
        });

        if (metadataError) {
          await supabase.storage.from(STORAGE_BUCKETS.leadAttachments).remove([storagePath]);
          handleWriteError(metadataError, "Attachment metadata could not be saved.");
          return false;
        }

        setAttachments((current) => ({
          ...current,
          [leadId]: [
            {
              id: attachmentId,
              name: file.name,
              date: nowIso(),
              storageBucket: STORAGE_BUCKETS.leadAttachments,
              storagePath,
              private: isPrivate,
            },
            ...(current[leadId] || []),
          ],
        }));

        if (!isPrivate && user?.role !== "partner") {
          const lead = leads.find((item) => item.id === leadId);
          if (lead) {
            void notifyPartner(lead.partnerId, {
              title: "New lead attachment",
              body: `${file.name} was uploaded for ${lead.company}.`,
              type: "info",
            });
          }
        }
        toast.success(`${file.name} uploaded`);
        return true;
      }

      setAttachments((a) => ({
        ...a,
        [leadId]: [
          ...(a[leadId] || []),
          { id: uid("f"), name: file.name, date: nowIso(), private: isPrivate },
        ],
      }));
      pushActivity({
        leadId,
        type: "file",
        user: actor,
        text: `Uploaded ${file.name}${isPrivate ? " (internal)" : ""}`,
        private: isPrivate,
      });
      toast.success(`${file.name} uploaded`);
      return true;
    },
    [handleWriteError, leads, notifyPartner, realMode, user?.id, user?.role],
  );

  const deleteLead: AppActions["deleteLead"] = useCallback(
    async (leadId, actor) => {
      const lead = leads.find((item) => item.id === leadId);
      if (!lead) return false;
      if (user?.role === "partner") {
        toast.error("Sales Partners cannot delete leads.");
        return false;
      }
      if (realMode && supabase) {
        const storedFiles = attachments[leadId] || [];
        const paths = storedFiles
          .filter(
            (file) => file.storageBucket === STORAGE_BUCKETS.leadAttachments && file.storagePath,
          )
          .map((file) => file.storagePath!);
        if (paths.length) {
          const { error: storageError } = await supabase.storage
            .from(STORAGE_BUCKETS.leadAttachments)
            .remove(paths);
          if (storageError) {
            handleWriteError(storageError, "Lead attachments could not be deleted.");
            return false;
          }
        }
        const { error } = await (supabase as any).rpc("delete_own_partner_lead", {
          target_lead: leadId,
        });
        if (error) {
          handleWriteError(error);
          return false;
        }
      }
      setLeads((previous) => previous.filter((item) => item.id !== leadId));
      setAttachments((previous) => {
        const next = { ...previous };
        delete next[leadId];
        return next;
      });
      pushAudit({
        user: actor,
        action: "Lead Deleted by Partner",
        module: "Leads",
        details: leadId,
      });
      reloadAfterWrite();
      return true;
    },
    [attachments, handleWriteError, leads, realMode, reloadAfterWrite, user?.role],
  );

  const updateEstimatedValue: AppActions["updateEstimatedValue"] = useCallback(
    (leadId, value, actor) => {
      const lead = leads.find((item) => item.id === leadId);
      if (!lead || !user || value <= 0) return;
      if (
        (user.role !== "admin" && user.role !== "super_admin") ||
        !isCommercialStage(lead.stage, lead.previousStage)
      ) {
        toast.error("Commercial value can be edited by Admin from Contract Sent onward.");
        return;
      }
      setLeads((previous) =>
        previous.map((item) =>
          item.id === leadId ? { ...item, estimatedValue: value, lastActivity: nowIso() } : item,
        ),
      );
      pushActivity({
        leadId,
        type: "partner_update",
        user: actor,
        text: `Estimated deal value updated from ${lead.estimatedValue} to ${value}`,
      });
      pushAudit({
        user: actor,
        action: "Estimated Value Updated",
        module: "Leads",
        details: leadId,
        oldValue: String(lead.estimatedValue),
        newValue: String(value),
      });
      if (realMode && supabase) {
        void (supabase as any)
          .rpc("update_lead_commercial_value_secure", {
            target_lead: leadId,
            new_value: value,
          })
          .then(({ error }: { error: unknown }) => {
            if (error) handleWriteError(error);
            reloadAfterWrite();
          });
      }
    },
    [handleWriteError, leads, realMode, reloadAfterWrite, user],
  );

  const addCall: AppActions["addCall"] = useCallback(
    async (c, actor) => {
      if (c.attachmentFile) {
        const validationError = validateUploadFile(
          c.attachmentFile,
          STORAGE_BUCKETS.discoveryCallFiles,
        );
        if (validationError) {
          toast.error(validationError);
          return false;
        }
      }

      if (realMode && supabase) {
        const callId = crypto.randomUUID();
        let storagePath: string | null = null;

        if (c.attachmentFile) {
          storagePath = buildStoragePath(user?.id, callId, c.attachmentFile);
          const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKETS.discoveryCallFiles)
            .upload(storagePath, c.attachmentFile, {
              contentType: c.attachmentFile.type,
              upsert: false,
            });
          if (uploadError) {
            handleWriteError(uploadError, "Discovery call attachment upload failed.");
            return false;
          }
        }

        const { error } = await supabase.from("discovery_calls").insert({
          id: callId,
          lead_id: c.leadId,
          call_at: c.date,
          duration_minutes: c.duration,
          goaccelovate_attendees: c.attendees,
          client_attendees: c.clientAttendees,
          partner_joined: c.partnerJoined,
          summary: c.summary,
          outcomes: c.outcomes,
          next_steps: c.nextSteps,
          follow_up_date: c.followUp || null,
          recording_url: c.attachmentFile?.name || c.attachmentName || null,
          is_private: c.private,
          created_by: user?.id || null,
        });

        if (error) {
          if (storagePath) {
            await supabase.storage.from(STORAGE_BUCKETS.discoveryCallFiles).remove([storagePath]);
          }
          handleWriteError(error);
          return false;
        }

        if (c.attachmentFile && storagePath) {
          const { error: metadataError } = await supabase
            .from("discovery_call_attachments")
            .insert({
              discovery_call_id: callId,
              name: c.attachmentFile.name,
              storage_bucket: STORAGE_BUCKETS.discoveryCallFiles,
              storage_path: storagePath,
              uploaded_by: user?.id || null,
            });
          if (metadataError) {
            await supabase.storage.from(STORAGE_BUCKETS.discoveryCallFiles).remove([storagePath]);
            await supabase.from("discovery_calls").delete().eq("id", callId);
            handleWriteError(
              metadataError,
              "Discovery call attachment metadata could not be saved.",
            );
            reloadAfterWrite();
            return false;
          }
        }

        pushActivity({
          leadId: c.leadId,
          type: "discovery_call",
          user: actor,
          text: `Discovery call logged (${c.duration} min)`,
          private: c.private,
        });
        pushAudit({
          user: actor,
          action: "Discovery Call Logged",
          module: "Leads",
          details: c.leadId,
        });

        if (!c.private) {
          const lead = leads.find((item) => item.id === c.leadId);
          if (lead) {
            await notifyPartner(lead.partnerId, {
              title: "Discovery call logged",
              body: `${lead.company}: ${c.summary || "A discovery call was logged."}`,
              type: "info",
            });
          }
        }
        toast.success("Discovery call logged");
        reloadAfterWrite();
        return true;
      }

      const call = { ...c, id: uid("DC") };
      setCalls((cs) => [call, ...cs]);
      pushActivity({
        leadId: c.leadId,
        type: "discovery_call",
        user: actor,
        text: `Discovery call logged (${c.duration} min)`,
        private: c.private,
      });
      pushAudit({
        user: actor,
        action: "Discovery Call Logged",
        module: "Leads",
        details: c.leadId,
      });
      toast.success("Discovery call logged");
      return true;
    },
    [handleWriteError, leads, notifyPartner, realMode, reloadAfterWrite, user?.id],
  );

  const downloadStoredFile: AppActions["downloadStoredFile"] = useCallback(
    async (bucket, path, name) => {
      if (!bucket || !path || !supabase || !realMode) {
        toast.error("This document does not have an uploaded storage file.");
        return;
      }

      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
      if (error || !data?.signedUrl) {
        handleWriteError(error || new Error("Unable to create signed URL."), "Download failed.");
        return;
      }

      const anchor = document.createElement("a");
      anchor.href = data.signedUrl;
      anchor.download = name;
      anchor.rel = "noopener";
      anchor.click();
    },
    [handleWriteError, realMode],
  );

  const overrideCommissionRate: AppActions["overrideCommissionRate"] = useCallback(
    (id, rate, actor, reason) => {
      setCommissions((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const lead = leads.find((l) => l.id === c.leadId);
          const base = lead?.confirmedValue || lead?.estimatedValue || c.amount / (c.rate / 100);
          const amount = base * (rate / 100);
          pushAudit({
            user: actor,
            action: "Commission Override",
            module: "Commissions",
            details: `${id}: ${reason}`,
            oldValue: `${c.rate}%`,
            newValue: `${rate}%`,
          });
          notify({ title: "Commission rate overridden", body: `${id} -> ${rate}%`, type: "info" });
          if (realMode && supabase) {
            void supabase
              .from("commissions")
              .update({ rate, amount, override_reason: reason })
              .eq("id", id)
              .then(({ error }) => {
                if (error) handleWriteError(error);
                if (!error) {
                  void notifyPartner(c.partnerId, {
                    title: "Commission rate updated",
                    body: `${id} changed from ${c.rate}% to ${rate}%. Reason: ${reason}`,
                    type: "info",
                    mandatory: true,
                  });
                }
                reloadAfterWrite();
              });
          }
          return { ...c, rate, amount };
        }),
      );
    },
    [handleWriteError, leads, notifyPartner, realMode, reloadAfterWrite],
  );

  const addManualCommission: AppActions["addManualCommission"] = useCallback(
    (payload, actor) => {
      const item: Commission = {
        id: uid("C"),
        leadId: payload.leadId,
        partnerId: payload.partnerId,
        rate: payload.rate ?? 0,
        amount: payload.amount,
        state: "Unpaid",
        closedDate: nowIso(),
        kind: payload.kind,
        label: payload.label,
        notes: payload.notes,
      };
      setCommissions((prev) => [item, ...prev]);
      pushAudit({
        user: actor,
        action: "Manual Commission Added",
        module: "Commissions",
        details: `${payload.kind}: ${payload.label}`,
        newValue: `$${payload.amount}`,
      });
      notify({
        title: "Manual commission added",
        body: `${payload.label} · $${payload.amount.toLocaleString()}`,
        type: "success",
      });
      if (realMode && supabase) {
        void supabase
          .from("commissions")
          .insert({
            lead_id: payload.leadId,
            partner_id: payload.partnerId,
            kind: payload.kind,
            label: payload.label,
            rate: payload.rate ?? 0,
            base_amount: payload.amount,
            amount: payload.amount,
            state: "Unpaid",
            override_reason: payload.notes || null,
            closed_date: new Date().toISOString().slice(0, 10),
            created_by: user?.id || null,
          })
          .then(({ error }) => {
            if (error) handleWriteError(error);
            if (!error) {
              void notifyPartner(payload.partnerId, {
                title: "Commission added",
                body: `${payload.label} - $${payload.amount.toLocaleString()}`,
                type: "success",
                mandatory: true,
              });
            }
            reloadAfterWrite();
          });
      }
    },
    [handleWriteError, notifyPartner, realMode, reloadAfterWrite, user?.id],
  );

  const setCommissionState: AppActions["setCommissionState"] = useCallback(
    (id, state, actor) => {
      setCommissions((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          pushAudit({
            user: actor,
            action: "Commission State Change",
            module: "Commissions",
            details: id,
            oldValue: c.state,
            newValue: state,
          });
          return { ...c, state };
        }),
      );
      if (realMode && supabase) {
        const commission = commissions.find((item) => item.id === id);
        void supabase
          .from("commissions")
          .update({ state })
          .eq("id", id)
          .then(({ error }) => {
            if (error) handleWriteError(error);
            if (!error && commission) {
              void notifyPartner(commission.partnerId, {
                title: "Commission status updated",
                body: `${id} is now ${state}.`,
                type: state === "Paid" || state === "Approved" ? "success" : "info",
                mandatory: state === "Paid" || state === "Waived",
              });
            }
            reloadAfterWrite();
          });
      }
    },
    [commissions, handleWriteError, notifyPartner, realMode, reloadAfterWrite],
  );

  const waiveCommission: AppActions["waiveCommission"] = useCallback(
    (id, actor, reason) => {
      setCommissions((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          pushAudit({
            user: actor,
            action: "Commission Waived",
            module: "Commissions",
            details: `${id}: ${reason}`,
            oldValue: c.state,
            newValue: "Waived",
          });
          notify({ title: "Commission waived", body: `${id}: ${reason}`, type: "warning" });
          return { ...c, state: "Waived" };
        }),
      );
      if (realMode && supabase) {
        const commission = commissions.find((item) => item.id === id);
        void supabase
          .from("commissions")
          .update({ state: "Waived", waived_reason: reason })
          .eq("id", id)
          .then(({ error }) => {
            if (error) handleWriteError(error);
            if (!error && commission) {
              void notifyPartner(commission.partnerId, {
                title: "Commission waived",
                body: `${id}: ${reason}`,
                type: "warning",
                mandatory: true,
              });
            }
            reloadAfterWrite();
          });
      }
    },
    [commissions, handleWriteError, notifyPartner, realMode, reloadAfterWrite],
  );

  const requestPayout: AppActions["requestPayout"] = useCallback(
    async (partnerId, commissionIds, payload, actor) => {
      const availableAmount = commissions
        .filter((c) => commissionIds.includes(c.id))
        .reduce((s, c) => s + Math.max(0, (c.eligibleAmount || c.amount) - (c.paidAmount || 0)), 0);
      if (availableAmount <= 0 || payload.amount <= 0 || payload.amount > availableAmount) {
        toast.error("Select at least one payable commission.");
        return false;
      }
      if (realMode && supabase) {
        const { error } = await (supabase as any).rpc("request_commission_payout", {
          commission_ids: commissionIds,
          requested_amount: payload.amount,
          preferred_bank: payload.preferredBank,
          preferred_method: payload.preferredMethod,
          liable_for_taxes: payload.taxLiability,
          message: payload.message,
        });
        if (error) {
          handleWriteError(error, "Unable to submit the payout request.");
          reloadAfterWrite();
          return false;
        }
        reloadAfterWrite();
        return true;
      }
      const id = uid("PO");
      setPayouts((p) => [
        {
          id,
          partnerId,
          commissionIds,
          amount: payload.amount,
          status: "Pending",
          requestedDate: nowIso(),
          message: payload.message,
          preferredBank: payload.preferredBank,
          preferredMethod: payload.preferredMethod,
          taxLiability: payload.taxLiability,
        },
        ...p,
      ]);
      setCommissions((prev) =>
        prev.map((c) => (commissionIds.includes(c.id) ? { ...c, state: "Payout Requested" } : c)),
      );
      pushAudit({
        user: actor,
        action: "Payout Requested",
        module: "Payouts",
        details: `${id}: ${payload.amount}`,
      });
      notify({
        title: "Payout request submitted",
        body: `Payout request for $${payload.amount.toLocaleString()}`,
        type: "info",
      });
      return true;
    },
    [commissions, handleWriteError, realMode, reloadAfterWrite],
  );

  const approvePayout: AppActions["approvePayout"] = useCallback(
    async (id, actor) => {
      if (user?.role !== "super_admin") {
        toast.error("Only Super Admin can approve payout requests.");
        return false;
      }
      if (realMode && supabase) {
        const { error } = await (supabase as any).rpc("review_payout_request", {
          target_payout: id,
          approve_request: true,
          rejection_reason: null,
        });
        if (error) {
          handleWriteError(error, "Unable to approve the payout request.");
          reloadAfterWrite();
          return false;
        }
        reloadAfterWrite();
        return true;
      }
      setPayouts((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          setCommissions((cs) =>
            cs.map((c) => (p.commissionIds.includes(c.id) ? { ...c, state: "Approved" } : c)),
          );
          pushAudit({ user: actor, action: "Payout Approved", module: "Payouts", details: id });
          notify({
            title: "Payout approved",
            body: `${id} ready for payment`,
            type: "success",
            mandatory: true,
          });
          return { ...p, status: "Approved" };
        }),
      );
      return true;
    },
    [handleWriteError, realMode, reloadAfterWrite, user?.role],
  );

  const rejectPayout: AppActions["rejectPayout"] = useCallback(
    async (id, reason, actor) => {
      if (user?.role !== "super_admin") {
        toast.error("Only Super Admin can reject payout requests.");
        return false;
      }
      if (!reason.trim()) {
        toast.error("A rejection reason is required.");
        return false;
      }
      if (realMode && supabase) {
        const { error } = await (supabase as any).rpc("review_payout_request", {
          target_payout: id,
          approve_request: false,
          rejection_reason: reason.trim(),
        });
        if (error) {
          handleWriteError(error, "Unable to reject the payout request.");
          reloadAfterWrite();
          return false;
        }
        reloadAfterWrite();
        return true;
      }
      setPayouts((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          setCommissions((cs) =>
            cs.map((c) => (p.commissionIds.includes(c.id) ? { ...c, state: "Unpaid" } : c)),
          );
          pushAudit({
            user: actor,
            action: "Payout Rejected",
            module: "Payouts",
            details: `${id}: ${reason}`,
          });
          notify({
            title: "Payout rejected",
            body: `${id}: ${reason}`,
            type: "destructive",
            mandatory: true,
          });
          return { ...p, status: "Rejected", rejectReason: reason };
        }),
      );
      return true;
    },
    [handleWriteError, realMode, reloadAfterWrite],
  );

  const recordPayoutPayment: AppActions["recordPayoutPayment"] = useCallback(
    async (id, payload, actor) => {
      if (user?.role !== "super_admin") {
        toast.error("Only Super Admin can record payout payments.");
        return false;
      }
      if (
        !payload.date ||
        !payload.method.trim() ||
        !payload.reference.trim() ||
        !Number.isFinite(payload.amount) ||
        payload.amount <= 0
      ) {
        toast.error("Payment amount, date, method, and transaction reference are required.");
        return false;
      }
      const payout = payouts.find((item) => item.id === id);
      if (!payout || Math.abs(payload.amount - payout.amount) > 0.005) {
        toast.error("The paid amount must match the approved payout amount.");
        return false;
      }
      if (realMode && supabase) {
        const { error } = await (supabase as any).rpc("record_payout_paid", {
          target_payout: id,
          payment_amount: payload.amount,
          paid_on: payload.date,
          method: payload.method,
          reference: payload.reference,
        });
        if (error) {
          handleWriteError(error, "Unable to confirm the external payout.");
          reloadAfterWrite();
          return false;
        }

        setPayouts((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: "Paid",
                  paidDate: payload.date,
                  method: payload.method,
                  reference: payload.reference,
                }
              : item,
          ),
        );
        setCommissions((current) =>
          current.map((commission) => {
            if (!payout.commissionIds.includes(commission.id)) return commission;
            const newlyPaid = Math.max(
              0,
              (commission.eligibleAmount || 0) - (commission.paidAmount || 0),
            );
            const paidAmount = Math.min(
              commission.amount,
              (commission.paidAmount || 0) + newlyPaid,
            );
            return {
              ...commission,
              paidAmount,
              state: paidAmount >= commission.amount ? "Paid" : "Unpaid",
            };
          }),
        );
        reloadAfterWrite();
        return true;
      }
      setPayouts((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          setCommissions((cs) =>
            cs.map((c) =>
              p.commissionIds.includes(c.id)
                ? {
                    ...c,
                    state: (c.paidAmount || 0) + p.amount >= c.amount ? "Paid" : "Unpaid",
                    paidAmount: Math.min(c.amount, (c.paidAmount || 0) + p.amount),
                  }
                : c,
            ),
          );
          pushAudit({
            user: actor,
            action: "Payout Paid",
            module: "Payouts",
            details: `${id} · ${payload.reference}`,
          });
          notify({
            title: "Payout marked as paid",
            body: `${id} · ${payload.method} · ${payload.reference}`,
            type: "success",
            mandatory: true,
          });
          return {
            ...p,
            status: "Paid",
            paidDate: payload.date,
            method: payload.method,
            reference: payload.reference,
          };
        }),
      );
      return true;
    },
    [handleWriteError, payouts, realMode, reloadAfterWrite, user?.role],
  );

  const recordClientPayment: AppActions["recordClientPayment"] = useCallback(
    async (payload, actor) => {
      if (realMode && supabase) {
        const { error } = await (supabase as any).rpc("record_client_payment_and_eligibility", {
          target_lead: payload.leadId,
          payment_amount: payload.amount,
          payment_date: payload.date,
          payment_reference: payload.reference,
          payment_method: payload.method,
          payment_type: payload.paymentType,
          payment_notes: payload.notes || null,
        });
        if (error) {
          handleWriteError(error, "Unable to record the client payment.");
          reloadAfterWrite();
          return false;
        }
        reloadAfterWrite();
        return true;
      }
      const released = commissions.filter(
        (commission) => commission.leadId === payload.leadId && commission.state !== "Waived",
      );
      setClientPayments((prev) => [{ ...payload, id: uid("CP") }, ...prev]);
      if (released.length > 0) {
        setCommissions((prev) =>
          prev.map((commission) => {
            if (!released.some((item) => item.id === commission.id)) return commission;
            const eligibleAmount = commission.eligibleAmount || 0;
            const releaseAmount =
              payload.paymentType === "Final"
                ? commission.amount - eligibleAmount
                : Math.min(
                    commission.amount - eligibleAmount,
                    payload.amount * (commission.rate / 100),
                  );
            const nextEligibleAmount = Math.min(commission.amount, eligibleAmount + releaseAmount);
            return {
              ...commission,
              state: ["Payout Requested", "Approved", "Disputed"].includes(commission.state)
                ? commission.state
                : (commission.paidAmount || 0) >= nextEligibleAmount
                  ? "Paid"
                  : "Unpaid",
              eligibleAmount: nextEligibleAmount,
            };
          }),
        );
      }
      pushAudit({
        user: actor,
        action: "Payment Recorded",
        module: "Client Payments",
        details: `${payload.leadId} · $${payload.amount}`,
      });
      notify({
        title: "Client payment recorded",
        body: `$${payload.amount.toLocaleString()} against ${payload.leadId}`,
        type: "success",
      });
      if (released.length > 0) {
        pushAudit({
          user: actor,
          action: "Commission Eligibility Triggered",
          module: "Commissions",
          details: `${payload.leadId}: ${released.length} commission(s) now payable`,
        });
        notify({
          title: "Commission now payable",
          body: `${payload.leadId} released for payout after client payment`,
          type: "success",
        });
      }
      return true;
    },
    [commissions, handleWriteError, realMode, reloadAfterWrite],
  );

  const publishAnnouncement: AppActions["publishAnnouncement"] = useCallback(
    async (a, actor) => {
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        toast.error("Only Admin or Super Admin can publish announcements.");
        return false;
      }
      if (a.attachmentFile) {
        const validationError = validateAnnouncementFile(
          a.attachmentFile,
          settings.announcementAttachmentMaxBytes,
        );
        if (validationError) {
          toast.error(validationError);
          return false;
        }
      }

      const id = realMode ? crypto.randomUUID() : uid("AN");
      const target = announcementTarget(a.target, partners);
      let attachmentPath: string | undefined;
      if (realMode && supabase) {
        if (a.attachmentFile) {
          attachmentPath = buildStoragePath(user.id, id, a.attachmentFile);
          const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKETS.announcementAttachments)
            .upload(attachmentPath, a.attachmentFile, {
              contentType: a.attachmentFile.type,
              upsert: false,
            });
          if (uploadError) {
            handleWriteError(uploadError, "Announcement attachment upload failed.");
            return false;
          }
        }

        const { error: announcementError } = await (supabase as any).from("announcements").insert({
          id,
          title: a.title,
          body: a.body,
          priority: a.priority,
          target_type: target.target_type,
          target_rules: target.target_rules,
          send_email: Boolean((a as any).sendEmail),
          published_by: user.id,
          attachment_name: a.attachmentFile?.name || null,
          attachment_bucket: attachmentPath ? STORAGE_BUCKETS.announcementAttachments : null,
          attachment_path: attachmentPath || null,
          attachment_type: a.attachmentFile?.type || null,
          attachment_size: a.attachmentFile?.size || null,
        });
        if (announcementError) {
          if (attachmentPath) {
            await supabase.storage
              .from(STORAGE_BUCKETS.announcementAttachments)
              .remove([attachmentPath]);
          }
          handleWriteError(announcementError, "Unable to publish the announcement.");
          return false;
        }
      }

      const item: Announcement = {
        id,
        title: a.title,
        body: a.body,
        priority: a.priority,
        target: a.target,
        date: nowIso(),
        readBy: [],
        attachmentName: a.attachmentFile?.name,
        attachmentBucket: attachmentPath ? STORAGE_BUCKETS.announcementAttachments : undefined,
        attachmentPath,
        attachmentType: a.attachmentFile?.type,
        attachmentSize: a.attachmentFile?.size,
        comments: [],
        reactions: [],
      };
      setAnnouncements((prev) => [item, ...prev]);

      if (realMode && supabase) {
        const targetedPartners = partners.filter((partner) =>
          isAnnouncementTargeted(item, partner),
        );
        if (targetedPartners.length > 0) {
          const { error } = await supabase.from("notifications").insert(
            targetedPartners.map((partner) => ({
              partner_id: partner.id,
              title: "New announcement",
              body: `${a.priority}: ${a.title}`,
              type: a.priority === "Important" ? "warning" : "info",
              mandatory: a.priority === "Important",
            })),
          );
          if (error) handleWriteError(error, "Announcement published, but notifications failed.");
        }
        if (target.target_type === "staff_roles" || target.target_type === "all_users") {
          const roles = (target.target_rules as { roles?: string[] }).roles || [
            "admin",
            "super_admin",
          ];
          const recipients = staffUsers.filter(
            (staff) =>
              staff.id !== user.id &&
              staff.accountStatus !== "deactivated" &&
              roles.includes(staff.role),
          );
          if (recipients.length > 0) {
            const { error } = await supabase.from("notifications").insert(
              recipients.map((staff) => ({
                recipient_id: staff.id,
                title: "New announcement",
                body: `${a.priority}: ${a.title}`,
                type: a.priority === "Important" ? "warning" : "info",
                mandatory: a.priority === "Important",
              })),
            );
            if (error) handleWriteError(error, "Announcement published, but notifications failed.");
          }
        }
        reloadAfterWrite();
      } else {
        pushAudit({
          user: actor,
          action: "Announcement Published",
          module: "Announcements",
          details: a.title,
        });
      }
      return true;
    },
    [
      handleWriteError,
      partners,
      realMode,
      reloadAfterWrite,
      settings.announcementAttachmentMaxBytes,
      staffUsers,
      user,
    ],
  );

  const addAnnouncementComment: AppActions["addAnnouncementComment"] = useCallback(
    async (announcementId, body, mentionedUserIds = []) => {
      if (!user || !body.trim()) return false;
      const id = crypto.randomUUID();
      let savedComment: any = null;
      if (realMode && supabase) {
        const { data, error } = await (supabase as any).rpc("add_announcement_comment_secure", {
          target_announcement: announcementId,
          comment_body: body.trim(),
          mentioned_users: mentionedUserIds,
        });
        if (error) {
          handleWriteError(error, "Unable to post the announcement reply.");
          return false;
        }
        savedComment = data;
      }
      setAnnouncements((current) =>
        current.map((announcement) =>
          announcement.id === announcementId
            ? {
                ...announcement,
                comments: [
                  ...announcement.comments,
                  {
                    id: savedComment?.id || id,
                    announcementId,
                    actorId: user.id,
                    actorName: user.name,
                    body: body.trim(),
                    date: savedComment?.created_at || nowIso(),
                    mentionedUserIds,
                  },
                ],
              }
            : announcement,
        ),
      );
      reloadAfterWrite();
      return true;
    },
    [handleWriteError, realMode, reloadAfterWrite, user],
  );

  const setAnnouncementReaction: AppActions["setAnnouncementReaction"] = useCallback(
    async (announcementId, reaction) => {
      if (!user) return false;
      const announcement = announcements.find((item) => item.id === announcementId);
      const existing = announcement?.reactions.find((item) => item.actorId === user.id);
      if (realMode && supabase) {
        const query = (supabase as any).from("announcement_reactions");
        const { error } = reaction
          ? await query.upsert(
              {
                announcement_id: announcementId,
                actor_id: user.id,
                reaction,
              },
              { onConflict: "announcement_id,actor_id" },
            )
          : await query.delete().eq("announcement_id", announcementId).eq("actor_id", user.id);
        if (error) {
          handleWriteError(error, "Unable to update your reaction.");
          return false;
        }
      }
      setAnnouncements((current) =>
        current.map((item) => {
          if (item.id !== announcementId) return item;
          const others = item.reactions.filter((entry) => entry.actorId !== user.id);
          return {
            ...item,
            reactions: reaction
              ? [
                  ...others,
                  {
                    id: existing?.id || crypto.randomUUID(),
                    announcementId,
                    actorId: user.id,
                    reaction,
                  },
                ]
              : others,
          };
        }),
      );
      return true;
    },
    [announcements, handleWriteError, realMode, user],
  );

  const markAnnouncementRead: AppActions["markAnnouncementRead"] = useCallback(
    (id, partnerId) => {
      setAnnouncements((prev) =>
        prev.map((a) =>
          a.id === id && !a.readBy.includes(partnerId)
            ? { ...a, readBy: [...a.readBy, partnerId] }
            : a,
        ),
      );
      if (realMode && supabase) {
        void supabase
          .from("announcement_reads")
          .insert({ announcement_id: id, partner_id: partnerId })
          .then(({ error }) => {
            if (error && error.code !== "23505") handleWriteError(error);
            reloadAfterWrite();
          });
      }
    },
    [handleWriteError, realMode, reloadAfterWrite],
  );

  const markNotificationRead = useCallback(
    (id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      if (realMode && supabase) {
        void supabase
          .from("notifications")
          .update({ read_at: nowIso() })
          .eq("id", id)
          .then(({ error }) => {
            if (error) handleWriteError(error);
            reloadAfterWrite();
          });
      }
    },
    [handleWriteError, realMode, reloadAfterWrite],
  );
  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (realMode && supabase) {
      const ids = notifications.filter((n) => !n.read).map((n) => n.id);
      if (!ids.length) return;
      void supabase
        .from("notifications")
        .update({ read_at: nowIso() })
        .in("id", ids)
        .then(({ error }) => {
          if (error) handleWriteError(error);
          reloadAfterWrite();
        });
    }
  }, [handleWriteError, notifications, realMode, reloadAfterWrite]);

  const inviteUser: AppActions["inviteUser"] = useCallback((payload, actor) => {
    const item: InvitedUser = {
      ...payload,
      id: payload.id || uid("INV"),
      invitedDate: payload.invitedDate || nowIso(),
      status: "Invited",
    };
    setInvites((prev) => [item, ...prev]);
    pushAudit({
      user: actor,
      action: "User Invited",
      module: "Users",
      details: `${payload.email} (${payload.role})`,
    });
    notify({
      title: "Invitation sent",
      body: `${payload.email} invited as ${payload.role}`,
      type: "info",
      mandatory: true,
    });
  }, []);

  const revokeInvitation: AppActions["revokeInvitation"] = useCallback(
    (id, actor) => {
      const invitation = invites.find((item) => item.id === id);
      const label = invitation?.email || "Pending invitation";
      setInvites((prev) => prev.filter((item) => item.id !== id));
      pushAudit({ user: actor, action: "Invitation Revoked", module: "Users", details: label });
      notify({
        title: "Invitation revoked",
        body: `${label} can no longer use the invitation link.`,
        type: "warning",
        mandatory: true,
      });
    },
    [invites],
  );

  const suspendUser: AppActions["suspendUser"] = useCallback(
    (id, actor) => {
      const targetPartner = partners.some((p) => p.id === id);
      const targetName =
        partners.find((partner) => partner.id === id)?.name ||
        staffUsers.find((staff) => staff.id === id)?.name ||
        "Portal user";
      setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, status: "Suspended" } : p)));
      setStaffUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, accountStatus: "suspended" } : u)),
      );
      pushAudit({ user: actor, action: "Account Suspended", module: "Users", details: targetName });
      notify({
        title: "Account suspended",
        body: `${targetName}'s portal access was suspended.`,
        type: "warning",
        mandatory: true,
      });
      if (realMode && supabase) {
        void (async () => {
          const { error: profileError } = await supabase
            .from("profiles")
            .update({ account_status: "suspended" })
            .or(`id.eq.${id},partner_id.eq.${id}`);
          const { error: partnerError } = await supabase
            .from("partner_profiles")
            .update({ status: "suspended" })
            .eq("id", id);
          if (profileError) handleWriteError(profileError);
          if (partnerError) handleWriteError(partnerError);
          await supabase.from("notifications").insert({
            recipient_id: targetPartner ? null : id,
            partner_id: targetPartner ? id : null,
            title: "Account suspended",
            body: "Your GoAccelovate portal account has been suspended.",
            type: "warning",
            mandatory: true,
          });
          reloadAfterWrite();
        })();
      }
    },
    [handleWriteError, partners, realMode, reloadAfterWrite, staffUsers],
  );

  const reactivateUser: AppActions["reactivateUser"] = useCallback(
    (id, actor) => {
      const targetPartner = partners.some((p) => p.id === id);
      const targetName =
        partners.find((partner) => partner.id === id)?.name ||
        staffUsers.find((staff) => staff.id === id)?.name ||
        "Portal user";
      setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, status: "Active" } : p)));
      setStaffUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, accountStatus: "active" } : u)),
      );
      pushAudit({
        user: actor,
        action: "Account Reactivated",
        module: "Users",
        details: targetName,
      });
      notify({
        title: "Account reactivated",
        body: `${targetName}'s portal access was reinstated.`,
        type: "success",
        mandatory: true,
      });
      if (realMode && supabase) {
        void (async () => {
          const { error: profileError } = await supabase
            .from("profiles")
            .update({ account_status: "active" })
            .or(`id.eq.${id},partner_id.eq.${id}`);
          const { error: partnerError } = await supabase
            .from("partner_profiles")
            .update({ status: "active" })
            .eq("id", id);
          if (profileError) handleWriteError(profileError);
          if (partnerError) handleWriteError(partnerError);
          await supabase.from("notifications").insert({
            recipient_id: targetPartner ? null : id,
            partner_id: targetPartner ? id : null,
            title: "Account reinstated",
            body: "Your GoAccelovate portal account has been reinstated.",
            type: "success",
            mandatory: true,
          });
          reloadAfterWrite();
        })();
      }
    },
    [handleWriteError, partners, realMode, reloadAfterWrite, staffUsers],
  );

  const deleteUser: AppActions["deleteUser"] = useCallback((id, actor) => {
    setPartners((prev) => prev.filter((p) => p.id !== id));
    setInvites((prev) => prev.filter((i) => i.id !== id));
    setStaffUsers((prev) => prev.filter((u) => u.id !== id));
    void actor;
  }, []);

  const changeUserRole: AppActions["changeUserRole"] = useCallback(
    (id, role, actor) => {
      setStaffUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
      pushAudit({
        user: actor,
        action: "Role Changed",
        module: "Users",
        details: `${id}: ${role}`,
      });
      if (realMode && supabase) {
        void supabase
          .from("profiles")
          .update({ role })
          .eq("id", id)
          .then(({ error }) => {
            if (error) handleWriteError(error);
            reloadAfterWrite();
          });
      }
    },
    [handleWriteError, realMode, reloadAfterWrite],
  );

  const changePartnerTier: AppActions["changePartnerTier"] = useCallback(
    (id, tier, actor) => {
      setPartners((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          pushAudit({
            user: actor,
            action: "Tier Change",
            module: "Users",
            details: id,
            oldValue: p.tier,
            newValue: tier,
          });
          return { ...p, tier: tier as Partner["tier"] };
        }),
      );
      if (realMode && supabase) {
        void supabase
          .from("partner_profiles")
          .update({ tier: tier as Tier })
          .eq("id", id)
          .then(({ error }) => {
            if (error) handleWriteError(error);
            reloadAfterWrite();
          });
      }
    },
    [handleWriteError, realMode, reloadAfterWrite],
  );

  const changePartnerRate: AppActions["changePartnerRate"] = useCallback(
    (id, rate, actor) => {
      setPartners((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          pushAudit({
            user: actor,
            action: "Commission Rate Change",
            module: "Users",
            details: id,
            oldValue: `${p.commissionRate}%`,
            newValue: `${rate}%`,
          });
          return { ...p, commissionRate: rate };
        }),
      );
      if (realMode && supabase) {
        void supabase
          .from("partner_profiles")
          .update({ commission_rate: rate })
          .eq("id", id)
          .then(({ error }) => {
            if (error) handleWriteError(error);
            reloadAfterWrite();
          });
      }
    },
    [handleWriteError, realMode, reloadAfterWrite],
  );

  const updatePartnerProfile: AppActions["updatePartnerProfile"] = useCallback(
    (id, patch, actor) => {
      setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      if (actor) {
        pushAudit({
          user: actor,
          action: "Partner Profile Updated",
          module: "Users",
          details: id,
          newValue: Object.keys(patch).join(", "),
        });
        notify({
          title: "Partner profile updated",
          body: `${id}: ${Object.keys(patch).join(", ")}`,
          type: "info",
        });
      }
      if (realMode && supabase) {
        const dbPatch: {
          name?: string;
          email?: string;
          phone?: string;
          linkedin?: string;
          city?: string;
          country?: string;
          bio?: string;
          tier?: Tier;
          commission_rate?: number;
          assigned_contact?: string;
          status?: "active" | "suspended" | "pending" | "deactivated";
        } = {};
        if (patch.name !== undefined) dbPatch.name = patch.name;
        if (patch.phone !== undefined) dbPatch.phone = patch.phone;
        if (patch.linkedin !== undefined) dbPatch.linkedin = patch.linkedin;
        if (patch.city !== undefined) dbPatch.city = patch.city;
        if (patch.country !== undefined) dbPatch.country = patch.country;
        if (patch.bio !== undefined) dbPatch.bio = patch.bio;
        if (user?.role !== "partner") {
          if (patch.email !== undefined) dbPatch.email = patch.email;
          if (patch.tier !== undefined) dbPatch.tier = patch.tier;
          if (patch.commissionRate !== undefined) dbPatch.commission_rate = patch.commissionRate;
          if (patch.assignedContact !== undefined) dbPatch.assigned_contact = patch.assignedContact;
        }
        if (user?.role === "super_admin" && patch.status !== undefined) {
          dbPatch.status = toDbPartnerStatus(patch.status);
        }
        void supabase
          .from("partner_profiles")
          .update(dbPatch)
          .eq("id", id)
          .then(({ error }) => {
            if (error) handleWriteError(error);
            reloadAfterWrite();
          });
      }
    },
    [handleWriteError, realMode, reloadAfterWrite, user?.role],
  );

  const addPartnerDocument: AppActions["addPartnerDocument"] = useCallback(
    (partnerId, payload, actor) => {
      const validationError = validateUploadFile(payload.file, STORAGE_BUCKETS.partnerDocuments);
      if (validationError) {
        toast.error(validationError);
        return Promise.resolve(false);
      }

      if (realMode && supabase) {
        return (async () => {
          const storagePath = buildStoragePath(user?.id, partnerId, payload.file);
          const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKETS.partnerDocuments)
            .upload(storagePath, payload.file, {
              contentType: payload.file.type,
              upsert: false,
            });
          if (uploadError) {
            handleWriteError(uploadError, "Partner document upload failed.");
            return false;
          }

          const { error: metadataError } = await supabase.from("partner_documents").insert({
            partner_id: partnerId,
            name: payload.file.name,
            document_type: payload.type,
            storage_bucket: STORAGE_BUCKETS.partnerDocuments,
            storage_path: storagePath,
            is_private: Boolean(payload.private),
            uploaded_by: user?.id || null,
          });
          if (metadataError) {
            await supabase.storage.from(STORAGE_BUCKETS.partnerDocuments).remove([storagePath]);
            handleWriteError(metadataError, "Partner document metadata could not be saved.");
            return false;
          }

          toast.success("Document uploaded");
          reloadAfterWrite();
          return true;
        })();
      }

      const doc: PartnerDocument = {
        id: uid("PD"),
        partnerId,
        name: payload.file.name,
        type: payload.type,
        uploadedDate: nowIso(),
        uploadedBy: actor,
        private: Boolean(payload.private),
      };
      setPartnerDocuments((prev) => ({ ...prev, [partnerId]: [doc, ...(prev[partnerId] || [])] }));
      pushAudit({
        user: actor,
        action: "Partner Document Uploaded",
        module: "Users",
        details: `${partnerId}: ${payload.file.name}`,
      });
      notify({ title: "Partner document uploaded", body: payload.file.name, type: "info" });
      toast.success("Document uploaded");
      return Promise.resolve(true);
    },
    [handleWriteError, realMode, reloadAfterWrite, user?.id],
  );

  const setOnboardingStep: AppActions["setOnboardingStep"] = useCallback(
    (partnerId, key, value, actor) => {
      setOnboarding((prev) => ({
        ...prev,
        [partnerId]: { ...(prev[partnerId] || {}), [key]: value },
      }));
      pushAudit({
        user: actor,
        action: "Onboarding Step",
        module: "Users",
        details: `${partnerId}:${key}`,
        newValue: value ? "Done" : "Reset",
      });
      if (realMode && supabase) {
        void (async () => {
          const { data: step, error: stepError } = await supabase
            .from("onboarding_steps")
            .select("id")
            .eq("key", key)
            .maybeSingle();
          if (stepError || !step) {
            handleWriteError(stepError || new Error("Onboarding step not found."));
            return;
          }
          const { data: existing, error: existingError } = await supabase
            .from("partner_onboarding_steps")
            .select("id")
            .eq("partner_id", partnerId)
            .eq("step_id", step.id)
            .maybeSingle();
          if (existingError) {
            handleWriteError(existingError);
            return;
          }
          const payload = {
            partner_id: partnerId,
            step_id: step.id,
            completed: value,
            completed_at: value ? nowIso() : null,
            completed_by: user?.id || null,
          };
          const { error } = existing
            ? await supabase.from("partner_onboarding_steps").update(payload).eq("id", existing.id)
            : await supabase.from("partner_onboarding_steps").insert(payload);
          if (error) handleWriteError(error);
          reloadAfterWrite();
        })();
      }
    },
    [handleWriteError, realMode, reloadAfterWrite, user?.id],
  );

  const updateSettings: AppActions["updateSettings"] = useCallback(
    (patch, actor) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        pushAudit({
          user: actor,
          action: "Settings Updated",
          module: "Settings",
          details: Object.keys(patch).join(", "),
          oldValue: stringifyValue(
            Object.fromEntries(Object.keys(patch).map((key) => [key, prev[key as keyof Settings]])),
          ),
          newValue: stringifyValue(patch),
        });
        return next;
      });
      if (realMode && supabase) {
        const rows: { key: string; value: Json; updated_by: string | null }[] = [
          ["default_commission_rates", patch.defaultRates],
          ["lead_staleness_threshold_days", patch.staleThreshold],
          ["payout_window_days", patch.payoutWindow],
          ["supported_currencies", patch.currencies],
          ["industries", patch.industries],
          ["pipeline_stage_labels", patch.pipelineLabels],
          ["partner_tier_labels", patch.tierLabels],
          ["invitation_expiry_hours", patch.invitationExpiry],
          ["onboarding_checklist_steps", patch.onboardingSteps],
          ["announcement_attachment_max_bytes", patch.announcementAttachmentMaxBytes],
          ["welcome_intro_video_url", patch.welcomeIntroVideoUrl],
        ].reduce<{ key: string; value: Json; updated_by: string | null }[]>((acc, [key, value]) => {
          if (value !== undefined)
            acc.push({ key: String(key), value: value as Json, updated_by: user?.id || null });
          return acc;
        }, []);
        if (rows.length) {
          void supabase
            .from("settings")
            .upsert(rows, { onConflict: "key" })
            .then(({ error }) => {
              if (error) handleWriteError(error);
              reloadAfterWrite();
            });
        }
      }
    },
    [handleWriteError, realMode, reloadAfterWrite, user?.id],
  );

  const value: Ctx = {
    hydrated,
    partners,
    leads,
    commissions,
    payouts,
    clientPayments,
    calls,
    activity,
    announcements,
    notifications,
    audit,
    onboarding,
    invites,
    staffUsers,
    settings,
    attachments,
    partnerDocuments,
    addLead,
    updateLeadStage,
    updateLeadStatus,
    updateOwnLead,
    addComment,
    addAttachment,
    closeLeadWon,
    deleteLead,
    updateEstimatedValue,
    addCall,
    overrideCommissionRate,
    addManualCommission,
    setCommissionState,
    waiveCommission,
    requestPayout,
    approvePayout,
    rejectPayout,
    recordPayoutPayment,
    recordClientPayment,
    publishAnnouncement,
    addAnnouncementComment,
    setAnnouncementReaction,
    markAnnouncementRead,
    markNotificationRead,
    markAllNotificationsRead,
    inviteUser,
    revokeInvitation,
    suspendUser,
    reactivateUser,
    deleteUser,
    changeUserRole,
    changePartnerTier,
    changePartnerRate,
    updatePartnerProfile,
    addPartnerDocument,
    downloadStoredFile,
    setOnboardingStep,
    updateSettings,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

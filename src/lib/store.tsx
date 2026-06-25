/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { useAuth } from "./auth";
import { buildStoragePath, STORAGE_BUCKETS, validateUploadFile } from "./file-upload";
import type { Json } from "./database.types";
import { isSupabaseConfigured, supabase } from "./supabase";
import { isAnnouncementTargeted } from "./announcements";
import {
  DEMO_USERS,
  PARTNERS as INITIAL_PARTNERS,
  LEADS as INITIAL_LEADS,
  COMMISSIONS as INITIAL_COMMISSIONS,
  PAYOUTS as INITIAL_PAYOUTS,
  CLIENT_PAYMENTS as INITIAL_CLIENT_PAYMENTS,
  DISCOVERY_CALLS as INITIAL_CALLS,
  ACTIVITY as INITIAL_ACTIVITY,
  ANNOUNCEMENTS as INITIAL_ANN,
  NOTIFICATIONS as INITIAL_NOTIF,
  AUDIT_LOG as INITIAL_AUDIT,
  PARTNER_ONBOARDING as INITIAL_ONBOARDING,
  ONBOARDING_STEPS,
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
} from "./mock-data";

export interface Dispute {
  id: string;
  commissionId: string;
  partnerId: string;
  openedDate: string;
  reason: string;
  status: "Open" | "Under Review" | "Resolved" | "Rejected";
  resolution?: string;
  thread: { id: string; user: string; text: string; date: string }[];
}

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
}

export interface InvitedUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "partner";
  tier?: string;
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
  disputes: Dispute[];
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
  closeLeadWon: (id: string, confirmedValue: number, actor: string) => void;
  addComment: (leadId: string, text: string, actor: string, isPrivate?: boolean) => void;
  addAttachment: (
    leadId: string,
    file: File,
    actor: string,
    isPrivate?: boolean,
  ) => Promise<boolean>;
  approveDuplicate: (leadId: string, actor: string, reason: string) => void;
  rejectDuplicate: (leadId: string, actor: string, reason: string) => void;
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
  openDispute: (commissionId: string, partnerId: string, reason: string, actor: string) => void;
  replyDispute: (disputeId: string, text: string, actor: string) => void;
  resolveDispute: (disputeId: string, resolution: string, accept: boolean, actor: string) => void;
  // Payouts
  requestPayout: (
    partnerId: string,
    commissionIds: string[],
    message: string,
    actor: string,
  ) => void;
  approvePayout: (payoutId: string, actor: string) => void;
  rejectPayout: (payoutId: string, reason: string, actor: string) => void;
  recordPayoutPayment: (
    payoutId: string,
    payload: { method: string; reference: string; date: string },
    actor: string,
  ) => void;
  // Client payments
  recordClientPayment: (
    payload: Omit<ClientPayment, "id"> & { triggerEligibility?: boolean },
    actor: string,
  ) => void;
  // Announcements
  publishAnnouncement: (a: Omit<Announcement, "id" | "date" | "readBy">, actor: string) => void;
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
      tier?: string;
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
  industries: [
    "SaaS",
    "Manufacturing",
    "FinTech",
    "HealthTech",
    "Logistics",
    "Retail",
    "Energy",
    "Education",
  ],
  pipelineLabels: [
    "New Lead",
    "In Conversation",
    "Discovery Call",
    "Proposal Sent",
    "Negotiation",
    "Closed Won",
    "Closed Lost",
  ],
  onboardingSteps: ONBOARDING_STEPS.map((s) => s.label),
  tierLabels: ["Associate", "Specialist", "Partner"],
};

const EMPTY_ONBOARDING: Record<string, Record<string, boolean>> = {};
const EMPTY_ATTACHMENTS: Record<string, StoredAttachment[]> = {};
const EMPTY_PARTNER_DOCS: Record<string, PartnerDocument[]> = {};

const asPartnerStatus = (status: string): Partner["status"] => {
  if (status === "suspended") return "Suspended";
  if (status === "pending") return "Pending";
  return "Active";
};

const toDbPartnerStatus = (status?: Partner["status"]) => {
  if (status === "Suspended") return "suspended";
  if (status === "Pending") return "pending";
  if (status === "Active") return "active";
  return undefined;
};

const stringifyValue = (value: unknown) => {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
};

const publicId = (prefix: string) => `${prefix}-${Math.floor(Math.random() * 90000 + 10000)}`;

function announcementTarget(target: string, partners: Partner[]) {
  if (target === "All partners") return { target_type: "all_partners", target_rules: {} };
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
  if (target.startsWith("Selected partners:")) {
    const raw = target.replace("Selected partners:", "");
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

function mapNotification(row: any): Notification {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    date: row.created_at,
    read: Boolean(row.read_at),
    type: row.type,
    mandatory: row.mandatory,
  };
}

function mapAnnouncement(row: any, reads: any[]): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    priority: row.priority,
    target: row.target_type,
    date: row.published_at,
    readBy: reads.filter((read) => read.announcement_id === row.id).map((read) => read.partner_id),
  };
}

function mapAudit(row: any): AuditEntry {
  return {
    id: row.id,
    user: row.actor_name,
    action: row.action,
    module: row.module,
    date: row.created_at,
    details: row.record_name || row.record_id || "",
    oldValue: stringifyValue(row.old_value),
    newValue: stringifyValue(row.new_value),
  };
}

function mapDispute(row: any, messages: any[]): Dispute {
  return {
    id: row.id,
    commissionId: row.commission_id,
    partnerId: row.partner_id,
    openedDate: row.created_at,
    reason: row.reason,
    status: row.status,
    resolution: row.resolution || undefined,
    thread: messages
      .filter((message) => message.dispute_id === row.id)
      .map((message) => ({
        id: message.id,
        user: message.actor_name,
        text: message.text,
        date: message.created_at,
      })),
  };
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
  const realMode = ready && authMode === "supabase" && isSupabaseConfigured && Boolean(supabase);
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
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  /*
  const [legacyDemoDisputes] = useState<Dispute[]>([
    {
      id: "D-7001",
      commissionId: "C-2003",
      partnerId: "p9",
      openedDate: "2025-06-12",
      reason: "Amount calculated against estimated value, not confirmed value.",
      status: "Under Review",
      thread: [
        {
          id: "t1",
          user: "Fatima Al-Mansouri",
          text: "Please review the commission base — should reflect confirmed value of $640k.",
          date: "2025-06-12T09:00",
        },
        {
          id: "t2",
          user: "Marcus Reid",
          text: "Investigating with finance. Will revert by end of week.",
          date: "2025-06-13T11:00",
        },
      ],
    },
  ]);
  */
  const [onboarding, setOnboarding] = useState<Record<string, Record<string, boolean>>>({});
  const [invites, setInvites] = useState<InvitedUser[]>([]);
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [attachments, setAttachments] = useState<
    Record<string, { id: string; name: string; date: string }[]>
  >({});
  const [partnerDocuments, setPartnerDocuments] = useState<Record<string, PartnerDocument[]>>({});
  /*
  const [legacyDemoPartnerDocuments] = useState<Record<string, PartnerDocument[]>>({
    p1: [
      {
        id: "PD-1",
        partnerId: "p1",
        name: "Partner_Agreement_Signed.pdf",
        type: "Agreement",
        uploadedDate: "2024-03-12",
        uploadedBy: "Marcus Reid",
      },
      {
        id: "PD-2",
        partnerId: "p1",
        name: "NDA_Executed.pdf",
        type: "NDA",
        uploadedDate: "2024-03-12",
        uploadedBy: "Marcus Reid",
      },
      {
        id: "PD-3",
        partnerId: "p1",
        name: "Commission_Schedule.pdf",
        type: "Commission Schedule",
        uploadedDate: "2024-03-14",
        uploadedBy: "Alexandra Pierce",
      },
    ],
  });
  */

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
    setDisputes([]);
    setOnboarding(EMPTY_ONBOARDING);
    setInvites([]);
    setStaffUsers([]);
    setSettings(DEFAULT_SETTINGS);
    setAttachments(EMPTY_ATTACHMENTS);
    setPartnerDocuments(EMPTY_PARTNER_DOCS);
  }, []);

  const loadDemoState = useCallback(() => {
    setPartners(INITIAL_PARTNERS);
    setLeads(INITIAL_LEADS);
    setCommissions(INITIAL_COMMISSIONS);
    setPayouts(INITIAL_PAYOUTS);
    setClientPayments(INITIAL_CLIENT_PAYMENTS);
    setCalls(INITIAL_CALLS);
    setActivity(INITIAL_ACTIVITY);
    setAnnouncements(INITIAL_ANN);
    setNotifications(INITIAL_NOTIF);
    setAudit(INITIAL_AUDIT);
    setDisputes([
      {
        id: "D-7001",
        commissionId: "C-2003",
        partnerId: "p9",
        openedDate: "2025-06-12",
        reason: "Amount calculated against estimated value, not confirmed value.",
        status: "Under Review",
        thread: [
          {
            id: "t1",
            user: "Fatima Al-Mansouri",
            text: "Please review the commission base - should reflect confirmed value of $640k.",
            date: "2025-06-12T09:00",
          },
          {
            id: "t2",
            user: "Marcus Reid",
            text: "Investigating with finance. Will revert by end of week.",
            date: "2025-06-13T11:00",
          },
        ],
      },
    ]);
    setOnboarding(INITIAL_ONBOARDING);
    setInvites([]);
    setStaffUsers(DEMO_USERS);
    setSettings(DEFAULT_SETTINGS);
    setAttachments({
      "L-1000": [
        { id: "f1", name: "Proposal_v2.pdf", date: "2025-06-15" },
        { id: "f2", name: "Company_Overview.pdf", date: "2025-06-10" },
      ],
    });
    setPartnerDocuments({
      p1: [
        {
          id: "PD-1",
          partnerId: "p1",
          name: "Partner_Agreement_Signed.pdf",
          type: "Agreement",
          uploadedDate: "2024-03-12",
          uploadedBy: "Marcus Reid",
        },
        {
          id: "PD-2",
          partnerId: "p1",
          name: "NDA_Executed.pdf",
          type: "NDA",
          uploadedDate: "2024-03-12",
          uploadedBy: "Marcus Reid",
        },
        {
          id: "PD-3",
          partnerId: "p1",
          name: "Commission_Schedule.pdf",
          type: "Commission Schedule",
          uploadedDate: "2024-03-14",
          uploadedBy: "Alexandra Pierce",
        },
      ],
    });
  }, []);

  const refreshSupabaseState = useCallback(async () => {
    if (!supabase || !user) return;

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
      notificationsRes,
      auditRes,
      disputesRes,
      disputeMessagesRes,
      onboardingRes,
      attachmentsRes,
      documentsRes,
      settingsRes,
      profilesRes,
      invitationsRes,
    ] = await Promise.all([
      supabase.from("partner_profiles").select("*").order("name"),
      supabase.from("leads").select("*").order("created_at", { ascending: false }),
      supabase.from("commissions").select("*").order("created_at", { ascending: false }),
      supabase.from("payout_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("payout_request_items").select("*"),
      supabase.from("client_payments").select("*").order("created_at", { ascending: false }),
      supabase.from("discovery_calls").select("*").order("call_at", { ascending: false }),
      supabase.from("lead_activity_log").select("*").order("created_at", { ascending: false }),
      supabase.from("announcements").select("*").order("published_at", { ascending: false }),
      supabase.from("announcement_reads").select("*"),
      supabase.from("notifications").select("*").order("created_at", { ascending: false }),
      supabase.from("audit_log").select("*").order("created_at", { ascending: false }),
      supabase.from("disputes").select("*").order("created_at", { ascending: false }),
      supabase.from("dispute_messages").select("*").order("created_at", { ascending: true }),
      supabase
        .from("partner_onboarding_steps")
        .select("partner_id,completed,onboarding_steps(key)"),
      supabase.from("lead_attachments").select("*").order("uploaded_at", { ascending: false }),
      supabase.from("partner_documents").select("*").order("uploaded_at", { ascending: false }),
      supabase.from("settings").select("*"),
      supabase
        .from("profiles")
        .select("id,email,full_name,role,account_status,partner_id,avatar_url"),
      supabase.from("invitations").select("*").order("created_at", { ascending: false }),
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
      notificationsRes,
      auditRes,
      disputesRes,
      disputeMessagesRes,
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
    const disputeMessages = disputeMessagesRes.data || [];
    const reads = announcementReadsRes.data || [];

    setPartners((partnersRes.data || []).map(mapPartner));
    setLeads((leadsRes.data || []).map(mapLead));
    setCommissions((commissionsRes.data || []).map(mapCommission));
    setPayouts((payoutRequestsRes.data || []).map((row) => mapPayout(row, payoutItems)));
    setClientPayments((clientPaymentsRes.data || []).map(mapClientPayment));
    setCalls((callsRes.data || []).map(mapCall));
    setActivity((activityRes.data || []).map(mapActivity));
    setAnnouncements((announcementsRes.data || []).map((row) => mapAnnouncement(row, reads)));
    setNotifications((notificationsRes.data || []).map(mapNotification));
    setAudit((auditRes.data || []).map(mapAudit));
    setDisputes((disputesRes.data || []).map((row) => mapDispute(row, disputeMessages)));
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
    setInvites(
      (invitationsRes.data || []).map((invitation: any) => ({
        id: invitation.id,
        name: invitation.email,
        email: invitation.email,
        role: invitation.role,
        tier: invitation.tier || undefined,
        invitedDate: invitation.created_at,
        status: "Invited",
      })),
    );
  }, [user]);

  useEffect(() => {
    if (!ready) return;
    if (authMode === "demo") {
      loadDemoState();
      return;
    }
    if (!realMode) {
      clearBusinessState();
      return;
    }
    refreshSupabaseState().catch((error) => {
      console.error(error);
      toast.error("Unable to load Supabase business data.");
      clearBusinessState();
    });
  }, [authMode, clearBusinessState, loadDemoState, ready, realMode, refreshSupabaseState]);

  const handleWriteError = useCallback((error: unknown, fallback = "Supabase write failed.") => {
    console.error(error);
    toast.error(error instanceof Error ? error.message : fallback);
  }, []);

  const reloadAfterWrite = useCallback(() => {
    if (!realMode) return;
    void refreshSupabaseState().catch((error) =>
      handleWriteError(error, "Unable to refresh data."),
    );
  }, [handleWriteError, realMode, refreshSupabaseState]);

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

  const pushAudit = (entry: Omit<AuditEntry, "id" | "date">) => {
    setAudit((a) => [{ ...entry, id: uid("AU"), date: nowIso() }, ...a]);
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

  const persistCurrentNotification = (n: Omit<Notification, "id" | "date" | "read">) => {
    if (!realMode || !supabase || !user?.id || user.role === "partner") return;
    void supabase
      .from("notifications")
      .insert({
        recipient_id: user.id,
        title: n.title,
        body: n.body,
        type: n.type,
        mandatory: Boolean(n.mandatory),
      })
      .then(({ error }) => {
        if (error) handleWriteError(error);
      });
  };

  const notify = (
    n: Omit<Notification, "id" | "date" | "read">,
    options: { persist?: boolean } = {},
  ) => {
    setNotifications((ns) => [{ ...n, id: uid("N"), date: nowIso(), read: false }, ...ns]);
    if (options.persist !== false) persistCurrentNotification(n);
  };

  const notifyPartner = useCallback(
    async (partnerId: string, payload: Omit<Notification, "id" | "date" | "read">) => {
      notify(payload, { persist: false });
      if (!realMode || !supabase) return;
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
        const { data, error } = await supabase.rpc("submit_partner_lead", {
          lead_id: id,
          company_name: l.company,
          contact_name: l.contactName,
          contact_title: l.contactTitle,
          contact_email: l.contactEmail,
          contact_phone: l.contactPhone,
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
        const realLead = mapLead(data);
        setLeads((prev) => [realLead, ...prev.filter((item) => item.id !== realLead.id)]);
        reloadAfterWrite();
        return realLead;
      }

      const id = `L-${1100 + Math.floor(Math.random() * 9000)}`;
      const status: LeadStatus = l.isDuplicate ? "Duplicate Under Review" : "Active";
      const lead: Lead = {
        ...l,
        id,
        stage: "New Lead",
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
    [handleWriteError, realMode, reloadAfterWrite],
  );

  const updateLeadStage: AppActions["updateLeadStage"] = useCallback(
    (id, stage, actor, reason) => {
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== id) return l;
          const next = { ...l, stage, lastActivity: nowIso() } as Lead;
          if (stage === "Closed Won") next.status = "Closed Won";
          else if (stage === "Closed Lost") next.status = "Closed Lost";
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
      if (realMode && supabase) {
        const existing = leads.find((lead) => lead.id === id);
        if (stage === "Closed Won" && !existing?.confirmedValue) {
          toast.error("Closed Won requires a confirmed deal value.");
          reloadAfterWrite();
          return;
        }
        const patch: Record<string, unknown> = {
          stage,
          last_activity_at: nowIso(),
        };
        if (stage === "Closed Won") patch.status = "Closed Won";
        if (stage === "Closed Lost") {
          patch.status = "Closed Lost";
          patch.closed_reason = reason || "Closed lost";
        }
        void (supabase as any)
          .from("leads")
          .update(patch)
          .eq("id", id)
          .then(({ error }: { error: unknown }) => {
            if (error) handleWriteError(error);
            if (!error && existing && stage !== "Closed Won") {
              void notifyPartner(existing.partnerId, {
                title: "Lead stage updated",
                body: `${existing.company} moved to ${stage}.${reason ? ` Reason: ${reason}` : ""}`,
                type: stage === "Closed Lost" ? "warning" : "info",
              });
            }
            reloadAfterWrite();
          });
      }
    },
    [commissions, handleWriteError, leads, notifyPartner, partners, realMode, reloadAfterWrite],
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
        if (["Closed Lost", "Disqualified", "Reopened"].includes(status)) {
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
                  status === "Closed Lost" ||
                  status === "Duplicate Rejected" ||
                  status === "Disqualified"
                    ? "warning"
                    : "info",
              });
            }
            reloadAfterWrite();
          });
      }
    },
    [handleWriteError, leads, notifyPartner, realMode, reloadAfterWrite],
  );

  const closeLeadWon: AppActions["closeLeadWon"] = useCallback(
    (id, confirmedValue, actor) => {
      const lead = leads.find((l) => l.id === id);
      if (!lead) return;
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
                  state: c.state === "Paid" ? c.state : "On Hold",
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
        void (async () => {
          const { error: leadError } = await supabase
            .from("leads")
            .update({
              stage: "Closed Won",
              status: "Closed Won",
              confirmed_value: confirmedValue,
              last_activity_at: nowIso(),
            })
            .eq("id", id);
          if (leadError) {
            handleWriteError(leadError);
            reloadAfterWrite();
            return;
          }

          const existing = commissions.find(
            (c) => c.leadId === id && (c.kind || "Deal") === "Deal",
          );
          const payload = {
            lead_id: id,
            partner_id: lead.partnerId,
            kind: "Deal" as const,
            rate: partner.commissionRate,
            base_amount: confirmedValue,
            amount,
            state: "On Hold" as const,
            closed_date: new Date().toISOString().slice(0, 10),
            created_by: user?.id || null,
          };
          const { error: commissionError } = existing
            ? await supabase.from("commissions").update(payload).eq("id", existing.id)
            : await supabase.from("commissions").insert(payload);
          if (commissionError) handleWriteError(commissionError);
          await notifyPartner(lead.partnerId, {
            title: "Deal closed won",
            body: `${lead.company} commission is on hold until payment eligibility.`,
            type: "success",
            mandatory: true,
          });
          reloadAfterWrite();
        })();
      }
    },
    [
      commissions,
      handleWriteError,
      leads,
      notifyPartner,
      partners,
      realMode,
      reloadAfterWrite,
      user?.id,
    ],
  );

  const addComment: AppActions["addComment"] = useCallback(
    (leadId, text, actor, isPrivate) => {
      const lead = leads.find((item) => item.id === leadId);
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
        if (realMode && lead) {
          void notifyPartner(lead.partnerId, {
            title: "New lead comment",
            body: `${lead.company}: ${text.slice(0, 160)}`,
            type: "info",
          });
        }
      }
    },
    [leads, notifyPartner, realMode],
  );

  const addAttachment: AppActions["addAttachment"] = useCallback(
    async (leadId, file, actor, isPrivate = false) => {
      const validationError = validateUploadFile(file, STORAGE_BUCKETS.leadAttachments);
      if (validationError) {
        toast.error(validationError);
        return false;
      }

      if (realMode && supabase) {
        const storagePath = buildStoragePath(user?.id, leadId, file);
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKETS.leadAttachments)
          .upload(storagePath, file, { contentType: file.type, upsert: false });
        if (uploadError) {
          handleWriteError(uploadError, "Attachment upload failed.");
          return false;
        }

        const { error: metadataError } = await supabase.from("lead_attachments").insert({
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

        if (!isPrivate) {
          const lead = leads.find((item) => item.id === leadId);
          if (lead) {
            await notifyPartner(lead.partnerId, {
              title: "New lead attachment",
              body: `${file.name} was uploaded for ${lead.company}.`,
              type: "info",
            });
          }
        }
        toast.success(`${file.name} uploaded`);
        reloadAfterWrite();
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
    [handleWriteError, leads, notifyPartner, realMode, reloadAfterWrite, user?.id],
  );

  const approveDuplicate: AppActions["approveDuplicate"] = useCallback(
    (leadId, actor, reason) => {
      if (!reason.trim()) {
        toast.error("Duplicate override reason is required.");
        return;
      }
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: "Active", lastActivity: nowIso() } : l)),
      );
      pushActivity({
        leadId,
        type: "system",
        user: actor,
        text: `Duplicate override allowed: ${reason}`,
      });
      pushAudit({
        user: actor,
        action: "Duplicate Override Approved",
        module: "Leads",
        details: `${leadId}: ${reason}`,
      });
      notify({
        title: "Duplicate approved",
        body: `Lead ${leadId} accepted into pipeline`,
        type: "success",
      });
      if (realMode && supabase) {
        const lead = leads.find((item) => item.id === leadId);
        void (supabase.rpc as any)("review_duplicate_lead", {
          lead_id: leadId,
          allow_duplicate: true,
          reason,
        }).then(({ error }: { error: unknown }) => {
          if (error) handleWriteError(error);
          if (!error && lead) {
            void notifyPartner(lead.partnerId, {
              title: "Duplicate review complete",
              body: `${lead.company} was accepted into the pipeline. Reason: ${reason}`,
              type: "success",
              mandatory: true,
            });
          }
          reloadAfterWrite();
        });
      }
    },
    [handleWriteError, leads, notifyPartner, realMode, reloadAfterWrite, user?.id],
  );

  const rejectDuplicate: AppActions["rejectDuplicate"] = useCallback(
    (leadId, actor, reason) => {
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, status: "Duplicate Rejected", lastActivity: nowIso() } : l,
        ),
      );
      pushActivity({ leadId, type: "system", user: actor, text: `Duplicate rejected: ${reason}` });
      pushAudit({
        user: actor,
        action: "Duplicate Rejected",
        module: "Leads",
        details: `${leadId}: ${reason}`,
      });
      notify({
        title: "Duplicate rejected",
        body: `Lead ${leadId} rejected as duplicate`,
        type: "warning",
      });
      if (realMode && supabase) {
        const lead = leads.find((item) => item.id === leadId);
        void (supabase.rpc as any)("review_duplicate_lead", {
          lead_id: leadId,
          allow_duplicate: false,
          reason,
        }).then(({ error }: { error: unknown }) => {
          if (error) handleWriteError(error);
          if (!error && lead) {
            void notifyPartner(lead.partnerId, {
              title: "Lead rejected as duplicate",
              body: `${lead.company} was rejected as duplicate. Reason: ${reason}`,
              type: "warning",
              mandatory: true,
            });
          }
          reloadAfterWrite();
        });
      }
    },
    [handleWriteError, leads, notifyPartner, realMode, reloadAfterWrite, user?.id],
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
      if (realMode && supabase) {
        const { data, error } = await supabase
          .from("discovery_calls")
          .insert({
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
            recording_url: c.attachmentName || null,
            is_private: c.private,
            created_by: user?.id || null,
          })
          .select("id")
          .single();

        if (error) {
          handleWriteError(error);
          return false;
        }

        if (c.attachmentFile) {
          const storagePath = buildStoragePath(user?.id, data.id, c.attachmentFile);
          const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKETS.discoveryCallFiles)
            .upload(storagePath, c.attachmentFile, {
              contentType: c.attachmentFile.type,
              upsert: false,
            });
          if (uploadError) {
            handleWriteError(uploadError, "Discovery call attachment upload failed.");
            reloadAfterWrite();
            return false;
          }

          const { error: metadataError } = await supabase
            .from("discovery_call_attachments")
            .insert({
              discovery_call_id: data.id,
              name: c.attachmentFile.name,
              storage_bucket: STORAGE_BUCKETS.discoveryCallFiles,
              storage_path: storagePath,
              uploaded_by: user?.id || null,
            });
          if (metadataError) {
            await supabase.storage.from(STORAGE_BUCKETS.discoveryCallFiles).remove([storagePath]);
            handleWriteError(
              metadataError,
              "Discovery call attachment metadata could not be saved.",
            );
            reloadAfterWrite();
            return false;
          }
        }

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

      toast.success("Discovery call logged");
      return true;
    },
    [handleWriteError, leads, notifyPartner, realMode, reloadAfterWrite, user?.id],
  );

  const downloadStoredFile: AppActions["downloadStoredFile"] = useCallback(
    async (bucket, path, name) => {
      if (!bucket || !path || !supabase || !realMode) {
        toast.success("Download started (demo)");
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

  const openDispute: AppActions["openDispute"] = useCallback(
    (commissionId, partnerId, reason, actor) => {
      const partner = partners.find((p) => p.id === partnerId);
      const d: Dispute = {
        id: uid("D"),
        commissionId,
        partnerId,
        openedDate: nowIso(),
        reason,
        status: "Open",
        thread: [{ id: uid("t"), user: partner?.name || actor, text: reason, date: nowIso() }],
      };
      setDisputes((ds) => [d, ...ds]);
      setCommissions((prev) =>
        prev.map((c) => (c.id === commissionId ? { ...c, state: "Disputed" } : c)),
      );
      pushAudit({
        user: actor,
        action: "Dispute Opened",
        module: "Commissions",
        details: commissionId,
      });
      notify({
        title: "Commission dispute opened",
        body: `${commissionId} flagged by ${partner?.name || actor}`,
        type: "warning",
      });
      if (realMode && supabase) {
        void supabase
          .rpc("open_commission_dispute", { commission_id: commissionId, reason })
          .then(({ error }) => {
            if (error) handleWriteError(error);
            reloadAfterWrite();
          });
      }
    },
    [handleWriteError, partners, realMode, reloadAfterWrite],
  );

  const replyDispute: AppActions["replyDispute"] = useCallback(
    (id, text, actor) => {
      setDisputes((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                status: "Under Review",
                thread: [...d.thread, { id: uid("t"), user: actor, text, date: nowIso() }],
              }
            : d,
        ),
      );
      if (realMode && supabase) {
        void supabase
          .from("dispute_messages")
          .insert({
            dispute_id: id,
            actor_id: user?.id || null,
            actor_name: actor,
            text,
          })
          .then(({ error }) => {
            if (error) handleWriteError(error);
            reloadAfterWrite();
          });
      }
    },
    [handleWriteError, realMode, reloadAfterWrite, user?.id],
  );

  const resolveDispute: AppActions["resolveDispute"] = useCallback(
    (id, resolution, accept, actor) => {
      setDisputes((prev) =>
        prev.map((d) => {
          if (d.id !== id) return d;
          const next: Dispute = {
            ...d,
            status: accept ? "Resolved" : "Rejected",
            resolution,
            thread: [
              ...d.thread,
              {
                id: uid("t"),
                user: actor,
                text: `${accept ? "Resolved" : "Rejected"}: ${resolution}`,
                date: nowIso(),
              },
            ],
          };
          setCommissions((prev2) =>
            prev2.map((c) =>
              c.id === d.commissionId ? { ...c, state: accept ? "Approved" : "Unpaid" } : c,
            ),
          );
          pushAudit({
            user: actor,
            action: accept ? "Dispute Resolved" : "Dispute Rejected",
            module: "Commissions",
            details: d.commissionId,
          });
          notify({
            title: accept ? "Dispute resolved" : "Dispute rejected",
            body: `${d.commissionId}: ${resolution}`,
            type: accept ? "success" : "warning",
          });
          return next;
        }),
      );
      if (realMode && supabase) {
        const dispute = disputes.find((d) => d.id === id);
        void (async () => {
          const { error: disputeError } = await supabase
            .from("disputes")
            .update({
              status: accept ? "Resolved" : "Rejected",
              resolution,
              resolved_by: user?.id || null,
              resolved_at: nowIso(),
            })
            .eq("id", id);
          if (disputeError) {
            handleWriteError(disputeError);
            reloadAfterWrite();
            return;
          }
          await supabase.from("dispute_messages").insert({
            dispute_id: id,
            actor_id: user?.id || null,
            actor_name: actor,
            text: `${accept ? "Resolved" : "Rejected"}: ${resolution}`,
          });
          if (dispute) {
            const { error: commissionError } = await supabase
              .from("commissions")
              .update({ state: accept ? "Approved" : "Unpaid" })
              .eq("id", dispute.commissionId);
            if (commissionError) handleWriteError(commissionError);
            await notifyPartner(dispute.partnerId, {
              title: accept ? "Dispute resolved" : "Dispute rejected",
              body: `${dispute.commissionId}: ${resolution}`,
              type: accept ? "success" : "warning",
              mandatory: true,
            });
          }
          reloadAfterWrite();
        })();
      }
    },
    [disputes, handleWriteError, notifyPartner, realMode, reloadAfterWrite, user?.id],
  );

  const requestPayout: AppActions["requestPayout"] = useCallback(
    (partnerId, commissionIds, message, actor) => {
      const amount = commissions
        .filter((c) => commissionIds.includes(c.id))
        .reduce((s, c) => s + c.amount, 0);
      const id = uid("PO");
      setPayouts((p) => [
        {
          id,
          partnerId,
          commissionIds,
          amount,
          status: "Pending",
          requestedDate: nowIso(),
          message,
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
        details: `${id} · ${amount}`,
      });
      notify({
        title: "Payout request submitted",
        body: `${id} · $${amount.toLocaleString()}`,
        type: "info",
      });
      if (realMode && supabase) {
        void supabase
          .rpc("request_commission_payout", { commission_ids: commissionIds, message })
          .then(({ error }) => {
            if (error) handleWriteError(error);
            reloadAfterWrite();
          });
      }
    },
    [commissions, handleWriteError, realMode, reloadAfterWrite],
  );

  const approvePayout: AppActions["approvePayout"] = useCallback(
    (id, actor) => {
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
      if (realMode && supabase) {
        const payout = payouts.find((p) => p.id === id);
        void (async () => {
          const { error: payoutError } = await supabase
            .from("payout_requests")
            .update({ status: "Approved", approved_by: user?.id || null, approved_at: nowIso() })
            .eq("id", id);
          if (payoutError) handleWriteError(payoutError);
          if (payout?.commissionIds.length) {
            const { error: commissionError } = await supabase
              .from("commissions")
              .update({ state: "Approved" })
              .in("id", payout.commissionIds);
            if (commissionError) handleWriteError(commissionError);
          }
          if (payout) {
            await notifyPartner(payout.partnerId, {
              title: "Payout approved",
              body: `${id} ready for payment`,
              type: "success",
              mandatory: true,
            });
          }
          reloadAfterWrite();
        })();
      }
    },
    [handleWriteError, notifyPartner, payouts, realMode, reloadAfterWrite, user?.id],
  );

  const rejectPayout: AppActions["rejectPayout"] = useCallback(
    (id, reason, actor) => {
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
      if (realMode && supabase) {
        const payout = payouts.find((p) => p.id === id);
        void (async () => {
          const { error: payoutError } = await supabase
            .from("payout_requests")
            .update({ status: "Rejected", reject_reason: reason })
            .eq("id", id);
          if (payoutError) handleWriteError(payoutError);
          if (payout?.commissionIds.length) {
            const { error: commissionError } = await supabase
              .from("commissions")
              .update({ state: "Unpaid" })
              .in("id", payout.commissionIds);
            if (commissionError) handleWriteError(commissionError);
            await notifyPartner(payout.partnerId, {
              title: "Payout rejected",
              body: `${id}: ${reason}`,
              type: "destructive",
              mandatory: true,
            });
          }
          reloadAfterWrite();
        })();
      }
    },
    [handleWriteError, notifyPartner, payouts, realMode, reloadAfterWrite],
  );

  const recordPayoutPayment: AppActions["recordPayoutPayment"] = useCallback(
    (id, payload, actor) => {
      setPayouts((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          setCommissions((cs) =>
            cs.map((c) => (p.commissionIds.includes(c.id) ? { ...c, state: "Paid" } : c)),
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
      if (realMode && supabase) {
        const payout = payouts.find((p) => p.id === id);
        void (async () => {
          const { error: payoutError } = await supabase
            .from("payout_requests")
            .update({
              status: "Paid",
              paid_amount: payout?.amount || null,
              paid_date: payload.date,
              payment_method: payload.method,
              transaction_reference: payload.reference,
            })
            .eq("id", id);
          if (payoutError) handleWriteError(payoutError);
          if (payout?.commissionIds.length) {
            const { error: commissionError } = await supabase
              .from("commissions")
              .update({ state: "Paid" })
              .in("id", payout.commissionIds);
            if (commissionError) handleWriteError(commissionError);
            await notifyPartner(payout.partnerId, {
              title: "Payout marked as paid",
              body: `${id} - ${payload.method} - ${payload.reference}`,
              type: "success",
              mandatory: true,
            });
          }
          reloadAfterWrite();
        })();
      }
    },
    [handleWriteError, notifyPartner, payouts, realMode, reloadAfterWrite],
  );

  const recordClientPayment: AppActions["recordClientPayment"] = useCallback(
    (payload, actor) => {
      const triggerEligibility = Boolean(payload.triggerEligibility);
      const released = commissions.filter(
        (c) => c.leadId === payload.leadId && c.state === "On Hold",
      );
      setClientPayments((prev) => [{ ...payload, id: uid("CP") }, ...prev]);
      if (triggerEligibility && released.length > 0) {
        setCommissions((prev) =>
          prev.map((c) =>
            c.leadId === payload.leadId && c.state === "On Hold" ? { ...c, state: "Unpaid" } : c,
          ),
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
      if (triggerEligibility && released.length > 0) {
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
      if (realMode && supabase) {
        void (async () => {
          const { error: paymentError } = await supabase.from("client_payments").insert({
            lead_id: payload.leadId,
            amount_received: payload.amount,
            received_date: payload.date,
            payment_method: payload.method,
            payment_reference: payload.reference,
            notes: payload.notes || null,
            trigger_commission_eligibility: triggerEligibility,
            created_by: user?.id || null,
          });
          if (paymentError) handleWriteError(paymentError);
          if (triggerEligibility) {
            const { error: commissionError } = await (supabase as any).rpc(
              "trigger_commission_eligibility",
              {
                lead_id: payload.leadId,
                payment_reference: payload.reference,
              },
            );
            if (commissionError) handleWriteError(commissionError);
            const lead = leads.find((item) => item.id === payload.leadId);
            if (lead) {
              await notifyPartner(lead.partnerId, {
                title: "Commission now payable",
                body: `${lead.company} released for payout after client payment.`,
                type: "success",
                mandatory: true,
              });
            }
          }
          reloadAfterWrite();
        })();
      }
    },
    [commissions, handleWriteError, leads, notifyPartner, realMode, reloadAfterWrite, user?.id],
  );

  const publishAnnouncement: AppActions["publishAnnouncement"] = useCallback(
    (a, actor) => {
      const item: Announcement = { ...a, id: uid("AN"), date: nowIso(), readBy: [] };
      setAnnouncements((prev) => [item, ...prev]);
      pushAudit({
        user: actor,
        action: "Announcement Published",
        module: "Announcements",
        details: a.title,
      });
      notify({ title: "New announcement", body: a.title, type: "info" });
      if (realMode && supabase) {
        const target = announcementTarget(a.target, partners);
        const targetedPartners = partners.filter((partner) =>
          isAnnouncementTargeted(item, partner),
        );
        void (async () => {
          const { error: announcementError } = await supabase.from("announcements").insert({
            title: a.title,
            body: a.body,
            priority: a.priority,
            target_type: target.target_type,
            target_rules: target.target_rules,
            send_email: Boolean((a as any).sendEmail),
            published_by: user?.id || null,
          });
          if (announcementError) {
            handleWriteError(announcementError);
            reloadAfterWrite();
            return;
          }

          if (targetedPartners.length > 0) {
            const { error: notificationError } = await supabase.from("notifications").insert(
              targetedPartners.map((partner) => ({
                partner_id: partner.id,
                title: "New announcement",
                body: `${a.priority}: ${a.title}`,
                type: a.priority === "Urgent" ? "warning" : "info",
                mandatory: a.priority === "Urgent",
              })),
            );
            if (notificationError) handleWriteError(notificationError);
          }
          reloadAfterWrite();
        })();
      }
    },
    [handleWriteError, partners, realMode, reloadAfterWrite, user?.id],
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

  const revokeInvitation: AppActions["revokeInvitation"] = useCallback((id, actor) => {
    setInvites((prev) => prev.filter((i) => i.id !== id));
    pushAudit({ user: actor, action: "Invitation Revoked", module: "Users", details: id });
    notify({ title: "Invitation revoked", body: id, type: "warning", mandatory: true });
  }, []);

  const suspendUser: AppActions["suspendUser"] = useCallback(
    (id, actor) => {
      const targetPartner = partners.some((p) => p.id === id);
      setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, status: "Suspended" } : p)));
      setStaffUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, accountStatus: "suspended" } : u)),
      );
      pushAudit({ user: actor, action: "Account Suspended", module: "Users", details: id });
      notify({ title: "Account suspended", body: id, type: "warning", mandatory: true });
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
    [handleWriteError, partners, realMode, reloadAfterWrite],
  );

  const reactivateUser: AppActions["reactivateUser"] = useCallback(
    (id, actor) => {
      const targetPartner = partners.some((p) => p.id === id);
      setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, status: "Active" } : p)));
      setStaffUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, accountStatus: "active" } : u)),
      );
      pushAudit({ user: actor, action: "Account Reactivated", module: "Users", details: id });
      notify({ title: "Account reactivated", body: id, type: "success", mandatory: true });
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
    [handleWriteError, partners, realMode, reloadAfterWrite],
  );

  const deleteUser: AppActions["deleteUser"] = useCallback(
    (id, actor) => {
      setPartners((prev) => prev.filter((p) => p.id !== id));
      setInvites((prev) => prev.filter((i) => i.id !== id));
      setStaffUsers((prev) => prev.filter((u) => u.id !== id));
      pushAudit({ user: actor, action: "Account Deleted", module: "Users", details: id });
      notify({ title: "Account deleted", body: id, type: "destructive" });
      if (realMode && supabase) {
        void (async () => {
          const { error: profileError } = await supabase
            .from("profiles")
            .update({ account_status: "deactivated" })
            .or(`id.eq.${id},partner_id.eq.${id}`);
          const { error: partnerError } = await supabase
            .from("partner_profiles")
            .update({ status: "deactivated" })
            .eq("id", id);
          if (profileError) handleWriteError(profileError);
          if (partnerError) handleWriteError(partnerError);
          reloadAfterWrite();
        })();
      }
    },
    [handleWriteError, realMode, reloadAfterWrite],
  );

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
          status?: "active" | "suspended" | "pending";
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
    disputes,
    onboarding,
    invites,
    staffUsers,
    settings,
    attachments,
    partnerDocuments,
    addLead,
    updateLeadStage,
    updateLeadStatus,
    addComment,
    addAttachment,
    closeLeadWon,
    approveDuplicate,
    rejectDuplicate,
    addCall,
    overrideCommissionRate,
    addManualCommission,
    setCommissionState,
    waiveCommission,
    openDispute,
    replyDispute,
    resolveDispute,
    requestPayout,
    approvePayout,
    rejectPayout,
    recordPayoutPayment,
    recordClientPayment,
    publishAnnouncement,
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

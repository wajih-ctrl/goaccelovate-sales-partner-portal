import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  DEMO_USERS, PARTNERS as INITIAL_PARTNERS, LEADS as INITIAL_LEADS,
  COMMISSIONS as INITIAL_COMMISSIONS, PAYOUTS as INITIAL_PAYOUTS,
  CLIENT_PAYMENTS as INITIAL_CLIENT_PAYMENTS, DISCOVERY_CALLS as INITIAL_CALLS,
  ACTIVITY as INITIAL_ACTIVITY, ANNOUNCEMENTS as INITIAL_ANN,
  NOTIFICATIONS as INITIAL_NOTIF, AUDIT_LOG as INITIAL_AUDIT,
  PARTNER_ONBOARDING as INITIAL_ONBOARDING, ONBOARDING_STEPS,
  type Partner, type Lead, type LeadStage, type LeadStatus,
  type Commission, type CommissionState, type Payout,
  type ClientPayment, type DiscoveryCall, type ActivityEntry,
  type Announcement, type Notification, type AuditEntry, type User, type Tier,
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
  attachments: Record<string, { id: string; name: string; date: string }[]>;
  partnerDocuments: Record<string, PartnerDocument[]>;
}

interface AppActions {
  // Leads
  addLead: (l: Omit<Lead, "id" | "createdAt" | "lastActivity" | "stage" | "status"> & { isDuplicate?: boolean }, actor: string) => Lead;
  updateLeadStage: (id: string, stage: LeadStage, actor: string) => void;
  updateLeadStatus: (id: string, status: LeadStatus, actor: string) => void;
  closeLeadWon: (id: string, confirmedValue: number, actor: string) => void;
  addComment: (leadId: string, text: string, actor: string, isPrivate?: boolean) => void;
  addAttachment: (leadId: string, name: string, actor: string) => void;
  approveDuplicate: (leadId: string, actor: string) => void;
  rejectDuplicate: (leadId: string, actor: string, reason: string) => void;
  // Discovery calls
  addCall: (c: Omit<DiscoveryCall, "id">, actor: string) => void;
  // Commissions
  overrideCommissionRate: (commissionId: string, newRate: number, actor: string) => void;
  addManualCommission: (payload: { leadId: string; partnerId: string; kind: "Monthly Retainer" | "One-off Bonus"; label: string; amount: number; rate?: number; notes?: string }, actor: string) => void;
  setCommissionState: (commissionId: string, state: CommissionState, actor: string) => void;
  openDispute: (commissionId: string, partnerId: string, reason: string, actor: string) => void;
  replyDispute: (disputeId: string, text: string, actor: string) => void;
  resolveDispute: (disputeId: string, resolution: string, accept: boolean, actor: string) => void;
  // Payouts
  requestPayout: (partnerId: string, commissionIds: string[], message: string, actor: string) => void;
  approvePayout: (payoutId: string, actor: string) => void;
  rejectPayout: (payoutId: string, reason: string, actor: string) => void;
  recordPayoutPayment: (payoutId: string, payload: { method: string; reference: string; date: string }, actor: string) => void;
  // Client payments
  recordClientPayment: (payload: Omit<ClientPayment, "id">, actor: string) => void;
  // Announcements
  publishAnnouncement: (a: Omit<Announcement, "id" | "date" | "readBy">, actor: string) => void;
  markAnnouncementRead: (id: string, partnerId: string) => void;
  // Notifications
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  // Users
  inviteUser: (payload: { name: string; email: string; role: "admin" | "partner"; tier?: string }, actor: string) => void;
  suspendUser: (id: string, actor: string) => void;
  reactivateUser: (id: string, actor: string) => void;
  deleteUser: (id: string, actor: string) => void;
  changePartnerTier: (id: string, tier: string, actor: string) => void;
  changePartnerRate: (id: string, rate: number, actor: string) => void;
  updatePartnerProfile: (id: string, patch: Partial<Partner>, actor?: string) => void;
  addPartnerDocument: (partnerId: string, payload: { name: string; type: PartnerDocument["type"] }, actor: string) => void;
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
  industries: ["SaaS", "Manufacturing", "FinTech", "HealthTech", "Logistics", "Retail", "Energy", "Education"],
  pipelineLabels: ["New Lead", "In Conversation", "Discovery Call", "Proposal Sent", "Negotiation", "Closed Won", "Closed Lost"],
  onboardingSteps: ONBOARDING_STEPS.map(s => s.label),
  tierLabels: ["Associate", "Specialist", "Partner"],
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [partners, setPartners] = useState<Partner[]>(INITIAL_PARTNERS);
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [commissions, setCommissions] = useState<Commission[]>(INITIAL_COMMISSIONS);
  const [payouts, setPayouts] = useState<Payout[]>(INITIAL_PAYOUTS);
  const [clientPayments, setClientPayments] = useState<ClientPayment[]>(INITIAL_CLIENT_PAYMENTS);
  const [calls, setCalls] = useState<DiscoveryCall[]>(INITIAL_CALLS);
  const [activity, setActivity] = useState<ActivityEntry[]>(INITIAL_ACTIVITY);
  const [announcements, setAnnouncements] = useState<Announcement[]>(INITIAL_ANN);
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIF);
  const [audit, setAudit] = useState<AuditEntry[]>(INITIAL_AUDIT);
  const [disputes, setDisputes] = useState<Dispute[]>([
    {
      id: "D-7001", commissionId: "C-2003", partnerId: "p9", openedDate: "2025-06-12",
      reason: "Amount calculated against estimated value, not confirmed value.",
      status: "Under Review",
      thread: [
        { id: "t1", user: "Fatima Al-Mansouri", text: "Please review the commission base — should reflect confirmed value of $640k.", date: "2025-06-12T09:00" },
        { id: "t2", user: "Marcus Reid", text: "Investigating with finance. Will revert by end of week.", date: "2025-06-13T11:00" },
      ],
    },
  ]);
  const [onboarding, setOnboarding] = useState<Record<string, Record<string, boolean>>>(INITIAL_ONBOARDING);
  const [invites, setInvites] = useState<InvitedUser[]>([]);
  const [staffUsers, setStaffUsers] = useState<User[]>(DEMO_USERS);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [attachments, setAttachments] = useState<Record<string, { id: string; name: string; date: string }[]>>({
    "L-1000": [{ id: "f1", name: "Proposal_v2.pdf", date: "2025-06-15" }, { id: "f2", name: "Company_Overview.pdf", date: "2025-06-10" }],
  });
  const [partnerDocuments, setPartnerDocuments] = useState<Record<string, PartnerDocument[]>>({
    p1: [
      { id: "PD-1", partnerId: "p1", name: "Partner_Agreement_Signed.pdf", type: "Agreement", uploadedDate: "2024-03-12", uploadedBy: "Marcus Reid" },
      { id: "PD-2", partnerId: "p1", name: "NDA_Executed.pdf", type: "NDA", uploadedDate: "2024-03-12", uploadedBy: "Marcus Reid" },
      { id: "PD-3", partnerId: "p1", name: "Commission_Schedule.pdf", type: "Commission Schedule", uploadedDate: "2024-03-14", uploadedBy: "Alexandra Pierce" },
    ],
  });

  const pushActivity = (entry: Omit<ActivityEntry, "id" | "date">) =>
    setActivity(a => [{ ...entry, id: uid("A"), date: nowIso() }, ...a]);
  const pushAudit = (entry: Omit<AuditEntry, "id" | "date">) =>
    setAudit(a => [{ ...entry, id: uid("AU"), date: nowIso() }, ...a]);
  const notify = (n: Omit<Notification, "id" | "date" | "read">) =>
    setNotifications(ns => [{ ...n, id: uid("N"), date: nowIso(), read: false }, ...ns]);

  const addLead: AppActions["addLead"] = useCallback((l, actor) => {
    const id = `L-${1100 + Math.floor(Math.random() * 9000)}`;
    const status: LeadStatus = l.isDuplicate ? "Duplicate Under Review" : "Active";
    const lead: Lead = {
      ...l, id, stage: "New Lead", status,
      createdAt: nowIso(), lastActivity: nowIso(),
    };
    setLeads(prev => [lead, ...prev]);
    pushActivity({ leadId: id, type: "system", user: actor, text: `Lead created: ${l.company}` });
    pushAudit({ user: actor, action: "Lead Submitted", module: "Leads", details: `${id} ${l.company}` });
    notify({
      title: l.isDuplicate ? "Duplicate flagged for review" : "New lead submitted",
      body: `${l.company} · ${actor}`,
      type: l.isDuplicate ? "warning" : "info",
    });
    return lead;
  }, []);

  const updateLeadStage: AppActions["updateLeadStage"] = useCallback((id, stage, actor) => {
    setLeads(prev => prev.map(l => {
      if (l.id !== id) return l;
      const next = { ...l, stage, lastActivity: nowIso() } as Lead;
      if (stage === "Closed Won") next.status = "Closed Won";
      else if (stage === "Closed Lost") next.status = "Closed Lost";
      // Auto-create commission on Closed Won
      if (stage === "Closed Won") {
        const partner = partners.find(p => p.id === l.partnerId);
        if (partner && !commissions.find(c => c.leadId === id)) {
          const amount = (l.confirmedValue || l.estimatedValue) * (partner.commissionRate / 100);
          setCommissions(cs => [...cs, {
            id: uid("C"), leadId: id, partnerId: l.partnerId,
            rate: partner.commissionRate, amount, state: "On Hold", closedDate: nowIso(), kind: "Deal",
          }]);
        }
      }
      pushActivity({ leadId: id, type: "stage_change", user: actor, text: `Stage changed: ${l.stage} → ${stage}` });
      pushAudit({ user: actor, action: "Stage Change", module: "Leads", details: `${id}`, oldValue: l.stage, newValue: stage });
      notify({ title: "Lead stage updated", body: `${l.company} → ${stage}`, type: "info" });
      return next;
    }));
  }, [partners, commissions]);

  const updateLeadStatus: AppActions["updateLeadStatus"] = useCallback((id, status, actor) => {
    setLeads(prev => prev.map(l => {
      if (l.id !== id) return l;
      pushActivity({ leadId: id, type: "status_change", user: actor, text: `Status changed: ${l.status} → ${status}` });
      pushAudit({ user: actor, action: "Status Change", module: "Leads", details: id, oldValue: l.status, newValue: status });
      return { ...l, status, lastActivity: nowIso() };
    }));
  }, []);

  const closeLeadWon: AppActions["closeLeadWon"] = useCallback((id, confirmedValue, actor) => {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;
    const partner = partners.find(p => p.id === lead.partnerId);
    if (!partner) return;
    const amount = confirmedValue * (partner.commissionRate / 100);
    setLeads(prev => prev.map(l => l.id === id ? {
      ...l,
      stage: "Closed Won",
      status: "Closed Won",
      confirmedValue,
      lastActivity: nowIso(),
    } : l));
    setCommissions(prev => {
      const existing = prev.find(c => c.leadId === id && (c.kind || "Deal") === "Deal");
      if (existing) {
        return prev.map(c => c.id === existing.id ? {
          ...c,
          rate: partner.commissionRate,
          amount,
          state: c.state === "Paid" ? c.state : "On Hold",
          closedDate: nowIso(),
          kind: "Deal",
        } : c);
      }
      return [...prev, {
        id: uid("C"),
        leadId: id,
        partnerId: lead.partnerId,
        rate: partner.commissionRate,
        amount,
        state: "On Hold",
        closedDate: nowIso(),
        kind: "Deal",
      }];
    });
    pushActivity({ leadId: id, type: "stage_change", user: actor, text: `Deal closed won with confirmed value $${confirmedValue.toLocaleString()}` });
    pushAudit({ user: actor, action: "Deal Closed Won", module: "Leads", details: id, oldValue: lead.stage, newValue: `Closed Won · $${confirmedValue}` });
    notify({ title: "Deal closed won", body: `${lead.company} closed at $${confirmedValue.toLocaleString()}. Commission is on hold until client payment.`, type: "success", mandatory: true });
  }, [leads, partners]);

  const addComment: AppActions["addComment"] = useCallback((leadId, text, actor, isPrivate) => {
    pushActivity({ leadId, type: isPrivate ? "admin_note" : "comment", user: actor, text, private: isPrivate });
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, lastActivity: nowIso() } : l));
    if (!isPrivate) {
      notify({ title: "New lead comment", body: `${leadId} · ${actor}: ${text.slice(0, 80)}`, type: "info" });
    }
  }, []);

  const addAttachment: AppActions["addAttachment"] = useCallback((leadId, name, actor) => {
    setAttachments(a => ({ ...a, [leadId]: [...(a[leadId] || []), { id: uid("f"), name, date: nowIso() }] }));
    pushActivity({ leadId, type: "file", user: actor, text: `Uploaded ${name}` });
  }, []);

  const approveDuplicate: AppActions["approveDuplicate"] = useCallback((leadId, actor) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: "Active", lastActivity: nowIso() } : l));
    pushActivity({ leadId, type: "system", user: actor, text: "Duplicate review: Accepted into pipeline" });
    pushAudit({ user: actor, action: "Duplicate Approved", module: "Leads", details: leadId });
    notify({ title: "Duplicate approved", body: `Lead ${leadId} accepted into pipeline`, type: "success" });
  }, []);

  const rejectDuplicate: AppActions["rejectDuplicate"] = useCallback((leadId, actor, reason) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: "Duplicate Rejected", lastActivity: nowIso() } : l));
    pushActivity({ leadId, type: "system", user: actor, text: `Duplicate rejected: ${reason}` });
    pushAudit({ user: actor, action: "Duplicate Rejected", module: "Leads", details: `${leadId}: ${reason}` });
    notify({ title: "Duplicate rejected", body: `Lead ${leadId} rejected as duplicate`, type: "warning" });
  }, []);

  const addCall: AppActions["addCall"] = useCallback((c, actor) => {
    const call = { ...c, id: uid("DC") };
    setCalls(cs => [call, ...cs]);
    pushActivity({ leadId: c.leadId, type: "discovery_call", user: actor, text: `Discovery call logged (${c.duration} min)`, private: c.private });
    pushAudit({ user: actor, action: "Discovery Call Logged", module: "Leads", details: c.leadId });
  }, []);

  const overrideCommissionRate: AppActions["overrideCommissionRate"] = useCallback((id, rate, actor) => {
    setCommissions(prev => prev.map(c => {
      if (c.id !== id) return c;
      const lead = leads.find(l => l.id === c.leadId);
      const base = lead?.confirmedValue || lead?.estimatedValue || c.amount / (c.rate / 100);
      const amount = base * (rate / 100);
      pushAudit({ user: actor, action: "Commission Override", module: "Commissions", details: id, oldValue: `${c.rate}%`, newValue: `${rate}%` });
      notify({ title: "Commission rate overridden", body: `${id} → ${rate}%`, type: "info" });
      return { ...c, rate, amount };
    }));
  }, [leads]);

  const addManualCommission: AppActions["addManualCommission"] = useCallback((payload, actor) => {
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
    setCommissions(prev => [item, ...prev]);
    pushAudit({ user: actor, action: "Manual Commission Added", module: "Commissions", details: `${payload.kind}: ${payload.label}`, newValue: `$${payload.amount}` });
    notify({ title: "Manual commission added", body: `${payload.label} · $${payload.amount.toLocaleString()}`, type: "success" });
  }, []);

  const setCommissionState: AppActions["setCommissionState"] = useCallback((id, state, actor) => {
    setCommissions(prev => prev.map(c => {
      if (c.id !== id) return c;
      pushAudit({ user: actor, action: "Commission State Change", module: "Commissions", details: id, oldValue: c.state, newValue: state });
      return { ...c, state };
    }));
  }, []);

  const openDispute: AppActions["openDispute"] = useCallback((commissionId, partnerId, reason, actor) => {
    const partner = partners.find(p => p.id === partnerId);
    const d: Dispute = {
      id: uid("D"), commissionId, partnerId, openedDate: nowIso(), reason,
      status: "Open",
      thread: [{ id: uid("t"), user: partner?.name || actor, text: reason, date: nowIso() }],
    };
    setDisputes(ds => [d, ...ds]);
    setCommissions(prev => prev.map(c => c.id === commissionId ? { ...c, state: "Disputed" } : c));
    pushAudit({ user: actor, action: "Dispute Opened", module: "Commissions", details: commissionId });
    notify({ title: "Commission dispute opened", body: `${commissionId} flagged by ${partner?.name || actor}`, type: "warning" });
  }, [partners]);

  const replyDispute: AppActions["replyDispute"] = useCallback((id, text, actor) => {
    setDisputes(prev => prev.map(d => d.id === id ? {
      ...d, status: "Under Review",
      thread: [...d.thread, { id: uid("t"), user: actor, text, date: nowIso() }],
    } : d));
  }, []);

  const resolveDispute: AppActions["resolveDispute"] = useCallback((id, resolution, accept, actor) => {
    setDisputes(prev => prev.map(d => {
      if (d.id !== id) return d;
      const next: Dispute = {
        ...d, status: accept ? "Resolved" : "Rejected", resolution,
        thread: [...d.thread, { id: uid("t"), user: actor, text: `${accept ? "Resolved" : "Rejected"}: ${resolution}`, date: nowIso() }],
      };
      setCommissions(prev2 => prev2.map(c => c.id === d.commissionId ? { ...c, state: accept ? "Approved" : "Unpaid" } : c));
      pushAudit({ user: actor, action: accept ? "Dispute Resolved" : "Dispute Rejected", module: "Commissions", details: d.commissionId });
      notify({ title: accept ? "Dispute resolved" : "Dispute rejected", body: `${d.commissionId}: ${resolution}`, type: accept ? "success" : "warning" });
      return next;
    }));
  }, []);

  const requestPayout: AppActions["requestPayout"] = useCallback((partnerId, commissionIds, message, actor) => {
    const amount = commissions.filter(c => commissionIds.includes(c.id)).reduce((s, c) => s + c.amount, 0);
    const id = uid("PO");
    setPayouts(p => [{
      id, partnerId, commissionIds, amount, status: "Pending",
      requestedDate: nowIso(), message,
    }, ...p]);
    setCommissions(prev => prev.map(c => commissionIds.includes(c.id) ? { ...c, state: "Payout Requested" } : c));
    pushAudit({ user: actor, action: "Payout Requested", module: "Payouts", details: `${id} · ${amount}` });
    notify({ title: "Payout request submitted", body: `${id} · $${amount.toLocaleString()}`, type: "info" });
  }, [commissions]);

  const approvePayout: AppActions["approvePayout"] = useCallback((id, actor) => {
    setPayouts(prev => prev.map(p => {
      if (p.id !== id) return p;
      setCommissions(cs => cs.map(c => p.commissionIds.includes(c.id) ? { ...c, state: "Approved" } : c));
      pushAudit({ user: actor, action: "Payout Approved", module: "Payouts", details: id });
      notify({ title: "Payout approved", body: `${id} ready for payment`, type: "success", mandatory: true });
      return { ...p, status: "Approved" };
    }));
  }, []);

  const rejectPayout: AppActions["rejectPayout"] = useCallback((id, reason, actor) => {
    setPayouts(prev => prev.map(p => {
      if (p.id !== id) return p;
      setCommissions(cs => cs.map(c => p.commissionIds.includes(c.id) ? { ...c, state: "Unpaid" } : c));
      pushAudit({ user: actor, action: "Payout Rejected", module: "Payouts", details: `${id}: ${reason}` });
      notify({ title: "Payout rejected", body: `${id}: ${reason}`, type: "destructive", mandatory: true });
      return { ...p, status: "Rejected", rejectReason: reason };
    }));
  }, []);

  const recordPayoutPayment: AppActions["recordPayoutPayment"] = useCallback((id, payload, actor) => {
    setPayouts(prev => prev.map(p => {
      if (p.id !== id) return p;
      setCommissions(cs => cs.map(c => p.commissionIds.includes(c.id) ? { ...c, state: "Paid" } : c));
      pushAudit({ user: actor, action: "Payout Paid", module: "Payouts", details: `${id} · ${payload.reference}` });
      notify({ title: "Payout marked as paid", body: `${id} · ${payload.method} · ${payload.reference}`, type: "success", mandatory: true });
      return { ...p, status: "Paid", paidDate: payload.date, method: payload.method, reference: payload.reference };
    }));
  }, []);

  const recordClientPayment: AppActions["recordClientPayment"] = useCallback((payload, actor) => {
    const released = commissions.filter(c => c.leadId === payload.leadId && c.state === "On Hold");
    setClientPayments(prev => [{ ...payload, id: uid("CP") }, ...prev]);
    if (released.length > 0) {
      setCommissions(prev => prev.map(c => c.leadId === payload.leadId && c.state === "On Hold" ? { ...c, state: "Unpaid" } : c));
    }
    pushAudit({ user: actor, action: "Payment Recorded", module: "Client Payments", details: `${payload.leadId} · $${payload.amount}` });
    notify({ title: "Client payment recorded", body: `$${payload.amount.toLocaleString()} against ${payload.leadId}`, type: "success" });
    if (released.length > 0) {
      pushAudit({ user: actor, action: "Commission Released", module: "Commissions", details: `${payload.leadId}: ${released.length} commission(s) now payable` });
      notify({ title: "Commission now payable", body: `${payload.leadId} released for payout after client payment`, type: "success" });
    }
  }, [commissions]);

  const publishAnnouncement: AppActions["publishAnnouncement"] = useCallback((a, actor) => {
    const item: Announcement = { ...a, id: uid("AN"), date: nowIso(), readBy: [] };
    setAnnouncements(prev => [item, ...prev]);
    pushAudit({ user: actor, action: "Announcement Published", module: "Announcements", details: a.title });
    notify({ title: "New announcement", body: a.title, type: "info" });
  }, []);

  const markAnnouncementRead: AppActions["markAnnouncementRead"] = useCallback((id, partnerId) => {
    setAnnouncements(prev => prev.map(a => a.id === id && !a.readBy.includes(partnerId)
      ? { ...a, readBy: [...a.readBy, partnerId] } : a));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);
  const markAllNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const inviteUser: AppActions["inviteUser"] = useCallback((payload, actor) => {
    const item: InvitedUser = { ...payload, id: uid("INV"), invitedDate: nowIso(), status: "Invited" };
    setInvites(prev => [item, ...prev]);
    pushAudit({ user: actor, action: "User Invited", module: "Users", details: `${payload.email} (${payload.role})` });
    notify({ title: "Invitation sent", body: `${payload.email} invited as ${payload.role}`, type: "info", mandatory: true });
  }, []);

  const suspendUser: AppActions["suspendUser"] = useCallback((id, actor) => {
    setPartners(prev => prev.map(p => p.id === id ? { ...p, status: "Suspended" } : p));
    pushAudit({ user: actor, action: "Account Suspended", module: "Users", details: id });
    notify({ title: "Account suspended", body: id, type: "warning", mandatory: true });
  }, []);

  const reactivateUser: AppActions["reactivateUser"] = useCallback((id, actor) => {
    setPartners(prev => prev.map(p => p.id === id ? { ...p, status: "Active" } : p));
    pushAudit({ user: actor, action: "Account Reactivated", module: "Users", details: id });
    notify({ title: "Account reactivated", body: id, type: "success", mandatory: true });
  }, []);

  const deleteUser: AppActions["deleteUser"] = useCallback((id, actor) => {
    setPartners(prev => prev.filter(p => p.id !== id));
    setInvites(prev => prev.filter(i => i.id !== id));
    setStaffUsers(prev => prev.filter(u => u.id !== id));
    pushAudit({ user: actor, action: "Account Deleted", module: "Users", details: id });
    notify({ title: "Account deleted", body: id, type: "destructive" });
  }, []);

  const changePartnerTier: AppActions["changePartnerTier"] = useCallback((id, tier, actor) => {
    setPartners(prev => prev.map(p => {
      if (p.id !== id) return p;
      pushAudit({ user: actor, action: "Tier Change", module: "Users", details: id, oldValue: p.tier, newValue: tier });
      return { ...p, tier: tier as Partner["tier"] };
    }));
  }, []);

  const changePartnerRate: AppActions["changePartnerRate"] = useCallback((id, rate, actor) => {
    setPartners(prev => prev.map(p => {
      if (p.id !== id) return p;
      pushAudit({ user: actor, action: "Commission Rate Change", module: "Users", details: id, oldValue: `${p.commissionRate}%`, newValue: `${rate}%` });
      return { ...p, commissionRate: rate };
    }));
  }, []);

  const updatePartnerProfile: AppActions["updatePartnerProfile"] = useCallback((id, patch, actor) => {
    setPartners(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    if (actor) {
      pushAudit({ user: actor, action: "Partner Profile Updated", module: "Users", details: id, newValue: Object.keys(patch).join(", ") });
      notify({ title: "Partner profile updated", body: `${id}: ${Object.keys(patch).join(", ")}`, type: "info" });
    }
  }, []);

  const addPartnerDocument: AppActions["addPartnerDocument"] = useCallback((partnerId, payload, actor) => {
    const doc: PartnerDocument = {
      id: uid("PD"),
      partnerId,
      name: payload.name,
      type: payload.type,
      uploadedDate: nowIso(),
      uploadedBy: actor,
    };
    setPartnerDocuments(prev => ({ ...prev, [partnerId]: [doc, ...(prev[partnerId] || [])] }));
    pushAudit({ user: actor, action: "Partner Document Uploaded", module: "Users", details: `${partnerId}: ${payload.name}` });
    notify({ title: "Partner document uploaded", body: payload.name, type: "info" });
  }, []);

  const setOnboardingStep: AppActions["setOnboardingStep"] = useCallback((partnerId, key, value, actor) => {
    setOnboarding(prev => ({ ...prev, [partnerId]: { ...(prev[partnerId] || {}), [key]: value } }));
    pushAudit({ user: actor, action: "Onboarding Step", module: "Users", details: `${partnerId}:${key}`, newValue: value ? "Done" : "Reset" });
  }, []);

  const updateSettings: AppActions["updateSettings"] = useCallback((patch, actor) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      pushAudit({ user: actor, action: "Settings Updated", module: "Settings", details: Object.keys(patch).join(", ") });
      return next;
    });
  }, []);

  const value: Ctx = {
    partners, leads, commissions, payouts, clientPayments, calls, activity,
    announcements, notifications, audit, disputes, onboarding, invites, staffUsers,
    settings, attachments, partnerDocuments,
    addLead, updateLeadStage, updateLeadStatus, addComment, addAttachment,
    closeLeadWon, approveDuplicate, rejectDuplicate, addCall,
    overrideCommissionRate, addManualCommission, setCommissionState, openDispute, replyDispute, resolveDispute,
    requestPayout, approvePayout, rejectPayout, recordPayoutPayment,
    recordClientPayment, publishAnnouncement, markAnnouncementRead,
    markNotificationRead, markAllNotificationsRead,
    inviteUser, suspendUser, reactivateUser, deleteUser,
    changePartnerTier, changePartnerRate, updatePartnerProfile, addPartnerDocument, setOnboardingStep,
    updateSettings,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export type Role = "super_admin" | "admin" | "partner";
export type Tier = "Associate" | "Specialist" | "Partner";
export type LeadStage =
  | "Identified Opportunity"
  | "Outreach Started"
  | "In Communication"
  | "Discovery Call"
  | "On Hold"
  | "Contract Sent"
  | "Advance Pending"
  | "Advance Confirmed"
  | "Sent to Product"
  | "Done by Product"
  | "Client Review"
  | "Under Revisions"
  | "Final Payment Clearance"
  | "Final Handoff"
  | "Closed Won"
  | "Closed Lost";
export type LeadStatus = "Closed Won" | "Closed Lost" | "Duplicate Rejected" | "Open";
export type CommissionState =
  | "Unpaid"
  | "Payout Requested"
  | "Approved"
  | "Paid"
  | "Disputed"
  | "On Hold"
  | "Waived";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  partnerId?: string;
  avatar?: string;
  accountStatus?: "active" | "suspended" | "pending" | "deactivated";
  agreementsComplete?: boolean;
}

export interface Partner {
  id: string;
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  city: string;
  country: string;
  bio: string;
  tier: Tier;
  commissionRate: number;
  status: "Active" | "Suspended" | "Pending";
  assignedContact: string;
  joinedDate: string;
}

export interface Lead {
  id: string;
  company: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  contactPhone: string;
  clientLinkedin?: string;
  country: string;
  industry: string;
  estimatedValue: number;
  currency: string;
  description: string;
  stage: LeadStage;
  status: LeadStatus;
  partnerId: string;
  createdAt: string;
  lastActivity: string;
  confirmedValue?: number;
  duplicateReason?: string;
  previousStage?: LeadStage;
}

export interface Commission {
  id: string;
  leadId: string;
  partnerId: string;
  rate: number;
  amount: number;
  state: CommissionState;
  closedDate: string;
  kind?: "Deal" | "Monthly Retainer" | "One-off Bonus";
  label?: string;
  notes?: string;
  eligibleAmount?: number;
  paidAmount?: number;
}

export interface Payout {
  id: string;
  partnerId: string;
  commissionIds: string[];
  amount: number;
  status: "Pending" | "Approved" | "Rejected" | "Paid";
  requestedDate: string;
  paidDate?: string;
  method?: string;
  reference?: string;
  message?: string;
  rejectReason?: string;
}

export interface ClientPayment {
  id: string;
  leadId: string;
  amount: number;
  date: string;
  reference: string;
  method: string;
  notes?: string;
  paymentType?: "Advance" | "Final";
}

export interface DiscoveryCall {
  id: string;
  leadId: string;
  date: string;
  duration: number;
  attendees: string;
  clientAttendees: string;
  partnerJoined: boolean;
  summary: string;
  outcomes: string;
  nextSteps: string;
  followUp: string;
  attachmentName?: string;
  private: boolean;
}

export interface ActivityEntry {
  id: string;
  leadId?: string;
  type:
    | "stage_change"
    | "status_change"
    | "comment"
    | "partner_update"
    | "discovery_call"
    | "file"
    | "admin_note"
    | "system";
  user: string;
  text: string;
  date: string;
  private?: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: "General" | "Important" | "Urgent";
  target: string;
  date: string;
  readBy: string[];
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  date: string;
  read: boolean;
  type: "info" | "success" | "warning" | "destructive";
  mandatory?: boolean;
}

export interface AuditEntry {
  id: string;
  user: string;
  action: string;
  module: string;
  date: string;
  details: string;
  oldValue?: string;
  newValue?: string;
}

export const ONBOARDING_STEPS = [
  { key: "agreement", label: "Agreement signed" },
  { key: "nda", label: "NDA signed" },
  { key: "profile", label: "Profile fully filled in" },
  { key: "welcome", label: "Welcome kit acknowledged" },
  { key: "enablement", label: "Enablement session attended" },
  { key: "firstLead", label: "First lead submitted" },
  { key: "activation", label: "Activation confirmed by Admin" },
];

export function fmtCurrency(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

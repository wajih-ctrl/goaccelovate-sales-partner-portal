export type Role = "super_admin" | "admin" | "partner";
export type Tier = "Associate" | "Specialist" | "Partner";
export type LeadStage =
  | "New Lead"
  | "In Conversation"
  | "Discovery Call"
  | "Proposal Sent"
  | "Negotiation"
  | "Closed Won"
  | "Closed Lost";
export type LeadStatus =
  | "Active"
  | "On Hold"
  | "Closed Won"
  | "Closed Lost"
  | "Duplicate Under Review"
  | "Duplicate Rejected"
  | "Disqualified"
  | "Reopened";
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
  commissionRate: number; // %
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
  type: "stage_change" | "status_change" | "comment" | "partner_update" | "discovery_call" | "file" | "admin_note" | "system";
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

export const DEMO_USERS: User[] = [
  { id: "u1", name: "Alexandra Pierce", email: "alex@goaccelovate.com", role: "super_admin" },
  { id: "u2", name: "Marcus Reid", email: "marcus@goaccelovate.com", role: "admin" },
  { id: "u3", name: "Priya Shah", email: "priya@horizonglobal.com", role: "partner", partnerId: "p1" },
];

export const PARTNERS: Partner[] = [
  { id: "p1", name: "Priya Shah", email: "priya@horizonglobal.com", phone: "+91 98200 11234", linkedin: "linkedin.com/in/priyashah", city: "Mumbai", country: "India", bio: "20+ years in enterprise expansion across APAC. Former Director at Tata Consultancy.", tier: "Partner", commissionRate: 12, status: "Active", assignedContact: "Marcus Reid", joinedDate: "2024-03-12" },
  { id: "p2", name: "Daniel Okafor", email: "daniel@lagoscapital.co", phone: "+234 802 555 0199", linkedin: "linkedin.com/in/danielokafor", city: "Lagos", country: "Nigeria", bio: "Investment banker turned market-entry consultant for West Africa.", tier: "Specialist", commissionRate: 10, status: "Active", assignedContact: "Marcus Reid", joinedDate: "2024-05-02" },
  { id: "p3", name: "Sofia Marchetti", email: "sofia@adriatic-partners.eu", phone: "+39 02 9876 5432", linkedin: "linkedin.com/in/sofiamarchetti", city: "Milan", country: "Italy", bio: "EU market specialist with deep manufacturing network.", tier: "Partner", commissionRate: 12, status: "Active", assignedContact: "Alexandra Pierce", joinedDate: "2024-01-18" },
  { id: "p4", name: "Hiroshi Tanaka", email: "h.tanaka@tokyobridge.jp", phone: "+81 3 5555 1212", linkedin: "linkedin.com/in/hiroshitanaka", city: "Tokyo", country: "Japan", bio: "Bridges Western tech firms with Japanese enterprises.", tier: "Specialist", commissionRate: 10, status: "Active", assignedContact: "Marcus Reid", joinedDate: "2024-06-20" },
  { id: "p5", name: "Isabella Cruz", email: "isabella@latambridge.mx", phone: "+52 55 1234 5678", linkedin: "linkedin.com/in/isabellacruz", city: "Mexico City", country: "Mexico", bio: "LATAM market entry advisor.", tier: "Associate", commissionRate: 8, status: "Active", assignedContact: "Marcus Reid", joinedDate: "2024-09-01" },
  { id: "p6", name: "Oliver Bennett", email: "oliver@thamesgrowth.uk", phone: "+44 20 7946 0001", linkedin: "linkedin.com/in/oliverbennett", city: "London", country: "United Kingdom", bio: "UK and EU scale-up advisor.", tier: "Partner", commissionRate: 12, status: "Active", assignedContact: "Alexandra Pierce", joinedDate: "2023-11-08" },
  { id: "p7", name: "Amelia Nguyen", email: "amelia@saigonventures.vn", phone: "+84 28 3822 9999", linkedin: "linkedin.com/in/amelianguyen", city: "Ho Chi Minh City", country: "Vietnam", bio: "SEA expansion specialist focused on D2C and SaaS.", tier: "Specialist", commissionRate: 10, status: "Active", assignedContact: "Marcus Reid", joinedDate: "2024-07-14" },
  { id: "p8", name: "Lukas Weber", email: "lukas@dachadvisory.de", phone: "+49 30 5557 8800", linkedin: "linkedin.com/in/lukasweber", city: "Berlin", country: "Germany", bio: "DACH region enterprise sales veteran.", tier: "Associate", commissionRate: 8, status: "Pending", assignedContact: "Marcus Reid", joinedDate: "2025-01-05" },
  { id: "p9", name: "Fatima Al-Mansouri", email: "fatima@gulfbridge.ae", phone: "+971 4 555 7700", linkedin: "linkedin.com/in/fatimaalmansouri", city: "Dubai", country: "UAE", bio: "GCC partner with deep government and family-office network.", tier: "Partner", commissionRate: 13, status: "Active", assignedContact: "Alexandra Pierce", joinedDate: "2023-08-22" },
  { id: "p10", name: "Carlos Mendes", email: "carlos@iberiapartners.pt", phone: "+351 21 555 4400", linkedin: "linkedin.com/in/carlosmendes", city: "Lisbon", country: "Portugal", bio: "Iberian and LATAM cross-border specialist.", tier: "Associate", commissionRate: 8, status: "Suspended", assignedContact: "Marcus Reid", joinedDate: "2024-04-30" },
];

const INDUSTRIES = ["SaaS", "Manufacturing", "FinTech", "HealthTech", "Logistics", "Retail", "Energy", "Education"];
const STAGES: LeadStage[] = ["New Lead", "In Conversation", "Discovery Call", "Proposal Sent", "Negotiation", "Closed Won", "Closed Lost"];

const COMPANIES = [
  ["Apex Industries", "Walter Kim", "VP Operations", "walter@apex.io", "USA", 240000],
  ["BlueOcean Logistics", "Maria Santos", "Director Strategy", "msantos@blueocean.com", "Brazil", 180000],
  ["Catalyst HealthAI", "Dr. Ngozi Eze", "CTO", "ngozi@catalysthealth.ai", "Nigeria", 320000],
  ["Daiwa Robotics", "Kenji Mori", "Head of Partnerships", "k.mori@daiwa-robotics.jp", "Japan", 540000],
  ["Elara FinServ", "Anika Rao", "CEO", "anika@elarafinserv.in", "India", 410000],
  ["FjordEnergy AS", "Lars Holm", "Commercial Director", "lars@fjordenergy.no", "Norway", 670000],
  ["GranadaSoft", "Lucia Vera", "CMO", "lvera@granadasoft.es", "Spain", 150000],
  ["Harbor Edu", "James Whitfield", "Dean of Innovation", "jwhit@harboredu.uk", "United Kingdom", 95000],
  ["Iberia Foods", "Pedro Souza", "VP Growth", "psouza@iberiafoods.pt", "Portugal", 220000],
  ["JadeStone Retail", "Mei Lin", "Head of Expansion", "mei@jadestone.cn", "China", 380000],
  ["Kestrel Aviation", "Henry Park", "Chief Strategy", "hpark@kestrelair.com", "USA", 1100000],
  ["LunaLabs Bio", "Sarah Cohen", "Founder", "sarah@lunalabs.bio", "Israel", 275000],
  ["MontBlanc Insurance", "Claire Dubois", "VP Distribution", "cdubois@montblanc.fr", "France", 460000],
  ["NorthernLights Solar", "Tomas Berg", "BD Lead", "tomas@nlsolar.se", "Sweden", 530000],
  ["Olive & Co Beverages", "Yusuf Demir", "Export Director", "yusuf@oliveco.tr", "Turkey", 130000],
  ["PalmaResorts", "Sergio Romano", "VP Sales", "sergio@palmaresorts.it", "Italy", 290000],
  ["QuantumPay", "Aiko Yamada", "Head of Partnerships", "aiko@quantumpay.jp", "Japan", 720000],
  ["RioCement", "Bruno Alves", "COO", "balves@riocement.br", "Brazil", 850000],
  ["Sahara Telecom", "Khalid Idris", "CCO", "khalid@saharatel.eg", "Egypt", 990000],
  ["TerraNova Agri", "Gabriela Ruiz", "MD", "gruiz@terranova.mx", "Mexico", 200000],
  ["UrbanMove Mobility", "Rohit Sen", "VP Growth", "rsen@urbanmove.in", "India", 175000],
  ["Vega Cosmetics", "Naomi Reuben", "Intl. Director", "naomi@vegacos.com", "USA", 105000],
  ["Westport Marine", "Connor McRae", "CEO", "connor@westportmarine.ie", "Ireland", 360000],
  ["Xanadu Hospitality", "Layla Karam", "VP Expansion", "layla@xanadu.ae", "UAE", 480000],
  ["Yellowstone Mining", "Beatriz Lima", "Strategy Lead", "blima@yellowstone-mining.cl", "Chile", 1250000],
  ["Zenith Pharma", "Dr. Felix Adler", "BD VP", "felix@zenithpharma.de", "Germany", 590000],
  ["Aurora ClimateTech", "Hanne Larsen", "Founder", "hanne@auroraclimate.dk", "Denmark", 310000],
  ["Beacon EdTech", "Olu Adeyemi", "CEO", "olu@beaconedtech.ng", "Nigeria", 145000],
  ["Citrus Wholesale", "Marta Costa", "Director", "marta@citruswholesale.pt", "Portugal", 92000],
  ["Delta Aerospace", "Joon Park", "VP Programs", "jpark@deltaaero.kr", "South Korea", 1450000],
  ["Echo Music Group", "Renee Beaumont", "Head Intl", "renee@echomusic.fr", "France", 88000],
  ["Falcon Cybersec", "Aman Verma", "CRO", "aman@falconcyber.in", "India", 410000],
  ["Glacier Foods", "Eli Olsen", "Export Mgr", "eli@glacierfoods.no", "Norway", 165000],
  ["Heliosphere Energy", "Marisol Vega", "CFO", "marisol@heliosphere.mx", "Mexico", 770000],
];

function buildLeads(): Lead[] {
  const leads: Lead[] = [];
  const now = new Date();
  COMPANIES.forEach((c, i) => {
    const stageIdx = i % STAGES.length;
    const stage = STAGES[stageIdx];
    let status: LeadStatus = "Active";
    if (stage === "Closed Won") status = "Closed Won";
    else if (stage === "Closed Lost") status = "Closed Lost";
    if (i === 4) status = "On Hold";
    if (i === 11) status = "Duplicate Under Review";
    if (i === 23) status = "Disqualified";
    const partnerId = PARTNERS[i % PARTNERS.length].id;
    const created = new Date(now);
    created.setDate(now.getDate() - (i * 5 + 3));
    const lastAct = new Date(now);
    lastAct.setDate(now.getDate() - ((i * 3) % 35));
    leads.push({
      id: `L-${1000 + i}`,
      company: c[0] as string,
      contactName: c[1] as string,
      contactTitle: c[2] as string,
      contactEmail: c[3] as string,
      contactPhone: "+1 555 010 " + (1000 + i),
      country: c[4] as string,
      industry: INDUSTRIES[i % INDUSTRIES.length],
      estimatedValue: c[5] as number,
      currency: "USD",
      description: `Strategic opportunity introduced via partner network. ${c[0]} is exploring expansion and evaluating GoAccelovate as a market-entry partner. Multiple stakeholders engaged including ${c[1]}.`,
      stage,
      status,
      partnerId,
      createdAt: created.toISOString(),
      lastActivity: lastAct.toISOString(),
      confirmedValue: stage === "Closed Won" ? (c[5] as number) * 0.9 : undefined,
    });
  });
  return leads;
}

export const LEADS: Lead[] = buildLeads();

export const COMMISSIONS: Commission[] = LEADS
  .filter(l => l.stage === "Closed Won")
  .map((l, i) => {
    const partner = PARTNERS.find(p => p.id === l.partnerId)!;
    const amount = (l.confirmedValue || l.estimatedValue) * (partner.commissionRate / 100);
    const states: CommissionState[] = ["Unpaid", "Paid", "Approved", "Disputed", "On Hold"];
    return {
      id: `C-${2000 + i}`,
      leadId: l.id,
      partnerId: l.partnerId,
      rate: partner.commissionRate,
      amount,
      state: states[i % states.length],
      closedDate: l.lastActivity,
      kind: "Deal",
    };
  });

export const PAYOUTS: Payout[] = [
  { id: "PO-3001", partnerId: "p1", commissionIds: ["C-2000"], amount: 43200, status: "Paid", requestedDate: "2025-04-12", paidDate: "2025-04-20", method: "Bank Transfer", reference: "TXN-998812" },
  { id: "PO-3002", partnerId: "p3", commissionIds: ["C-2001"], amount: 16200, status: "Pending", requestedDate: "2025-06-01", message: "Please process this month if possible." },
  { id: "PO-3003", partnerId: "p6", commissionIds: ["C-2002"], amount: 28800, status: "Approved", requestedDate: "2025-06-10", method: "Bank Transfer" },
  { id: "PO-3004", partnerId: "p9", commissionIds: ["C-2003"], amount: 62400, status: "Rejected", requestedDate: "2025-05-22", rejectReason: "Client payment not yet received." },
  { id: "PO-3005", partnerId: "p1", commissionIds: [], amount: 9800, status: "Pending", requestedDate: "2025-06-18" },
];

export const CLIENT_PAYMENTS: ClientPayment[] = LEADS
  .filter(l => l.stage === "Closed Won")
  .slice(0, 3)
  .map((l, i) => ({
    id: `CP-${4000 + i}`,
    leadId: l.id,
    amount: l.confirmedValue || l.estimatedValue,
    date: "2025-05-" + (10 + i),
    reference: "INV-" + (90000 + i),
    method: "Wire Transfer",
    notes: "Full settlement received.",
  }));

export const DISCOVERY_CALLS: DiscoveryCall[] = [
  { id: "DC-5001", leadId: "L-1002", date: "2025-06-15T14:00", duration: 45, attendees: "Marcus Reid, Alexandra Pierce", clientAttendees: "Dr. Ngozi Eze, CFO", partnerJoined: true, summary: "Walked through GTPP framework and identified two pilot regions.", outcomes: "Pilot scoping aligned. Budget confirmed up to $350k.", nextSteps: "Send proposal by June 22.", followUp: "2025-06-22", attachmentName: "Discovery-notes-Catalyst.pdf", private: false },
  { id: "DC-5002", leadId: "L-1005", date: "2025-06-12T10:30", duration: 30, attendees: "Marcus Reid", clientAttendees: "Lars Holm", partnerJoined: false, summary: "Initial fit assessment.", outcomes: "Strong alignment.", nextSteps: "Schedule technical deep-dive.", followUp: "2025-06-20", private: false },
  { id: "DC-5003", leadId: "L-1000", date: "2025-06-08T16:00", duration: 60, attendees: "Alexandra Pierce, Marcus Reid", clientAttendees: "Walter Kim, COO", partnerJoined: true, summary: "Internal-only call notes.", outcomes: "Procurement concerns flagged.", nextSteps: "Internal review.", followUp: "2025-06-25", private: true },
];

export const ACTIVITY: ActivityEntry[] = [
  { id: "A1", leadId: "L-1000", type: "stage_change", user: "Marcus Reid", text: "Stage changed from New Lead → In Conversation", date: "2025-06-19T09:12" },
  { id: "A2", leadId: "L-1000", type: "comment", user: "Marcus Reid", text: "Spoke with Walter. Strong interest, sending materials.", date: "2025-06-19T11:30" },
  { id: "A3", leadId: "L-1002", type: "discovery_call", user: "Marcus Reid", text: "Discovery call logged (45 min)", date: "2025-06-15T15:00" },
  { id: "A4", leadId: "L-1004", type: "partner_update", user: "Isabella Cruz", text: "Anika confirmed timeline pushed by 2 weeks.", date: "2025-06-18T08:00" },
  { id: "A5", leadId: "L-1006", type: "stage_change", user: "Marcus Reid", text: "Moved to Proposal Sent", date: "2025-06-17T14:22" },
  { id: "A6", leadId: "L-1010", type: "admin_note", user: "Marcus Reid", text: "Private: procurement red-flags.", date: "2025-06-16T13:00", private: true },
  { id: "A7", leadId: "L-1014", type: "file", user: "Sofia Marchetti", text: "Uploaded RFP-PalmaResorts.pdf", date: "2025-06-14T10:00" },
  { id: "A8", leadId: "L-1020", type: "system", user: "System", text: "Lead flagged as stale (21+ days inactive)", date: "2025-06-12T00:00" },
  { id: "A9", leadId: "L-1023", type: "status_change", user: "Marcus Reid", text: "Status changed to Disqualified", date: "2025-06-10T16:00" },
  { id: "A10", leadId: "L-1011", type: "system", user: "System", text: "Duplicate flagged for review", date: "2025-06-09T09:00" },
];

export const ANNOUNCEMENTS: Announcement[] = [
  { id: "AN-1", title: "Q3 Commission Bonus Program Launched", body: "All Partner-tier sales partners now eligible for an additional 2% milestone bonus on deals closed in Q3. See updated terms in the partner agreement.", priority: "Important", target: "All partners", date: "2025-06-15", readBy: ["p2", "p3"] },
  { id: "AN-2", title: "New Industry Vertical: Climate Tech", body: "GoAccelovate is expanding into Climate Tech. Partners with relevant networks should flag opportunities through the standard lead submission flow.", priority: "General", target: "All partners", date: "2025-06-10", readBy: ["p1", "p2", "p3", "p6"] },
  { id: "AN-3", title: "Mandatory: Updated Onboarding Compliance", body: "All partners must re-acknowledge the updated Compliance Addendum by July 1. Failure to acknowledge will pause new lead submissions.", priority: "Urgent", target: "All partners", date: "2025-06-01", readBy: ["p3", "p6", "p9"] },
  { id: "AN-4", title: "APAC Regional Enablement Session", body: "Next enablement webinar for APAC partners is scheduled for July 8 at 10:00 SGT.", priority: "General", target: "APAC region", date: "2025-05-28", readBy: ["p1", "p4", "p7"] },
];

export const NOTIFICATIONS: Notification[] = [
  { id: "N1", title: "Payout PO-3002 submitted", body: "Sofia Marchetti requested a payout of $16,200.", date: "2025-06-19T09:00", read: false, type: "info" },
  { id: "N2", title: "Lead flagged as duplicate", body: "MontBlanc Insurance may already exist.", date: "2025-06-18T14:00", read: false, type: "warning" },
  { id: "N3", title: "Deal closed won", body: "Kestrel Aviation marked Closed Won by Marcus Reid.", date: "2025-06-17T10:00", read: true, type: "success" },
  { id: "N4", title: "New announcement", body: "Q3 Commission Bonus Program Launched", date: "2025-06-15T08:00", read: true, type: "info" },
  { id: "N5", title: "Lead stale", body: "UrbanMove Mobility has had no activity in 21 days.", date: "2025-06-12T00:00", read: false, type: "warning" },
  { id: "N6", title: "Mandatory payout alert", body: "Payout confirmations and account changes are always sent.", date: "2025-06-10T08:30", read: true, type: "info", mandatory: true },
];

export const AUDIT_LOG: AuditEntry[] = [
  { id: "AU-1", user: "Marcus Reid", action: "Stage Change", module: "Leads", date: "2025-06-19T11:30", details: "Lead L-1000 stage updated", oldValue: "New Lead", newValue: "In Conversation" },
  { id: "AU-2", user: "Alexandra Pierce", action: "Commission Override", module: "Commissions", date: "2025-06-18T15:00", details: "Override applied to C-2002", oldValue: "12%", newValue: "13%" },
  { id: "AU-3", user: "Marcus Reid", action: "Payout Approved", module: "Payouts", date: "2025-06-17T09:30", details: "PO-3003 approved" },
  { id: "AU-4", user: "Alexandra Pierce", action: "Role Change", module: "Users", date: "2025-06-15T13:00", details: "Daniel Okafor role updated", oldValue: "Associate", newValue: "Specialist" },
  { id: "AU-5", user: "Marcus Reid", action: "Settings Updated", module: "Settings", date: "2025-06-14T10:00", details: "Lead staleness threshold changed", oldValue: "14 days", newValue: "21 days" },
  { id: "AU-6", user: "Alexandra Pierce", action: "Account Suspended", module: "Users", date: "2025-06-12T16:00", details: "Carlos Mendes account suspended" },
  { id: "AU-7", user: "Marcus Reid", action: "Payment Recorded", module: "Client Payments", date: "2025-06-11T11:00", details: "$240,000 recorded against L-1000" },
];

export const ONBOARDING_STEPS = [
  { key: "agreement", label: "Agreement signed" },
  { key: "nda", label: "NDA signed" },
  { key: "profile", label: "Profile fully filled in" },
  { key: "welcome", label: "Welcome kit acknowledged" },
  { key: "enablement", label: "Enablement session attended" },
  { key: "firstLead", label: "First lead submitted" },
  { key: "activation", label: "Activation confirmed by Admin" },
];

export const PARTNER_ONBOARDING: Record<string, Record<string, boolean>> = {
  p1: { agreement: true, nda: true, profile: true, welcome: true, enablement: true, firstLead: true, activation: true },
};

export function fmtCurrency(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

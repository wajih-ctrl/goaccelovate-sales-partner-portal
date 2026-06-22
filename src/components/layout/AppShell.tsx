import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { type ReactNode, useState } from "react";
import {
  LayoutDashboard, Users, Briefcase, ListChecks, KanbanSquare, List, PhoneCall,
  DollarSign, Wallet, CreditCard, Megaphone, BarChart3, Settings, ShieldCheck,
  UserCircle, ClipboardCheck, PlusCircle, FileText, Bell, Search, LogOut, Menu, X, MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

type NavItem = { to: string; label: string; icon: any };

const SUPER_ADMIN_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/users", label: "User Management", icon: Users },
  { to: "/partners", label: "Partners", icon: Briefcase },
  { to: "/leads", label: "All Leads", icon: ListChecks },
  { to: "/pipeline", label: "Pipeline Kanban", icon: KanbanSquare },
  { to: "/pipeline-list", label: "Pipeline List", icon: List },
  { to: "/discovery-calls", label: "Discovery Calls", icon: PhoneCall },
  { to: "/commissions", label: "Commissions", icon: DollarSign },
  { to: "/payouts", label: "Payout Requests", icon: Wallet },
  { to: "/client-payments", label: "Client Payments", icon: CreditCard },
  { to: "/disputes", label: "Disputes", icon: MessageSquare },
  { to: "/announcements", label: "Announcements", icon: Megaphone },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/audit-log", label: "Audit Log", icon: ShieldCheck },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/partners", label: "Partner Profiles", icon: Briefcase },
  { to: "/leads", label: "All Leads", icon: ListChecks },
  { to: "/pipeline", label: "Pipeline Kanban", icon: KanbanSquare },
  { to: "/pipeline-list", label: "Pipeline List", icon: List },
  { to: "/discovery-calls", label: "Discovery Calls", icon: PhoneCall },
  { to: "/commissions", label: "Commissions", icon: DollarSign },
  { to: "/payouts", label: "Payout Requests", icon: Wallet },
  { to: "/client-payments", label: "Client Payments", icon: CreditCard },
  { to: "/disputes", label: "Disputes", icon: MessageSquare },
  { to: "/announcements", label: "Announcements", icon: Megaphone },
  { to: "/reports", label: "Reports", icon: BarChart3 },
];

const PARTNER_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/profile", label: "My Profile", icon: UserCircle },
  { to: "/onboarding", label: "Onboarding", icon: ClipboardCheck },
  { to: "/submit-lead", label: "Submit Lead", icon: PlusCircle },
  { to: "/leads", label: "My Leads", icon: ListChecks },
  { to: "/commissions", label: "My Commissions", icon: DollarSign },
  { to: "/request-payout", label: "Request Payout", icon: Wallet },
  { to: "/payouts", label: "Payout History", icon: FileText },
  { to: "/disputes", label: "Disputes", icon: MessageSquare },
  { to: "/announcements", label: "Announcements", icon: Megaphone },
  { to: "/reports", label: "My Reports", icon: BarChart3 },
];

function getNav(role: string): NavItem[] {
  if (role === "super_admin") return SUPER_ADMIN_NAV;
  if (role === "admin") return ADMIN_NAV;
  return PARTNER_NAV;
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  partner: "Sales Partner",
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  const { notifications, markNotificationRead, markAllNotificationsRead } = useStore();
  if (!user) return null;
  const nav = getNav(user.role);
  const unread = notifications.filter(n => !n.read).length;

  const sidebar = (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-brand text-brand-foreground font-bold">G</div>
        <div>
          <div className="text-sm font-semibold leading-tight">GoAccelovate</div>
          <div className="text-[11px] uppercase tracking-wider text-sidebar-foreground/60">GTPP Portal</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 px-2 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/50">
          {ROLE_LABEL[user.role]}
        </div>
        <ul className="space-y-0.5">
          {nav.map(item => {
            const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-sidebar-border p-3 text-[11px] text-sidebar-foreground/50">
        v1.0 · Demo Prototype
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div className="hidden md:block">{sidebar}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative">{sidebar}</div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center gap-3 border-b bg-card px-4 md:px-6">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <form
            className="relative hidden flex-1 max-w-md md:block"
            onSubmit={(e) => {
              e.preventDefault();
              const v = (new FormData(e.currentTarget).get("q") as string)?.trim();
              if (v) navigate({ to: "/leads", search: { q: v } as any });
            }}
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              placeholder="Search leads by company or contact…"
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {unread > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                      {unread}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-96 p-0">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div className="text-sm font-semibold">Notifications</div>
                  {unread > 0 && (
                    <button onClick={markAllNotificationsRead} className="text-xs text-brand hover:underline">Mark all read</button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No notifications.</div>}
                  {notifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => markNotificationRead(n.id)}
                      className={`w-full border-b p-3 text-left text-sm last:border-b-0 hover:bg-accent/30 ${!n.read ? "bg-accent/40" : ""}`}
                    >
                      <div className="font-medium">{n.title}</div>
                      <div className="text-xs text-muted-foreground">{n.body}</div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <span>{new Date(n.date).toLocaleString()}</span>
                        {n.mandatory && <span className="rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-warning-foreground">Mandatory</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-accent">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-brand text-sm font-semibold text-brand-foreground">
                    {user.name.split(" ").map(p => p[0]).slice(0, 2).join("")}
                  </div>
                  <div className="hidden text-left md:block">
                    <div className="text-sm font-medium leading-tight">{user.name}</div>
                    <div className="text-[11px] text-muted-foreground">{ROLE_LABEL[user.role]}</div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.role === "partner" && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>My Profile</DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => { logout(); navigate({ to: "/login" }); }}>
                  <LogOut className="mr-2 h-4 w-4" />Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b bg-card px-4 py-5 md:flex-row md:items-center md:justify-between md:px-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="p-4 md:p-8 space-y-6">{children}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "Active": "bg-info/10 text-info border-info/20",
    "On Hold": "bg-warning/15 text-warning-foreground border-warning/30",
    "Closed Won": "bg-success/10 text-success border-success/20",
    "Closed Lost": "bg-destructive/10 text-destructive border-destructive/20",
    "Duplicate Under Review": "bg-warning/15 text-warning-foreground border-warning/30",
    "Duplicate Rejected": "bg-muted text-muted-foreground border-border",
    "Disqualified": "bg-muted text-muted-foreground border-border",
    "Reopened": "bg-info/10 text-info border-info/20",
    "Unpaid": "bg-muted text-muted-foreground border-border",
    "Payout Requested": "bg-info/10 text-info border-info/20",
    "Approved": "bg-info/15 text-info border-info/20",
    "Paid": "bg-success/10 text-success border-success/20",
    "Disputed": "bg-destructive/10 text-destructive border-destructive/20",
    "Waived": "bg-muted text-muted-foreground border-border",
    "Pending": "bg-warning/15 text-warning-foreground border-warning/30",
    "Rejected": "bg-destructive/10 text-destructive border-destructive/20",
    "Suspended": "bg-destructive/10 text-destructive border-destructive/20",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${map[status] || "bg-muted text-muted-foreground border-border"}`}>
      {status}
    </span>
  );
}

export function TierBadge({ tier }: { tier: string }) {
  const map: Record<string, string> = {
    Associate: "bg-secondary text-secondary-foreground",
    Specialist: "bg-info/10 text-info",
    Partner: "bg-gradient-brand text-brand-foreground",
  };
  return <Badge className={`${map[tier]} border-0`}>{tier}</Badge>;
}

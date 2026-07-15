import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { type ComponentType, type ReactNode, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  ListChecks,
  KanbanSquare,
  DollarSign,
  Wallet,
  CreditCard,
  Megaphone,
  BarChart3,
  Settings,
  ShieldCheck,
  UserCircle,
  ClipboardCheck,
  Bell,
  Search,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string }> };

const SUPER_ADMIN_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/users", label: "User Management", icon: Users },
  { to: "/partners", label: "Partners", icon: Briefcase },
  { to: "/leads", label: "All Leads", icon: ListChecks },
  { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { to: "/commissions", label: "Commissions", icon: DollarSign },
  { to: "/payouts", label: "Payout Requests", icon: Wallet },
  { to: "/client-payments", label: "Client Payments", icon: CreditCard },
  { to: "/announcements", label: "Announcements", icon: Megaphone },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/audit-log", label: "Audit Log", icon: ShieldCheck },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/users", label: "Sales Partners", icon: Users },
  { to: "/partners", label: "Partner Profiles", icon: Briefcase },
  { to: "/leads", label: "All Leads", icon: ListChecks },
  { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { to: "/commissions", label: "Commissions", icon: DollarSign },
  { to: "/payouts", label: "Payout Requests", icon: Wallet },
  { to: "/client-payments", label: "Client Payments", icon: CreditCard },
  { to: "/announcements", label: "Announcements", icon: Megaphone },
  { to: "/reports", label: "Reports", icon: BarChart3 },
];

const PARTNER_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/profile", label: "My Profile", icon: UserCircle },
  { to: "/onboarding", label: "Onboarding", icon: ClipboardCheck },
  { to: "/leads", label: "My Leads", icon: ListChecks },
  { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { to: "/commissions", label: "My Commissions", icon: DollarSign },
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);

  const { notifications, markNotificationRead, markAllNotificationsRead } = useStore();
  if (!user) return null;
  const nav = getNav(user.role);
  const unread = notifications.filter((n) => !n.read).length;
  const selectedNotification =
    notifications.find((notification) => notification.id === selectedNotificationId) || null;
  const handleSignOut = async () => {
    await logout();
    navigate({ to: "/login", replace: true });
  };

  const renderSidebar = (mode: "desktop" | "mobile") => {
    const collapsed = mode === "desktop" && desktopCollapsed;

    return (
      <aside
        className={`flex h-full flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 ${
          collapsed ? "w-[4.5rem]" : "w-72 sm:w-64"
        }`}
      >
        <div
          className={`flex h-16 items-center gap-2 border-b border-sidebar-border ${collapsed ? "justify-center px-3" : "px-4 sm:px-5"}`}
        >
          <div className={collapsed ? "h-9 w-9 shrink-0 overflow-hidden" : "min-w-0 shrink"}>
            <img
              src="/goaccelovate-logo.png"
              alt="GoAccelovate"
              className={
                collapsed ? "h-9 w-auto max-w-none" : "h-8 w-auto max-w-[168px] object-contain"
              }
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={`ml-auto h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground ${
              collapsed
                ? "hidden"
                : mode === "desktop"
                  ? "hidden md:inline-flex"
                  : "inline-flex md:hidden"
            }`}
            onClick={() => (mode === "desktop" ? setDesktopCollapsed(true) : setMobileOpen(false))}
            aria-label={mode === "desktop" ? "Collapse sidebar" : "Close sidebar"}
            title={mode === "desktop" ? "Collapse sidebar" : "Close sidebar"}
          >
            {mode === "desktop" ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {!collapsed && (
            <div className="mb-2 px-2 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/50">
              {ROLE_LABEL[user.role]}
            </div>
          )}
          <ul className="space-y-0.5">
            {nav.map((item) => {
              const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? item.label : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    className={`flex min-h-10 items-center rounded-md text-sm transition-colors ${
                      collapsed ? "justify-center px-0" : "gap-2.5 px-2.5 py-2"
                    } ${
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div
          className={`border-t border-sidebar-border p-3 text-[11px] text-sidebar-foreground/50 ${collapsed ? "flex justify-center" : ""}`}
        >
          {collapsed ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={() => setDesktopCollapsed(false)}
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          ) : (
            "www.goaccelovate.com"
          )}
        </div>
      </aside>
    );
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div className="hidden shrink-0 md:block">{renderSidebar("desktop")}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative max-w-[86vw]">{renderSidebar("mobile")}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-card px-3 sm:gap-3 sm:px-4 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={() => setDesktopCollapsed((value) => !value)}
            aria-label={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {desktopCollapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </Button>
          <form
            className="relative hidden flex-1 max-w-md md:block"
            onSubmit={(e) => {
              e.preventDefault();
              const v = (new FormData(e.currentTarget).get("q") as string)?.trim();
              if (v) navigate({ to: "/leads", search: { q: v } as never });
            }}
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              placeholder="Search leads by company or contact..."
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            />
          </form>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <Popover onOpenChange={(open) => !open && setSelectedNotificationId(null)}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative shrink-0">
                  <Bell className="h-5 w-5" />
                  {unread > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                      {unread}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[calc(100vw-1rem)] max-w-96 p-0">
                {selectedNotification ? (
                  <>
                    <div className="flex items-center gap-2 border-b px-3 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => setSelectedNotificationId(null)}
                        aria-label="Back to notifications"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">Notification details</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(selectedNotification.date).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="max-h-96 space-y-4 overflow-y-auto p-4 text-sm">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Title
                        </div>
                        <div className="mt-1 text-base font-semibold">
                          {selectedNotification.title}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Full message
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
                          {selectedNotification.body}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 rounded-md border bg-accent/20 p-3 text-xs sm:grid-cols-3">
                        <div>
                          <div className="font-medium text-muted-foreground">Status</div>
                          <div>{selectedNotification.read ? "Read" : "Unread"}</div>
                        </div>
                        <div>
                          <div className="font-medium text-muted-foreground">Priority</div>
                          <div>{selectedNotification.mandatory ? "Mandatory" : "Standard"}</div>
                        </div>
                        <div>
                          <div className="font-medium text-muted-foreground">Type</div>
                          <div className="capitalize">{selectedNotification.type}</div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between border-b px-4 py-3">
                      <div className="text-sm font-semibold">Notifications</div>
                      {unread > 0 && (
                        <button
                          onClick={markAllNotificationsRead}
                          className="text-xs text-brand hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 && (
                        <div className="p-6 text-center text-sm text-muted-foreground">
                          No notifications.
                        </div>
                      )}
                      {notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => {
                            markNotificationRead(n.id);
                            setSelectedNotificationId(n.id);
                          }}
                          className={`w-full border-b p-3 text-left text-sm last:border-b-0 hover:bg-accent/30 ${!n.read ? "bg-accent/40" : ""}`}
                        >
                          <div className="font-medium">{n.title}</div>
                          <div className="line-clamp-2 text-xs text-muted-foreground">{n.body}</div>
                          <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                            <span>{new Date(n.date).toLocaleString()}</span>
                            {n.mandatory && (
                              <span className="rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-warning-foreground">
                                Mandatory
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </PopoverContent>
            </Popover>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex min-w-0 items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-accent sm:pr-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-sm font-semibold text-brand-foreground">
                    {user.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div className="hidden min-w-0 text-left md:block">
                    <div className="truncate text-sm font-medium leading-tight">{user.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {ROLE_LABEL[user.role]}
                    </div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.role === "partner" && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                    My Profile
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 border-b bg-card px-4 py-5 md:flex-row md:items-center md:justify-between md:px-8">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">{actions}</div>
      )}
    </div>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-visible p-4 md:p-8">{children}</div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Active: "bg-info/10 text-info border-info/20",
    "On Hold": "bg-warning/15 text-warning-foreground border-warning/30",
    "Closed Won": "bg-success/10 text-success border-success/20",
    "Closed Lost": "bg-destructive/10 text-destructive border-destructive/20",
    "Duplicate Rejected": "bg-muted text-muted-foreground border-border",
    Unpaid: "bg-muted text-muted-foreground border-border",
    "Payout Requested": "bg-info/10 text-info border-info/20",
    Approved: "bg-info/15 text-info border-info/20",
    Paid: "bg-success/10 text-success border-success/20",
    Waived: "bg-muted text-muted-foreground border-border",
    Pending: "bg-warning/15 text-warning-foreground border-warning/30",
    Rejected: "bg-destructive/10 text-destructive border-destructive/20",
    Suspended: "bg-destructive/10 text-destructive border-destructive/20",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${map[status] || "bg-muted text-muted-foreground border-border"}`}
    >
      {status}
    </span>
  );
}

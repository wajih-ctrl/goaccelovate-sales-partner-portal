import type { Role } from "./mock-data";

const ADMIN_PATHS = [
  "/announcements",
  "/client-payments",
  "/commissions",
  "/dashboard",
  "/discovery-calls",
  "/disputes",
  "/leads",
  "/partners",
  "/payouts",
  "/pipeline",
  "/pipeline-list",
  "/reports",
];

const PARTNER_PATHS = [
  "/announcements",
  "/commissions",
  "/dashboard",
  "/disputes",
  "/leads",
  "/onboarding",
  "/payouts",
  "/profile",
  "/reports",
  "/request-payout",
  "/submit-lead",
];

const SUPER_ADMIN_ONLY_PATHS = ["/audit-log", "/settings", "/users"];

function pathMatches(pathname: string, allowedPath: string) {
  return pathname === allowedPath || pathname.startsWith(`${allowedPath}/`);
}

export function isPathAllowedForRole(role: Role, pathname: string) {
  if (pathname === "/access-denied") return true;
  if (role === "super_admin")
    return [...ADMIN_PATHS, ...SUPER_ADMIN_ONLY_PATHS].some((path) => pathMatches(pathname, path));
  if (role === "admin") return ADMIN_PATHS.some((path) => pathMatches(pathname, path));
  return PARTNER_PATHS.some((path) => pathMatches(pathname, path));
}

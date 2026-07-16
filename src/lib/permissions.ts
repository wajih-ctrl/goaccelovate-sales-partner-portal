import type { Role, User } from "./domain";

const ADMIN_PATHS = [
  "/announcements",
  "/client-payments",
  "/commissions",
  "/dashboard",
  "/leads",
  "/legal",
  "/partners",
  "/payouts",
  "/pipeline",
  "/pipeline-list",
  "/reports",
  "/users",
];

const PARTNER_PATHS = [
  "/announcements",
  "/commissions",
  "/dashboard",
  "/leads",
  "/onboarding",
  "/legal",
  "/pipeline",
  "/profile",
  "/reports",
  "/submit-lead",
];

const SUPER_ADMIN_ONLY_PATHS = ["/audit-log", "/settings"];
const PARTNER_PRE_AGREEMENT_PATHS = ["/dashboard", "/onboarding", "/legal"];

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

export function isAgreementRestricted(user: Pick<User, "role" | "agreementsComplete">) {
  return user.role === "partner" && user.agreementsComplete !== true;
}

export function isPathAllowedForUser(
  user: Pick<User, "role" | "agreementsComplete">,
  pathname: string,
) {
  if (!isPathAllowedForRole(user.role, pathname)) return false;
  if (!isAgreementRestricted(user)) return true;
  return PARTNER_PRE_AGREEMENT_PATHS.some((path) => pathMatches(pathname, path));
}

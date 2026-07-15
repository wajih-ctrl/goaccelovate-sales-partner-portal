import { createFileRoute, Outlet, Navigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";
import { isAgreementRestricted, isPathAllowedForUser } from "@/lib/permissions";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, ready, validateAccount } = useAuth();
  const userId = user?.id;
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    if (ready && userId) void validateAccount();
  }, [pathname, ready, userId, validateAccount]);

  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isPathAllowedForUser(user, pathname)) {
    return isAgreementRestricted(user) ? (
      <Navigate to="/onboarding" replace />
    ) : (
      <Navigate to="/access-denied" replace />
    );
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

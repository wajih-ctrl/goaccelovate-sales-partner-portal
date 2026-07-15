import { createFileRoute, Outlet, Navigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";
import { isPathAllowedForRole } from "@/lib/permissions";

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
  if (!isPathAllowedForRole(user.role, pathname)) return <Navigate to="/access-denied" replace />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

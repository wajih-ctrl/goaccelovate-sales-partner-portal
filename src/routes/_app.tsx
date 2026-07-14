import { createFileRoute, Outlet, Navigate, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";
import { isPathAllowedForRole } from "@/lib/permissions";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, ready } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (
    user.role === "partner" &&
    user.agreementsComplete === false &&
    pathname !== "/onboarding" &&
    pathname !== "/profile" &&
    !pathname.startsWith("/legal/")
  )
    return <Navigate to="/onboarding" replace />;
  if (!isPathAllowedForRole(user.role, pathname)) return <Navigate to="/access-denied" replace />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

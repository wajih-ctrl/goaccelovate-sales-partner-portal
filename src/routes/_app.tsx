import { createFileRoute, Outlet, Navigate, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";
import { isAgreementRestricted, isPathAllowedForUser } from "@/lib/permissions";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, ready } = useAuth();
  const { hydrated } = useStore();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading workspace...
      </div>
    );
  }
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

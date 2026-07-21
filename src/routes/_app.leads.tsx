import { createFileRoute, Navigate, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/leads")({ component: LeadsRoute });

function LeadsRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname !== "/leads") return <Outlet />;
  return <Navigate to="/pipeline" search={{ view: "list" }} replace />;
}

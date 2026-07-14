import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/pipeline-list")({
  component: LegacyPipelineListRedirect,
});

function LegacyPipelineListRedirect() {
  return <Navigate to="/pipeline" search={{ view: "list" }} replace />;
}

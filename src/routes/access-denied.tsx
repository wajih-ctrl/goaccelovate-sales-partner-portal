import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/access-denied")({
  component: AccessDenied,
});

function AccessDenied() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-background">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="text-sm text-muted-foreground">
          You don't have permission to view this resource. Sales partners can only access their own
          data. If you think this is a mistake, contact your GoAccelovate account manager.
        </p>
        <div className="flex justify-center gap-2">
          <Link to="/dashboard">
            <Button>Back to dashboard</Button>
          </Link>
          <Link to="/login">
            <Button variant="outline">Switch role</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/invitation")({
  component: Invitation,
});

function Invitation() {
  const nav = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-lg p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-brand text-brand-foreground font-bold">G</div>
          <div>
            <div className="text-sm font-semibold">GoAccelovate GTPP</div>
            <div className="text-xs text-muted-foreground">Partner invitation</div>
          </div>
        </div>
        <h1 className="text-2xl font-semibold">You've been invited to the GTPP Partner Portal</h1>
        <p className="text-sm text-muted-foreground">Invited by <strong>Alexandra Pierce</strong> · Expires in 71 hours</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Full name</label>
            <input className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue="Daniel Okafor" />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Create password</label>
            <input type="password" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" placeholder="At least 12 characters" />
          </div>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input type="checkbox" className="mt-0.5" defaultChecked />
            I accept the GoAccelovate Partner Agreement and Compliance Addendum.
          </label>
        </div>
        <Button className="w-full" onClick={() => { toast.success("Invitation accepted (demo)"); nav({ to: "/login" }); }}>
          <CheckCircle2 className="mr-2 h-4 w-4" />Accept invitation
        </Button>
      </Card>
    </div>
  );
}

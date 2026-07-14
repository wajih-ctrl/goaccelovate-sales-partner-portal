import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/invitation")({
  component: Invitation,
});

function Invitation() {
  const nav = useNavigate();
  const { acceptInvitation } = useAuth();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const mode = useMemo(() => {
    if (typeof window === "undefined") return "invite";
    return new URLSearchParams(window.location.search).get("mode") === "recovery"
      ? "recovery"
      : "invite";
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!acceptedTerms) {
      toast.error("You must accept the partner terms to continue.");
      return;
    }

    setLoading(true);
    const result = await acceptInvitation({ fullName, password });
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(mode === "recovery" ? "Password updated" : "Invitation accepted");
    nav({ to: mode === "recovery" ? "/dashboard" : "/onboarding" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg space-y-5 p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-brand font-bold text-brand-foreground">
            G
          </div>
          <div>
            <div className="text-sm font-semibold">Go Accelerate Global Partner Program</div>
            <div className="text-xs text-muted-foreground">
              {mode === "recovery" ? "Password reset" : "Partner invitation"}
            </div>
          </div>
        </div>
        <h1 className="text-2xl font-semibold">
          {mode === "recovery"
            ? "Create a new password"
            : "You've been invited to the Global Partner Program"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === "recovery"
            ? "Choose a new password for your invited account."
            : "Invitation links expire based on the portal setting, currently 72 hours by default."}
        </p>

        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Full name
            </label>
            <input
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Create password
            </label>
            <input
              type="password"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="At least 12 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={12}
              required
            />
          </div>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
            />
            I understand that I must review and electronically sign the Partner Agreement and NDA on
            the next step before accessing program data.
          </label>
          <Button className="w-full" type="submit" disabled={loading}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {loading ? "Saving..." : mode === "recovery" ? "Update password" : "Accept invitation"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

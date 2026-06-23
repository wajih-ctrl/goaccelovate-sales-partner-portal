import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPassword,
});

function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const result = await resetPassword(email);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    setSent(true);
    toast.success("Reset link sent");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md space-y-4 p-6">
        <h1 className="text-xl font-semibold">Reset your password</h1>
        {!sent ? (
          <form className="space-y-4" onSubmit={submit}>
            <p className="text-sm text-muted-foreground">
              Enter the email associated with your partner account and we'll send reset
              instructions.
            </p>
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        ) : (
          <div className="rounded-md bg-success/10 p-4 text-sm text-success">
            A reset link has been sent if the email exists in our records.
          </div>
        )}
        <Link
          to="/login"
          className="block text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Back to sign in
        </Link>
      </Card>
    </div>
  );
}

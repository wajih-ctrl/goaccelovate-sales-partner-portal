import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPassword,
});

function ForgotPassword() {
  const [sent, setSent] = useState(false);
  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md p-6 space-y-4">
        <h1 className="text-xl font-semibold">Reset your password</h1>
        {!sent ? (
          <>
            <p className="text-sm text-muted-foreground">Enter the email associated with your partner account and we'll send reset instructions.</p>
            <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" placeholder="you@company.com" />
            <Button className="w-full" onClick={() => { setSent(true); toast.success("Reset link sent (demo)"); }}>Send reset link</Button>
          </>
        ) : (
          <div className="rounded-md bg-success/10 p-4 text-sm text-success">A reset link has been sent if the email exists in our records.</div>
        )}
        <Link to="/login" className="block text-center text-xs text-muted-foreground hover:text-foreground">← Back to sign in</Link>
      </Card>
    </div>
  );
}

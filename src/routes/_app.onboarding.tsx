/* eslint-disable @typescript-eslint/no-explicit-any -- Agreement tables are introduced by the pending migration. */
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, FileSignature, FileText } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, PageContainer } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { ONBOARDING_STEPS } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/_app/onboarding")({ component: Onboarding });

type AgreementDocument = {
  id: string;
  document_type: "Agreement" | "NDA";
  title: string;
  version: number;
  content_url: string | null;
};

function Onboarding() {
  const { user, signRequiredAgreements } = useAuth();
  const { onboarding } = useStore();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<AgreementDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [legalName, setLegalName] = useState(user?.name || "");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase || user?.role !== "partner") {
      setDocumentsLoading(false);
      return;
    }
    void (supabase as any)
      .from("agreement_documents")
      .select("id,document_type,title,version,content_url")
      .eq("is_active", true)
      .order("document_type")
      .then(
        ({
          data,
          error,
        }: {
          data: AgreementDocument[] | null;
          error: { message: string } | null;
        }) => {
          if (error) toast.error(error.message);
          else setDocuments(data || []);
          setDocumentsLoading(false);
        },
      );
  }, [user?.role]);

  if (user?.role !== "partner") return <Navigate to="/access-denied" />;
  const status = onboarding[user.partnerId!] || {};
  const done = ONBOARDING_STEPS.filter((step) => status[step.key]).length;
  const pct = Math.round((done / ONBOARDING_STEPS.length) * 100);
  const documentsReady =
    documents.length >= 2 && documents.every((document) => document.content_url);

  const sign = async () => {
    setLoading(true);
    const result = await signRequiredAgreements(legalName.trim());
    setLoading(false);
    if (result.error) return toast.error(result.error);
    toast.success("Agreement and NDA signed successfully.");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <>
      <PageHeader
        title="Partner Onboarding"
        description="Complete the required documents before accessing program data."
      />
      <PageContainer>
        {user.agreementsComplete === false && (
          <Card className="space-y-5 p-5">
            <div className="flex items-start gap-3">
              <FileSignature className="mt-0.5 h-5 w-5 text-brand" />
              <div>
                <h2 className="font-semibold">Agreement and NDA signature required</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review both current documents. Your legal name, account email, document versions,
                  signature time, and browser information are retained in the audit record.
                </p>
              </div>
            </div>

            {documentsLoading ? (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">
                Loading the current Agreement and NDA...
              </div>
            ) : documentsReady ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {documents.map((document) => (
                  <Link
                    key={document.id}
                    to="/legal/$type"
                    params={{ type: document.document_type === "Agreement" ? "agreement" : "nda" }}
                    className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent/30"
                  >
                    <span>
                      <strong>{document.title}</strong>
                      <span className="block text-xs text-muted-foreground">
                        {document.document_type} version {document.version}
                      </span>
                    </span>
                    <FileText className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm">
                The final Agreement and NDA have not been published yet. A Super Admin must upload
                and activate both final documents before invited Sales Partners can sign in.
              </div>
            )}

            <div className="grid gap-3 sm:max-w-2xl sm:grid-cols-2">
              <label className="block text-xs font-medium">
                Electronic signature
                <input
                  className="mt-1 h-10 w-full rounded-md border bg-background px-3 font-serif text-base italic"
                  value={legalName}
                  onChange={(event) => setLegalName(event.target.value)}
                  autoComplete="name"
                />
              </label>
              <label className="block text-xs font-medium">
                Signature date
                <input
                  type="date"
                  className="mt-1 h-10 w-full rounded-md border bg-muted px-3 text-sm"
                  value={new Date().toISOString().slice(0, 10)}
                  readOnly
                />
              </label>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>
                I have reviewed and agree to the current Partner Agreement and NDA, and I consent to
                use this electronic signature.
              </span>
            </label>
            <Button
              onClick={sign}
              disabled={!documentsReady || !confirmed || !legalName.trim() || loading}
            >
              <FileSignature className="mr-2 h-4 w-4" />
              {loading ? "Signing..." : "Sign Agreement and NDA"}
            </Button>
          </Card>
        )}

        {user.agreementsComplete !== false && (
          <Card className="space-y-6 p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">
                  {done} of {ONBOARDING_STEPS.length} program steps complete
                </div>
                <div className="text-xs text-muted-foreground">
                  Agreement access is complete. Remaining steps are managed with your program
                  contact.
                </div>
              </div>
              <div className="text-2xl font-semibold">{pct}%</div>
            </div>
            <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-accent">
              <div
                className="h-full bg-gradient-brand transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <ul className="space-y-2">
              {ONBOARDING_STEPS.map((step) => {
                const complete = status[step.key];
                return (
                  <li
                    key={step.key}
                    className={`flex items-center gap-3 rounded-md border p-3 ${complete ? "border-success/20 bg-success/5" : ""}`}
                  >
                    {complete ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className={complete ? "text-foreground" : "text-muted-foreground"}>
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ul>
            {documentsReady && (
              <div className="border-t pt-5">
                <h3 className="mb-3 text-sm font-semibold">Signed documents</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {documents.map((document) => (
                    <Link
                      key={document.id}
                      to="/legal/$type"
                      params={{
                        type: document.document_type === "Agreement" ? "agreement" : "nda",
                      }}
                      className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent/30"
                    >
                      <span>
                        <strong>{document.title}</strong>
                        <span className="block text-xs text-muted-foreground">
                          Signed {document.document_type} version {document.version}
                        </span>
                      </span>
                      <FileText className="h-4 w-4" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}
      </PageContainer>
    </>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any -- Agreement acceptance tables are newer than the generated client types. */
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useState } from "react";

import { PageContainer, PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  LEGAL_DEFAULTS,
  NDA_SECTIONS,
  PARTNER_AGREEMENT_SECTIONS,
  populateLegalText,
} from "@/lib/legal-documents";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_app/legal/$type")({ component: LegalDocumentPage });

type AgreementAcceptance = {
  signer_name: string;
  signed_at: string;
};

function LegalDocumentPage() {
  const { type } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { partners } = useStore();
  const [acceptance, setAcceptance] = useState<AgreementAcceptance | null>(null);
  const [acceptanceLoading, setAcceptanceLoading] = useState(user?.role === "partner");

  useEffect(() => {
    if (!supabase || user?.role !== "partner" || !user.partnerId) {
      setAcceptanceLoading(false);
      return;
    }

    let cancelled = false;
    const documentType = type === "nda" ? "NDA" : "Agreement";
    void (supabase as any)
      .from("partner_agreement_acceptances")
      .select("signer_name,signed_at,agreement_documents!inner(document_type,is_active)")
      .eq("partner_id", user.partnerId)
      .eq("agreement_documents.document_type", documentType)
      .eq("agreement_documents.is_active", true)
      .maybeSingle()
      .then(({ data }: { data: AgreementAcceptance | null; error: { message: string } | null }) => {
        if (!cancelled) {
          setAcceptance(data);
          setAcceptanceLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [type, user?.partnerId, user?.role]);

  if (type !== "agreement" && type !== "nda") return <Navigate to="/onboarding" replace />;

  const partner = partners.find((item) => item.id === user?.partnerId);
  if (user?.role === "partner" && user.partnerId && (!partner || acceptanceLoading)) {
    return (
      <>
        <PageHeader title="Preparing document" description="Loading your current partner terms." />
        <PageContainer>
          <div className="text-sm text-muted-foreground">Preparing your document...</div>
        </PageContainer>
      </>
    );
  }
  const partnerName = partner?.name || (user?.role === "partner" ? user.name : "Sales Partner");
  const commissionRate = partner?.commissionRate || 10;
  const effectiveDate = new Date(partner?.joinedDate || Date.now()).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const agreement = type === "agreement";
  const title = agreement ? "Strategic Referral Partnership Agreement" : "Non-Disclosure Agreement";
  const sections = agreement ? PARTNER_AGREEMENT_SECTIONS : NDA_SECTIONS;

  return (
    <>
      <div className="legal-screen-only">
        <PageHeader
          title={title}
          description={`Prepared for ${partnerName}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => navigate({ to: "/onboarding" })}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              {user?.role === "partner" && !acceptance ? (
                <Button onClick={() => navigate({ to: "/onboarding" })}>
                  Sign Agreement and NDA
                </Button>
              ) : (
                <Button onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print signed PDF
                </Button>
              )}
            </div>
          }
        />
      </div>
      <PageContainer>
        <article className="legal-document mx-auto max-w-4xl border bg-white text-slate-950 shadow-card">
          <header className="legal-document-header flex items-center justify-between gap-4 border-b px-6 py-5 sm:px-10">
            <img
              src="/goaccelovate-logo.png"
              alt="GoAccelovate"
              className="h-10 w-auto object-contain"
            />
            <div className="text-right text-xs text-slate-500">Global Partner Program</div>
          </header>
          <div className="space-y-7 px-6 py-8 sm:px-10 sm:py-10">
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">{title}</h1>
            </div>

            <div className="space-y-2 border-y py-5 text-sm sm:text-base">
              <p>This {title} ("Agreement") is entered into between:</p>
              <p className="font-semibold">
                GoAccelovate Inc. ({agreement ? '"GoAccelovate"' : '"Disclosing Party"'})
              </p>
              <p>and</p>
              <p className="font-semibold">
                {partnerName} ({agreement ? '"Partner"' : '"Receiving Party"'})
              </p>
              <p>
                <span className="font-medium">Effective Date:</span> {effectiveDate}
              </p>
            </div>

            {sections.map((section, index) => (
              <section key={`${section.heading}-${index}`} className="space-y-3">
                {section.heading && (
                  <h2 className="text-base font-semibold text-slate-950 sm:text-lg">
                    {section.heading}
                  </h2>
                )}
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-slate-700 sm:text-base">
                    {populateLegalText(paragraph, commissionRate)}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="list-disc space-y-2 pl-6 text-sm leading-7 text-slate-700 sm:text-base">
                    {section.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

            <section className="space-y-5 pt-4">
              <h2 className="text-lg font-semibold text-slate-950">Signatories</h2>
              <div className="grid gap-8 sm:grid-cols-2">
                <div className="space-y-3 text-sm">
                  <div className="font-semibold">For GoAccelovate</div>
                  <div>Name: {LEGAL_DEFAULTS.goAccelovateSignatoryName}</div>
                  <div>Title: {LEGAL_DEFAULTS.goAccelovateSignatoryTitle}</div>
                  <div className="pt-5">Signature: _________________________</div>
                  <div>Date: _________________________</div>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="font-semibold">For {partnerName}</div>
                  {acceptance ? (
                    <>
                      <div className="pt-5">
                        Electronic signature:{" "}
                        <span className="font-serif text-base italic">
                          {acceptance.signer_name}
                        </span>
                      </div>
                      <div>
                        Date:{" "}
                        {new Date(acceptance.signed_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="pt-5">Electronic signature: Pending</div>
                      <div>Date: Pending</div>
                    </>
                  )}
                </div>
              </div>
            </section>
          </div>
          <footer className="legal-document-footer border-t px-6 py-4 text-center text-xs text-slate-500 sm:px-10">
            www.goaccelovate.com
          </footer>
        </article>
      </PageContainer>
    </>
  );
}

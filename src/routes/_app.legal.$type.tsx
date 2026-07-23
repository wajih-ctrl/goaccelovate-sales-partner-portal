/* eslint-disable @typescript-eslint/no-explicit-any -- Agreement acceptance tables are newer than the generated client types. */
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ImageUp, PenLine, Printer, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormDialog } from "@/components/common/dialogs";
import { FormattedText } from "@/components/common/FormattedText";
import { PageContainer, PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
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
  signature_bucket: string | null;
  signature_path: string | null;
  signature_file_name: string | null;
};

type AgreementIssuer = {
  signer_name: string;
  signer_role: "admin" | "super_admin";
  signed_at: string;
};

type InvitationAgreement = AgreementIssuer & {
  agreement_text: string | null;
};

function LegalDocumentPage() {
  const { type } = Route.useParams();
  const navigate = useNavigate();
  const { user, signAgreementDocument } = useAuth();
  const { partners } = useStore();
  const documentType = type === "nda" ? "NDA" : "Agreement";
  const [acceptance, setAcceptance] = useState<AgreementAcceptance | null>(null);
  const [issuer, setIssuer] = useState<AgreementIssuer | null>(null);
  const [invitationAgreement, setInvitationAgreement] = useState<InvitationAgreement | null>(null);
  const [documentLoading, setDocumentLoading] = useState(user?.role === "partner");
  const [signOpen, setSignOpen] = useState(false);
  const [signerName, setSignerName] = useState(user?.name || "");
  const [signatureConfirmed, setSignatureConfirmed] = useState(false);
  const [signatureMode, setSignatureMode] = useState<"typed" | "upload">("typed");
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || user?.role !== "partner" || !user.partnerId) {
      setDocumentLoading(false);
      return;
    }

    let cancelled = false;
    void Promise.all([
      (supabase as any)
        .from("partner_agreement_acceptances")
        .select(
          "signer_name,signed_at,signature_bucket,signature_path,signature_file_name,agreement_documents!inner(document_type,is_active)",
        )
        .eq("partner_id", user.partnerId)
        .eq("agreement_documents.document_type", documentType)
        .eq("agreement_documents.is_active", true)
        .maybeSingle(),
      (supabase as any).rpc("get_current_partner_agreement_issuer"),
      (supabase as any).rpc("get_current_partner_invitation_agreement"),
    ])
      .then(([acceptanceResult, issuerResult, invitationResult]) => {
        if (cancelled) return;
        setAcceptance((acceptanceResult.data as AgreementAcceptance | null) || null);
        const issuerRows = issuerResult.data as AgreementIssuer[] | null;
        setIssuer(issuerRows?.[0] || null);
        const invitationRows = invitationResult.data as InvitationAgreement[] | null;
        setInvitationAgreement(invitationRows?.[0] || null);
        setDocumentLoading(false);
      })
      .catch((error: unknown) => {
        console.error("Unable to load agreement signature details", error);
        if (!cancelled) setDocumentLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [documentType, user?.partnerId, user?.role]);

  useEffect(() => {
    if (!supabase || !acceptance?.signature_path) return;
    let active = true;
    void supabase.storage
      .from(acceptance.signature_bucket || "partner-signatures")
      .createSignedUrl(acceptance.signature_path, 900)
      .then(({ data, error }) => {
        if (!active || error) return;
        setSignaturePreview(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [acceptance?.signature_bucket, acceptance?.signature_path]);

  if (type !== "agreement" && type !== "nda") return <Navigate to="/onboarding" replace />;

  const partner = partners.find((item) => item.id === user?.partnerId);
  const partnerName = partner?.name || (user?.role === "partner" ? user.name : "Sales Partner");
  const commissionRate = partner?.commissionRate || 10;
  const effectiveDate = new Date(
    issuer?.signed_at || partner?.joinedDate || Date.now(),
  ).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const goAccelovateSignerName = issuer?.signer_name || LEGAL_DEFAULTS.goAccelovateSignatoryName;
  const goAccelovateSignerTitle = issuer
    ? issuer.signer_role === "super_admin"
      ? "Super Admin"
      : "Admin"
    : LEGAL_DEFAULTS.goAccelovateSignatoryTitle;
  const goAccelovateSignedDate = new Date(
    issuer?.signed_at || partner?.joinedDate || Date.now(),
  ).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const agreement = type === "agreement";
  const title = agreement ? "Strategic Referral Partnership Agreement" : "Non-Disclosure Agreement";
  const sections = agreement ? PARTNER_AGREEMENT_SECTIONS : NDA_SECTIONS;
  const customAgreementText = agreement ? invitationAgreement?.agreement_text?.trim() : "";

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
              {user?.role === "partner" && documentLoading ? (
                <Button disabled>Loading signature status...</Button>
              ) : user?.role === "partner" && !acceptance ? (
                <Button onClick={() => setSignOpen(true)}>Sign {documentType}</Button>
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
            <BrandLogo tone="black" className="h-14 w-auto max-w-[240px] object-contain" />
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

            {customAgreementText ? (
              <section>
                <FormattedText value={populateLegalText(customAgreementText, commissionRate)} />
              </section>
            ) : (
              sections.map((section, index) => (
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
              ))
            )}

            <section className="space-y-5 pt-4">
              <h2 className="text-lg font-semibold text-slate-950">Signatories</h2>
              <div className="grid gap-8 sm:grid-cols-2">
                <div className="space-y-3 text-sm">
                  <div className="font-semibold">For GoAccelovate</div>
                  <div>Name: {goAccelovateSignerName}</div>
                  <div>Title: {goAccelovateSignerTitle}</div>
                  <div className="pt-5">
                    Electronic signature:{" "}
                    <span className="font-serif text-base italic">{goAccelovateSignerName}</span>
                  </div>
                  <div>Date: {goAccelovateSignedDate}</div>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="font-semibold">For {partnerName}</div>
                  {documentLoading ? (
                    <>
                      <div className="pt-5 text-slate-500">Loading signature status...</div>
                      <div>Date: Pending</div>
                    </>
                  ) : acceptance ? (
                    <>
                      <div className="pt-5">
                        {acceptance.signature_path && signaturePreview ? (
                          <div>
                            <div className="mb-2 text-xs text-slate-500">Uploaded signature</div>
                            <img
                              src={signaturePreview}
                              alt={`${acceptance.signer_name}'s signature`}
                              className="h-16 max-w-56 object-contain object-left"
                            />
                          </div>
                        ) : (
                          <>
                            Electronic signature:{" "}
                            <span className="font-serif text-base italic">
                              {acceptance.signer_name}
                            </span>
                          </>
                        )}
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
      <FormDialog
        open={signOpen}
        onOpenChange={(open) => {
          setSignOpen(open);
          if (!open) {
            setSignatureConfirmed(false);
            setSignatureFile(null);
            setSignatureMode("typed");
          }
        }}
        title={`Sign ${title}`}
        description={`This signature applies only to the current ${documentType}. The other document must be signed separately.`}
        submitLabel={`Sign ${documentType}`}
        canSubmit={
          Boolean(signerName.trim()) &&
          signatureConfirmed &&
          (signatureMode === "typed" || Boolean(signatureFile))
        }
        onSubmit={async () => {
          let uploadedPath: string | null = null;
          if (signatureMode === "upload") {
            if (!supabase || !user || !signatureFile) {
              toast.error("Choose a signature image before signing.");
              return;
            }
            if (!["image/png", "image/jpeg", "image/webp"].includes(signatureFile.type)) {
              toast.error("Upload a PNG, JPEG, or WebP signature image.");
              return;
            }
            if (signatureFile.size > 2 * 1024 * 1024) {
              toast.error("Signature image must be 2MB or smaller.");
              return;
            }
            const extension = signatureFile.name.split(".").pop()?.toLowerCase() || "png";
            uploadedPath = `${user.id}/${documentType.toLowerCase()}/${crypto.randomUUID()}.${extension}`;
            const { error: uploadError } = await supabase.storage
              .from("partner-signatures")
              .upload(uploadedPath, signatureFile, {
                cacheControl: "3600",
                contentType: signatureFile.type,
                upsert: false,
              });
            if (uploadError) {
              toast.error(`Signature upload failed: ${uploadError.message}`);
              return;
            }
          }

          const result = await signAgreementDocument(
            documentType,
            signerName.trim(),
            uploadedPath && signatureFile
              ? { path: uploadedPath, fileName: signatureFile.name }
              : undefined,
          );
          if (result.error) {
            if (uploadedPath && supabase) {
              await supabase.storage.from("partner-signatures").remove([uploadedPath]);
            }
            toast.error(result.error);
            return;
          }
          const signedAt = new Date().toISOString();
          setAcceptance({
            signer_name: signerName.trim(),
            signed_at: signedAt,
            signature_bucket: uploadedPath ? "partner-signatures" : null,
            signature_path: uploadedPath,
            signature_file_name: signatureFile?.name || null,
          });
          setSignOpen(false);
          setSignatureConfirmed(false);
          toast.success(
            result.agreementsComplete
              ? `${documentType} signed. Both required documents are now complete.`
              : `${documentType} signed. Review and sign the remaining document to unlock portal access.`,
          );
        }}
      >
        <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
          <Button
            type="button"
            variant={signatureMode === "typed" ? "default" : "ghost"}
            onClick={() => setSignatureMode("typed")}
          >
            <PenLine />
            Type signature
          </Button>
          <Button
            type="button"
            variant={signatureMode === "upload" ? "default" : "ghost"}
            onClick={() => setSignatureMode("upload")}
          >
            <ImageUp />
            Upload signature
          </Button>
        </div>
        <label className="block text-xs font-medium">
          Legal name
          <input
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 font-serif text-base italic"
            value={signerName}
            onChange={(event) => setSignerName(event.target.value)}
            autoComplete="name"
            placeholder="Enter your full legal name"
          />
        </label>
        {signatureMode === "upload" && (
          <label className="block text-xs font-medium">
            Signature image
            <span className="mt-2 flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-4 transition-colors hover:bg-accent/30">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span>
                {signatureFile
                  ? signatureFile.name
                  : "Choose a transparent PNG, JPEG, or WebP (maximum 2MB)"}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  if (file && file.size > 2 * 1024 * 1024) {
                    toast.error("Signature image must be 2MB or smaller.");
                    event.target.value = "";
                    setSignatureFile(null);
                    return;
                  }
                  setSignatureFile(file);
                }}
              />
            </span>
          </label>
        )}
        <label className="block text-xs font-medium">
          Signature date
          <input
            type="date"
            className="mt-1 h-10 w-full rounded-md border bg-muted px-3 text-sm"
            value={new Date().toISOString().slice(0, 10)}
            readOnly
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={signatureConfirmed}
            onChange={(event) => setSignatureConfirmed(event.target.checked)}
          />
          <span>
            I have reviewed and agree to this {documentType}, and I consent to use this electronic
            signature.
          </span>
        </label>
      </FormDialog>
    </>
  );
}

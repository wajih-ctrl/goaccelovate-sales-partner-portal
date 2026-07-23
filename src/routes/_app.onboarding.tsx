/* eslint-disable @typescript-eslint/no-explicit-any -- Agreement tables are introduced by the pending migration. */
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  FileSignature,
  FileText,
  Handshake,
  LifeBuoy,
  ExternalLink,
  PlayCircle,
  Rocket,
  ShieldCheck,
  LockKeyhole,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader, PageContainer } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
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

function youtubeEmbedUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    const id =
      host === "youtu.be"
        ? url.pathname.split("/").filter(Boolean)[0]
        : url.searchParams.get("v") ||
          (url.pathname.startsWith("/embed/") ? url.pathname.split("/")[2] : null);
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

function Onboarding() {
  const { user } = useAuth();
  const { onboarding, settings } = useStore();
  const [documents, setDocuments] = useState<AgreementDocument[]>([]);
  const [signedDocumentTypes, setSignedDocumentTypes] = useState<
    Set<AgreementDocument["document_type"]>
  >(new Set());
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [welcomeAcknowledged, setWelcomeAcknowledged] = useState(false);
  const [welcomeLoading, setWelcomeLoading] = useState(false);

  useEffect(() => {
    if (!supabase || user?.role !== "partner") {
      setDocumentsLoading(false);
      return;
    }
    void Promise.all([
      (supabase as any)
        .from("agreement_documents")
        .select("id,document_type,title,version,content_url")
        .eq("is_active", true)
        .order("document_type"),
      (supabase as any)
        .from("partner_agreement_acceptances")
        .select("agreement_documents!inner(document_type,is_active)")
        .eq("agreement_documents.is_active", true),
    ]).then(
      ([documentsResult, acceptancesResult]: [
        { data: AgreementDocument[] | null; error: { message: string } | null },
        {
          data:
            | {
                agreement_documents:
                  | { document_type: AgreementDocument["document_type"] }
                  | { document_type: AgreementDocument["document_type"] }[];
              }[]
            | null;
          error: { message: string } | null;
        },
      ]) => {
        if (documentsResult.error) toast.error(documentsResult.error.message);
        else setDocuments(documentsResult.data || []);

        if (acceptancesResult.error) toast.error(acceptancesResult.error.message);
        else {
          setSignedDocumentTypes(
            new Set(
              (acceptancesResult.data || []).flatMap((acceptance) => {
                const joined = acceptance.agreement_documents;
                return (Array.isArray(joined) ? joined : [joined]).map(
                  (document) => document.document_type,
                );
              }),
            ),
          );
        }
        setDocumentsLoading(false);
      },
    );
  }, [user?.role]);

  useEffect(() => {
    if (user?.partnerId && onboarding[user.partnerId]?.welcome) {
      setWelcomeAcknowledged(true);
    }
  }, [onboarding, user?.partnerId]);

  if (user?.role !== "partner") return <Navigate to="/access-denied" />;
  const status: Record<string, boolean> = {
    ...(onboarding[user.partnerId!] || {}),
    agreement: Boolean(
      onboarding[user.partnerId!]?.agreement || signedDocumentTypes.has("Agreement"),
    ),
    nda: Boolean(onboarding[user.partnerId!]?.nda || signedDocumentTypes.has("NDA")),
    welcome: Boolean(welcomeAcknowledged || onboarding[user.partnerId!]?.welcome),
  };
  const done = ONBOARDING_STEPS.filter((step) => status[step.key]).length;
  const pct = Math.round((done / ONBOARDING_STEPS.length) * 100);
  const currentStepIndex = ONBOARDING_STEPS.findIndex((step) => !status[step.key]);
  const documentsReady =
    documents.length >= 2 && documents.every((document) => document.content_url);
  const introductionVideoEmbed = youtubeEmbedUrl(settings.welcomeIntroVideoUrl);

  const acknowledgeWelcomeKit = async () => {
    if (!supabase) return toast.error("Supabase is not configured.");
    setWelcomeLoading(true);
    const { error } = await (supabase as any).rpc("acknowledge_partner_welcome_kit");
    setWelcomeLoading(false);
    if (error) return toast.error(error.message);
    setWelcomeAcknowledged(true);
    toast.success("Welcome kit acknowledged. Your onboarding progress has been updated.");
  };

  return (
    <>
      <PageHeader
        title="Partner Onboarding"
        description="Finish your partner setup and start building your pipeline."
      />
      <PageContainer>
        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">
                {done} of {ONBOARDING_STEPS.length} program steps complete
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Complete each step in order to unlock the next part of your partner journey.
              </p>
            </div>
            <div className="text-2xl font-semibold">{pct}%</div>
          </div>
          <div className="my-5 h-2 w-full overflow-hidden rounded-full bg-accent">
            <div className="h-full bg-gradient-brand transition-all" style={{ width: `${pct}%` }} />
          </div>
          <ol className="grid gap-3 md:grid-cols-5">
            {ONBOARDING_STEPS.map((step, index) => {
              const complete = status[step.key];
              const active = index === currentStepIndex;
              const locked = currentStepIndex >= 0 && index > currentStepIndex;
              return (
                <li
                  key={step.key}
                  className={`relative flex items-center gap-3 rounded-md border p-3 ${
                    complete
                      ? "border-success/25 bg-success/5"
                      : active
                        ? "border-foreground bg-accent/30"
                        : "bg-muted/30 text-muted-foreground"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                      complete ? "border-success bg-success text-white" : "bg-background"
                    }`}
                  >
                    {complete ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : locked ? (
                      <LockKeyhole className="h-3.5 w-3.5" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="text-xs font-medium leading-4">{step.label}</span>
                </li>
              );
            })}
          </ol>
        </Card>

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
                    className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm hover:bg-accent/30"
                  >
                    <span className="min-w-0">
                      <strong className="block truncate">{document.title}</strong>
                      <span className="block text-xs text-muted-foreground">
                        {document.document_type} version {document.version}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs font-medium">
                      {signedDocumentTypes.has(document.document_type) ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-success" />
                          Signed
                        </>
                      ) : (
                        <>
                          Review and sign
                          <FileText className="h-4 w-4" />
                        </>
                      )}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm">
                The final Agreement and NDA have not been published yet. A Super Admin must upload
                and activate both final documents before invited Sales Partners can sign in.
              </div>
            )}

            <div className="rounded-md border bg-accent/20 p-3 text-sm text-muted-foreground">
              Open and sign each document individually. Pipeline and commission access unlocks
              automatically after both the Agreement and NDA are signed.
            </div>
          </Card>
        )}

        {user.agreementsComplete !== false && (
          <Card className="space-y-6 p-5">
            {!status.profile && (
              <div className="flex flex-col justify-between gap-4 rounded-md border p-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-semibold">Complete your partner profile</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add your contact information and professional background to unlock the welcome
                    kit.
                  </p>
                </div>
                <Button asChild>
                  <Link to="/profile">Complete profile</Link>
                </Button>
              </div>
            )}
            {status.profile && (
              <section
                id="welcome-kit"
                className="border-t pt-5"
                aria-labelledby="welcome-kit-title"
              >
                <div className="space-y-5">
                  <div className="w-full">
                    <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                      <BrandLogo
                        tone="black"
                        className="h-11 w-auto max-w-full object-contain sm:h-14 sm:max-w-[230px]"
                      />
                      <div>
                        <h3 id="welcome-kit-title" className="font-semibold">
                          Global Partner Program Welcome Kit
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Your starting point for representing GoAccelovate with confidence.
                        </p>
                      </div>
                    </div>
                    <div className="mb-4 w-full overflow-hidden rounded-md border bg-black">
                      {introductionVideoEmbed ? (
                        <iframe
                          src={introductionVideoEmbed}
                          title="GoAccelovate introduction video"
                          className="aspect-video w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      ) : (
                        <div className="flex aspect-video items-center justify-center text-sm text-white/70">
                          Introduction video preview is unavailable.
                        </div>
                      )}
                      <a
                        href={settings.welcomeIntroVideoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 border-t border-white/15 px-4 py-3 text-white transition-colors hover:bg-white/10"
                      >
                        <PlayCircle className="h-5 w-5 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">Introduction video</span>
                          <span className="block text-xs text-white/60">
                            Welcome from the VP of Global Client Relations.
                          </span>
                        </span>
                        <ExternalLink className="h-4 w-4 shrink-0" />
                      </a>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-3">
                      <a
                        href="https://www.youtube.com/@GoAccelovate/playlists"
                        target="_blank"
                        rel="noreferrer"
                        className="group flex min-h-32 items-center gap-4 rounded-md border border-zinc-700 bg-zinc-950 p-5 text-white shadow-elevated transition-colors hover:bg-zinc-900"
                      >
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-white/25 bg-white/10">
                          <Rocket className="h-6 w-6" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2 text-sm font-medium">
                            Explore our Use Cases <ExternalLink className="h-3.5 w-3.5" />
                          </div>
                          <p className="mt-2 text-xs leading-5 text-white/65">
                            Browse GoAccelovate's solution and industry playlists.
                          </p>
                        </div>
                      </a>
                      <a
                        href="https://www.goaccelovate.com/case-studies"
                        target="_blank"
                        rel="noreferrer"
                        className="group flex min-h-32 items-center gap-4 rounded-md border border-zinc-700 bg-zinc-950 p-5 text-white shadow-elevated transition-colors hover:bg-zinc-900"
                      >
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-white/25 bg-white/10">
                          <ShieldCheck className="h-6 w-6" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2 text-sm font-medium">
                            Explore our Case Studies <ExternalLink className="h-3.5 w-3.5" />
                          </div>
                          <p className="mt-2 text-xs leading-5 text-white/65">
                            See how GoAccelovate delivers measurable client outcomes.
                          </p>
                        </div>
                      </a>
                      <a
                        href="https://canva.link/c3278nhyl1ahyj5"
                        target="_blank"
                        rel="noreferrer"
                        className="group flex min-h-32 items-center gap-4 rounded-md border border-zinc-700 bg-zinc-950 p-5 text-white shadow-elevated transition-colors hover:bg-zinc-900"
                      >
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-white/25 bg-white/10">
                          <Handshake className="h-6 w-6" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2 text-sm font-medium">
                            View Company Profile <ExternalLink className="h-3.5 w-3.5" />
                          </div>
                          <p className="mt-2 text-xs leading-5 text-white/65">
                            Open the current GoAccelovate company profile.
                          </p>
                        </div>
                      </a>
                    </div>
                  </div>
                  <div className="flex justify-end border-t pt-5">
                    {status.welcome ? (
                      <div className="flex items-center gap-2 rounded-md border border-success/25 bg-success/5 px-4 py-2 text-sm font-medium text-success">
                        <CheckCircle2 className="h-5 w-5" />
                        Welcome kit acknowledged
                      </div>
                    ) : (
                      <Button onClick={acknowledgeWelcomeKit} disabled={welcomeLoading}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {welcomeLoading ? "Saving..." : "Acknowledge welcome kit"}
                      </Button>
                    )}
                  </div>
                </div>
              </section>
            )}
            {status.welcome && !status.firstLead && (
              <div className="flex flex-col justify-between gap-4 rounded-md border p-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-semibold">Submit your first lead</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your onboarding setup is ready. Add your first qualified opportunity to finish.
                  </p>
                </div>
                <Button asChild>
                  <Link to="/submit-lead">Submit first lead</Link>
                </Button>
              </div>
            )}
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

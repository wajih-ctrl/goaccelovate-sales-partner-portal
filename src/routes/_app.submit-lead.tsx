import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { PageHeader, PageContainer } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";
import { Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { COUNTRIES, INDUSTRIES } from "@/lib/program";

export const Route = createFileRoute("/_app/submit-lead")({
  component: SubmitLead,
});

function SubmitLead() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { leads, settings, addLead, addAttachment, setOnboardingStep } = useStore();

  const empty = {
    company: "",
    contactName: "",
    contactTitle: "",
    contactEmail: "",
    contactPhone: "",
    clientLinkedin: "",
    country: "",
    industry: "",
    value: "",
    currency: settings.currency || "USD",
    description: "",
  };
  const [form, setForm] = useState(empty);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<{
    id: string;
    duplicate: boolean;
    duplicateReason?: string;
  } | null>(null);

  if (user?.role !== "partner") return <Navigate to="/access-denied" />;

  const set = (k: string, v: string) => {
    setForm({ ...form, [k]: v });
    setErrors({ ...errors, [k]: "" });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.company.trim()) e.company = "Company name is required";
    if (!form.contactName.trim()) e.contactName = "Contact name is required";
    if (!form.contactTitle.trim()) e.contactTitle = "Job title is required";
    if (!form.contactEmail.trim()) e.contactEmail = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail))
      e.contactEmail = "Invalid email format";
    if (!form.country.trim()) e.country = "Country is required";
    if (!form.industry) e.industry = "Industry is required";
    if (!form.value) e.value = "Estimated value is required";
    else if (isNaN(Number(form.value)) || Number(form.value) <= 0)
      e.value = "Value must be a positive number";
    if (!settings.currencies.includes(form.currency)) e.value = "Unsupported currency";
    if (!form.description.trim()) e.description = "Description is required";
    else if (form.description.trim().length < 50) e.description = "Minimum 50 characters required";
    else if (form.description.trim().split(/\s+/).length > 1000)
      e.description = "Maximum 1,000 words allowed";
    return e;
  };

  const submit = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("Please fix the errors below");
      return;
    }
    const company = form.company.toLowerCase().trim();
    const email = form.contactEmail.toLowerCase().trim();
    const isDup = leads.some(
      (l) =>
        l.company.toLowerCase().trim() === company || l.contactEmail.toLowerCase().trim() === email,
    );
    try {
      const lead = await addLead(
        {
          company: form.company.trim(),
          contactName: form.contactName.trim(),
          contactTitle: form.contactTitle.trim(),
          contactEmail: form.contactEmail.trim(),
          contactPhone: form.contactPhone.trim(),
          clientLinkedin: form.clientLinkedin.trim(),
          country: form.country.trim(),
          industry: form.industry,
          estimatedValue: Number(form.value),
          currency: form.currency,
          description: form.description.trim(),
          partnerId: user.partnerId!,
          isDuplicate: isDup,
        },
        user.name,
      );
      if (files.length) {
        setUploading(true);
        for (const file of files) {
          const uploaded = await addAttachment(lead.id, file, user.name, false);
          if (!uploaded) {
            setUploading(false);
            return;
          }
        }
        setUploading(false);
      }
      if (lead.status !== "Duplicate Rejected")
        setOnboardingStep(user.partnerId!, "firstLead", true, user.name);
      const duplicate = lead.status === "Duplicate Rejected";
      setSubmitted({ id: lead.id, duplicate, duplicateReason: lead.duplicateReason });
      if (duplicate) toast.warning(`${lead.id} was automatically rejected as a duplicate.`);
      else toast.success(`${lead.id} submitted successfully and added to your pipeline.`);
    } catch (error) {
      setUploading(false);
      toast.error(error instanceof Error ? error.message : "Lead submission failed");
    }
  };

  const reset = () => {
    setForm(empty);
    setFiles([]);
    setErrors({});
    setSubmitted(null);
  };

  if (submitted) {
    return (
      <>
        <PageHeader title="Lead Submitted" />
        <PageContainer>
          <Card className="p-8 max-w-2xl text-center">
            {submitted.duplicate ? (
              <>
                <AlertCircle className="mx-auto h-12 w-12 text-warning-foreground" />
                <h2 className="mt-3 text-xl font-semibold">Duplicate lead rejected</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Lead <strong>{submitted.id}</strong> matches an existing company or contact email
                  and was automatically rejected. It did not enter the pipeline.
                </p>
                {submitted.duplicateReason && (
                  <p className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground">
                    {submitted.duplicateReason}
                  </p>
                )}
              </>
            ) : (
              <>
                <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
                <h2 className="mt-3 text-xl font-semibold">Lead accepted into pipeline</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Lead <strong>{submitted.id}</strong> is now visible in your pipeline as{" "}
                  <em>Identified Opportunity</em>.
                </p>
              </>
            )}
            <div className="mt-6 flex justify-center gap-2">
              <Button variant="outline" onClick={reset}>
                Submit another
              </Button>
              <Button onClick={() => nav({ to: "/leads/$id", params: { id: submitted.id } })}>
                View lead
              </Button>
            </div>
          </Card>
        </PageContainer>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Submit a Lead"
        description="Share a qualified opportunity with the GoAccelovate team."
      />
      <PageContainer>
        <Card className="p-6 max-w-3xl space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Company name" required error={errors.company}>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.company}
                onChange={(e) => set("company", e.target.value)}
              />
            </Field>
            <Field label="Country" required error={errors.country}>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
              >
                <option value="">Select country...</option>
                {COUNTRIES.map((country) => (
                  <option key={country}>{country}</option>
                ))}
              </select>
            </Field>
            <Field label="Contact name" required error={errors.contactName}>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.contactName}
                onChange={(e) => set("contactName", e.target.value)}
              />
            </Field>
            <Field label="Job title" required error={errors.contactTitle}>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.contactTitle}
                onChange={(e) => set("contactTitle", e.target.value)}
              />
            </Field>
            <Field label="Email address" required error={errors.contactEmail}>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.contactEmail}
                onChange={(e) => set("contactEmail", e.target.value)}
              />
            </Field>
            <Field label="Phone">
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.contactPhone}
                onChange={(e) => set("contactPhone", e.target.value)}
              />
            </Field>
            <Field label="Client LinkedIn">
              <input
                type="url"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.clientLinkedin}
                onChange={(e) => set("clientLinkedin", e.target.value)}
                placeholder="https://www.linkedin.com/in/..."
              />
            </Field>
            <Field label="Industry / sector" required error={errors.industry}>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.industry}
                onChange={(e) => set("industry", e.target.value)}
              >
                <option value="">Select…</option>
                {Array.from(new Set([...INDUSTRIES, ...settings.industries])).map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </select>
            </Field>
            <Field label="Estimated deal value" required error={errors.value}>
              <div className="flex gap-2">
                <input
                  className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
                  value={form.value}
                  onChange={(e) => set("value", e.target.value)}
                  placeholder="e.g. 250000"
                />
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={form.currency}
                  onChange={(e) => set("currency", e.target.value)}
                >
                  {(settings.currencies || ["USD", "EUR", "GBP", "JPY", "INR"]).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </Field>
          </div>

          <Field
            label="Message"
            required
            error={errors.description}
            hint={`${form.description.trim() ? form.description.trim().split(/\s+/).length : 0} of 1,000 words`}
          >
            <textarea
              rows={5}
              className="w-full rounded-md border bg-background p-3 text-sm"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Why is this a good fit for GoAccelovate? Key stakeholders, current situation, timing…"
            />
          </Field>

          <Field label="Attachments (optional)">
            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-4 text-sm hover:bg-accent/30">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFiles((prev) => [...prev, f]);
                    toast.success(`${f.name} attached`);
                  }
                }}
              />
              <span>
                {files.length > 0
                  ? `${files.length} file(s) attached`
                  : "Click to upload supporting docs (PDF, DOCX)"}
              </span>
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {files.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded border bg-accent/20 px-2 py-1"
                  >
                    <span>{f.name}</span>
                    <button
                      className="text-destructive hover:underline"
                      onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Field>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={reset}>
              Clear
            </Button>
            <Button onClick={submit} disabled={uploading}>
              {uploading ? "Uploading..." : "Submit lead"}
            </Button>
          </div>
        </Card>
      </PageContainer>
    </>
  );
}

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <div className="mt-1">{children}</div>
      {error ? (
        <div className="mt-1 text-xs text-destructive">{error}</div>
      ) : (
        hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

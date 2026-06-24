import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { PageHeader, PageContainer, StatusBadge, TierBadge } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore, type PartnerDocument } from "@/lib/store";
import { ONBOARDING_STEPS, fmtCurrency, type Partner } from "@/lib/mock-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Mail,
  Phone,
  Linkedin,
  MapPin,
  CheckCircle2,
  Circle,
  Lock,
  Edit,
  FileUp,
  Settings2,
} from "lucide-react";
import { useState } from "react";
import { FormDialog } from "@/components/common/dialogs";

export const Route = createFileRoute("/_app/partners/$id")({ component: PartnerDetail });

function PartnerDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const store = useStore();
  const partner = store.partners.find((p) => p.id === id);
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<{ id: string; user: string; date: string; text: string }[]>([
    {
      id: "n1",
      user: "Marcus Reid",
      date: "2025-06-12",
      text: "Excellent activation. Strong APAC enterprise pipeline. Consider tier upgrade after Q3.",
    },
    {
      id: "n2",
      user: "Alexandra Pierce",
      date: "2025-05-30",
      text: "Flagged a duplicate concern with another partner's lead - resolved amicably.",
    },
  ]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [commercialOpen, setCommercialOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    linkedin: "",
    city: "",
    country: "",
    bio: "",
    assignedContact: "",
  });
  const [commercialForm, setCommercialForm] = useState({
    tier: "Associate",
    rate: "",
    status: "Active",
  });
  const [docForm, setDocForm] = useState({
    file: undefined as File | undefined,
    type: "Agreement" as "Agreement" | "NDA" | "Commission Schedule" | "Compliance" | "Other",
    private: false,
  });
  const [docUploading, setDocUploading] = useState(false);

  if (!partner) return <Navigate to="/partners" />;
  if (user?.role === "partner" && user.partnerId !== id) return <Navigate to="/access-denied" />;

  const leads = store.leads.filter((l) => l.partnerId === id);
  const comm = store.commissions.filter((c) => c.partnerId === id);
  const totalEarned = comm.reduce((s, c) => s + c.amount, 0);
  const onboarding = store.onboarding[id] || {};
  const documents = store.partnerDocuments[id] || [];
  const canEdit = user?.role === "admin" || user?.role === "super_admin";
  const canSuspend = user?.role === "super_admin";

  const openProfile = () => {
    setProfileForm({
      name: partner.name,
      email: partner.email,
      phone: partner.phone,
      linkedin: partner.linkedin,
      city: partner.city,
      country: partner.country,
      bio: partner.bio,
      assignedContact: partner.assignedContact,
    });
    setProfileOpen(true);
  };

  const openCommercial = () => {
    setCommercialForm({
      tier: partner.tier,
      rate: String(partner.commissionRate),
      status: partner.status,
    });
    setCommercialOpen(true);
  };

  const addNote = () => {
    if (!note.trim()) {
      toast.error("Note cannot be empty");
      return;
    }
    setNotes((n) => [
      { id: `n${Date.now()}`, user: user!.name, date: new Date().toISOString(), text: note.trim() },
      ...n,
    ]);
    setNote("");
    toast.success("Internal note added");
  };

  return (
    <>
      <PageHeader
        title={partner.name}
        description={`Partner since ${new Date(partner.joinedDate).toLocaleDateString()} - ${partner.assignedContact}`}
        actions={
          <>
            {canEdit && (
              <Button variant="outline" onClick={openProfile}>
                <Edit className="mr-2 h-4 w-4" />
                Edit profile
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" onClick={openCommercial}>
                <Settings2 className="mr-2 h-4 w-4" />
                Commercial settings
              </Button>
            )}
            <Link to="/partners">
              <Button variant="outline">Back to Partners</Button>
            </Link>
          </>
        }
      />
      <PageContainer>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-5 shadow-card lg:col-span-1">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-brand text-lg font-semibold text-brand-foreground">
                {partner.name
                  .split(" ")
                  .map((x) => x[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div>
                <h2 className="text-lg font-semibold">{partner.name}</h2>
                <div className="mt-1 flex gap-2">
                  <TierBadge tier={partner.tier} />
                  <StatusBadge status={partner.status} />
                </div>
              </div>
            </div>
            <div className="mt-5 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" /> {partner.email}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" /> {partner.phone}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Linkedin className="h-4 w-4" /> {partner.linkedin}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" /> {partner.city}, {partner.country}
              </div>
            </div>
            <div className="mt-5 space-y-3 border-t pt-4 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Bio</div>
                <p className="mt-1 text-sm">{partner.bio}</p>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Commission rate
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-semibold">{partner.commissionRate}%</span>
                  {!canEdit && <Lock className="h-3 w-3 text-muted-foreground" />}
                </div>
              </div>
              {canSuspend &&
                (partner.status === "Active" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      store.suspendUser(partner.id, user!.name);
                      toast.warning("Account suspended");
                    }}
                  >
                    Suspend account
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      store.reactivateUser(partner.id, user!.name);
                      toast.success("Account reactivated");
                    }}
                  >
                    Reactivate account
                  </Button>
                ))}
            </div>
          </Card>

          <div className="lg:col-span-2">
            <Tabs defaultValue="performance">
              <TabsList>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="leads">Leads</TabsTrigger>
                <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                {canEdit && <TabsTrigger value="notes">Internal Notes</TabsTrigger>}
              </TabsList>

              <TabsContent value="performance">
                <Card className="grid grid-cols-3 gap-4 p-5">
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Total leads</div>
                    <div className="text-xl font-semibold">{leads.length}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Closed won</div>
                    <div className="text-xl font-semibold">
                      {leads.filter((l) => l.status === "Closed Won").length}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Total earned</div>
                    <div className="text-xl font-semibold">{fmtCurrency(totalEarned)}</div>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="leads">
                <Card className="shadow-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-accent/40 text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left">Company</th>
                        <th className="px-4 py-3 text-left">Stage</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((l) => (
                        <tr key={l.id} className="border-t hover:bg-accent/20">
                          <td className="px-4 py-3">
                            <Link
                              to="/leads/$id"
                              params={{ id: l.id }}
                              className="font-medium hover:underline"
                            >
                              {l.company}
                            </Link>
                          </td>
                          <td className="px-4 py-3">{l.stage}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={l.status} />
                          </td>
                          <td className="px-4 py-3 text-right">{fmtCurrency(l.estimatedValue)}</td>
                        </tr>
                      ))}
                      {leads.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-muted-foreground">
                            No leads yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Card>
              </TabsContent>

              <TabsContent value="onboarding">
                <Card className="p-5">
                  <ul className="space-y-3">
                    {ONBOARDING_STEPS.map((s) => {
                      const done = onboarding[s.key];
                      return (
                        <li key={s.key} className="flex items-center gap-3">
                          {done ? (
                            <CheckCircle2 className="h-5 w-5 text-success" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground" />
                          )}
                          <span className={done ? "text-foreground" : "text-muted-foreground"}>
                            {s.label}
                          </span>
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-auto"
                              onClick={() => {
                                store.setOnboardingStep(partner.id, s.key, !done, user!.name);
                                toast.success(done ? "Step reset" : "Step marked complete");
                              }}
                            >
                              {done ? "Reset" : "Mark done"}
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </TabsContent>

              <TabsContent value="documents">
                <Card className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-medium">Agreement and onboarding documents</div>
                    {canEdit && (
                      <Button size="sm" onClick={() => setDocOpen(true)}>
                        <FileUp className="mr-2 h-4 w-4" />
                        Upload
                      </Button>
                    )}
                  </div>
                  <ul className="divide-y text-sm">
                    {documents.map((d) => (
                      <li key={d.id} className="flex items-center justify-between py-3">
                        <div>
                          <div className="font-medium">{d.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {d.type} - uploaded by {d.uploadedBy} on{" "}
                            {new Date(d.uploadedDate).toLocaleDateString()}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            store.downloadStoredFile(d.storageBucket, d.storagePath, d.name)
                          }
                        >
                          Download
                        </Button>
                      </li>
                    ))}
                    {documents.length === 0 && (
                      <li className="py-8 text-center text-muted-foreground">
                        No documents uploaded yet.
                      </li>
                    )}
                  </ul>
                </Card>
              </TabsContent>

              {canEdit && (
                <TabsContent value="notes">
                  <Card className="p-5 space-y-3">
                    <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground">
                      <Lock className="mr-1 inline h-3 w-3" /> Internal - not visible to the
                      partner.
                    </div>
                    <div className="space-y-2">
                      <textarea
                        rows={2}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Add an internal note about this partner..."
                        className="w-full rounded-md border bg-background p-3 text-sm"
                      />
                      <div className="flex justify-end">
                        <Button size="sm" onClick={addNote}>
                          Add note
                        </Button>
                      </div>
                    </div>
                    <ul className="space-y-3 text-sm">
                      {notes.map((n) => (
                        <li key={n.id} className="rounded-md border p-3">
                          <div className="text-xs text-muted-foreground">
                            {n.user} - {new Date(n.date).toLocaleString()}
                          </div>
                          <p className="mt-1">{n.text}</p>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
      </PageContainer>

      <FormDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        title="Edit partner profile"
        submitLabel="Save profile"
        canSubmit={
          !!profileForm.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email)
        }
        onSubmit={() => {
          store.updatePartnerProfile(
            partner.id,
            {
              name: profileForm.name.trim(),
              email: profileForm.email.trim(),
              phone: profileForm.phone.trim(),
              linkedin: profileForm.linkedin.trim(),
              city: profileForm.city.trim(),
              country: profileForm.country.trim(),
              bio: profileForm.bio.trim(),
              assignedContact: profileForm.assignedContact.trim(),
            },
            user!.name,
          );
          toast.success("Partner profile updated");
          setProfileOpen(false);
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            Name
            <input
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
            />
          </label>
          <label className="text-xs">
            Email
            <input
              type="email"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
            />
          </label>
          <label className="text-xs">
            Phone
            <input
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={profileForm.phone}
              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
            />
          </label>
          <label className="text-xs">
            LinkedIn
            <input
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={profileForm.linkedin}
              onChange={(e) => setProfileForm({ ...profileForm, linkedin: e.target.value })}
            />
          </label>
          <label className="text-xs">
            City
            <input
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={profileForm.city}
              onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
            />
          </label>
          <label className="text-xs">
            Country
            <input
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={profileForm.country}
              onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
            />
          </label>
        </div>
        <label className="text-xs">
          Assigned GoAccelovate contact
          <input
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={profileForm.assignedContact}
            onChange={(e) => setProfileForm({ ...profileForm, assignedContact: e.target.value })}
          />
        </label>
        <label className="text-xs">
          Professional background
          <textarea
            rows={3}
            className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
            value={profileForm.bio}
            onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
          />
        </label>
      </FormDialog>

      <FormDialog
        open={commercialOpen}
        onOpenChange={setCommercialOpen}
        title="Commercial settings"
        submitLabel="Save settings"
        canSubmit={!!commercialForm.tier && Number(commercialForm.rate) > 0}
        onSubmit={() => {
          if (commercialForm.tier !== partner.tier)
            store.changePartnerTier(partner.id, commercialForm.tier, user!.name);
          if (Number(commercialForm.rate) !== partner.commissionRate)
            store.changePartnerRate(partner.id, Number(commercialForm.rate), user!.name);
          if (user!.role === "super_admin" && commercialForm.status !== partner.status) {
            store.updatePartnerProfile(
              partner.id,
              { status: commercialForm.status as Partner["status"] },
              user!.name,
            );
          }
          toast.success("Commercial settings updated");
          setCommercialOpen(false);
        }}
      >
        <label className="text-xs">
          GTPP tier
          <select
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={commercialForm.tier}
            onChange={(e) => setCommercialForm({ ...commercialForm, tier: e.target.value })}
          >
            <option>Associate</option>
            <option>Specialist</option>
            <option>Partner</option>
          </select>
        </label>
        <label className="text-xs">
          Commission rate (%)
          <input
            type="number"
            step="0.5"
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={commercialForm.rate}
            onChange={(e) => setCommercialForm({ ...commercialForm, rate: e.target.value })}
          />
        </label>
        {user?.role === "super_admin" && (
          <label className="text-xs">
            Account status
            <select
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={commercialForm.status}
              onChange={(e) => setCommercialForm({ ...commercialForm, status: e.target.value })}
            >
              <option>Active</option>
              <option>Suspended</option>
              <option>Pending</option>
            </select>
          </label>
        )}
      </FormDialog>

      <FormDialog
        open={docOpen}
        onOpenChange={(open) => {
          setDocOpen(open);
          if (!open) setDocForm({ file: undefined, type: "Agreement", private: false });
        }}
        title="Upload partner document"
        submitLabel={docUploading ? "Uploading..." : "Add document"}
        canSubmit={!!docForm.file && !docUploading}
        onSubmit={async () => {
          if (!docForm.file) return;
          setDocUploading(true);
          const uploaded = await store.addPartnerDocument(
            partner.id,
            { file: docForm.file, type: docForm.type, private: docForm.private },
            user!.name,
          );
          setDocUploading(false);
          if (!uploaded) return;
          setDocOpen(false);
        }}
      >
        <label className="text-xs">
          Document type
          <select
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={docForm.type}
            onChange={(e) =>
              setDocForm({ ...docForm, type: e.target.value as PartnerDocument["type"] })
            }
          >
            <option>Agreement</option>
            <option>NDA</option>
            <option>Commission Schedule</option>
            <option>Compliance</option>
            <option>Other</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={docForm.private}
            onChange={(e) => setDocForm({ ...docForm, private: e.target.checked })}
          />
          Private/internal document
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm hover:bg-accent/30">
          <FileUp className="h-4 w-4" />
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setDocForm({ ...docForm, file });
            }}
          />
          {docForm.file ? docForm.file.name : "Choose file"}
        </label>
      </FormDialog>
    </>
  );
}

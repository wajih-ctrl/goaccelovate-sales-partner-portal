import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PageHeader, PageContainer, StatusBadge, TierBadge } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/_app/profile")({ component: Profile });

function Profile() {
  const { user } = useAuth();
  const { partners, partnerDocuments, updatePartnerProfile } = useStore();
  if (user?.role !== "partner") return <Navigate to="/access-denied" />;
  const partner = partners.find(p => p.id === user.partnerId);
  if (!partner) return <Navigate to="/dashboard" />;
  const documents = partnerDocuments[partner.id] || [];
  const [p, setP] = useState(partner);
  useEffect(() => { setP(partner); }, [partner]);

  const save = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) { toast.error("Invalid email"); return; }
    updatePartnerProfile(p.id, { name: p.name, email: p.email, phone: p.phone, linkedin: p.linkedin, city: p.city, country: p.country, bio: p.bio });
    toast.success("Profile updated");
  };

  return (
    <>
      <PageHeader title="My Profile" description="Update your basic personal and professional information."
        actions={<Button onClick={save}>Save changes</Button>} />
      <PageContainer>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-1 space-y-3 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-brand text-xl font-semibold text-brand-foreground">
              {p.name.split(" ").map(x => x[0]).slice(0, 2).join("")}
            </div>
            <div>
              <h2 className="font-semibold">{p.name}</h2>
              <div className="mt-2 flex justify-center gap-2"><TierBadge tier={p.tier} /><StatusBadge status={p.status} /></div>
            </div>
            <div className="rounded-md border bg-accent/30 p-3 text-left text-xs space-y-1">
              <div><strong>Commission rate:</strong> {p.commissionRate}%</div>
              <div><strong>Account manager:</strong> {p.assignedContact}</div>
              <div><strong>Joined:</strong> {new Date(p.joinedDate).toLocaleDateString()}</div>
              <div className="mt-1 text-muted-foreground">Tier, commission rate and account manager are managed by GoAccelovate.</div>
            </div>
          </Card>
          <Card className="p-5 lg:col-span-2 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div><label className="text-xs uppercase text-muted-foreground">Full name</label><input className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={p.name} onChange={e => setP({ ...p, name: e.target.value })} /></div>
              <div><label className="text-xs uppercase text-muted-foreground">Email</label><input className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={p.email} onChange={e => setP({ ...p, email: e.target.value })} /></div>
              <div><label className="text-xs uppercase text-muted-foreground">Phone</label><input className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={p.phone} onChange={e => setP({ ...p, phone: e.target.value })} /></div>
              <div><label className="text-xs uppercase text-muted-foreground">LinkedIn</label><input className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={p.linkedin} onChange={e => setP({ ...p, linkedin: e.target.value })} /></div>
              <div><label className="text-xs uppercase text-muted-foreground">City</label><input className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={p.city} onChange={e => setP({ ...p, city: e.target.value })} /></div>
              <div><label className="text-xs uppercase text-muted-foreground">Country</label><input className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={p.country} onChange={e => setP({ ...p, country: e.target.value })} /></div>
            </div>
            <div><label className="text-xs uppercase text-muted-foreground">Professional bio</label><textarea rows={4} className="mt-1 w-full rounded-md border bg-background p-3 text-sm" value={p.bio} onChange={e => setP({ ...p, bio: e.target.value })} /></div>
          </Card>
        </div>

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">My documents</h3>
          <ul className="divide-y text-sm">
            {documents.map(d => (
              <li key={d.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-muted-foreground">{d.type} · uploaded {new Date(d.uploadedDate).toLocaleDateString()}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => toast.success("Download started (demo)")}>Download</Button>
              </li>
            ))}
            {documents.length === 0 && <li className="py-6 text-center text-muted-foreground">No documents uploaded yet.</li>}
          </ul>
        </Card>
      </PageContainer>
    </>
  );
}

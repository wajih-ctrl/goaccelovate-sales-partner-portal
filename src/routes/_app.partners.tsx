import { createFileRoute, Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { PageHeader, PageContainer, StatusBadge, TierBadge } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { fmtCurrency } from "@/lib/mock-data";
import { useState } from "react";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_app/partners")({
  component: PartnersPage,
});

function PartnersPage() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { partners, leads, commissions } = useStore();
  const [q, setQ] = useState("");

  if (pathname !== "/partners") return <Outlet />;
  if (user?.role === "partner") return <Navigate to="/access-denied" replace />;

  const filtered = partners.filter(
    (p) =>
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.country.toLowerCase().includes(q.toLowerCase()) ||
      p.tier.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <PageHeader title="Partners" description="Manage sales partners across regions and tiers." />
      <PageContainer>
        <Card className="shadow-card">
          <div className="border-b p-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, country, tier…"
                className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-accent/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Partner</th>
                <th className="px-4 py-3 text-left">Region</th>
                <th className="px-4 py-3 text-left">Tier</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Active Leads</th>
                <th className="px-4 py-3 text-right">Commission Earned</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const activeLeads = leads.filter(
                  (l) => l.partnerId === p.id && l.status === "Active",
                ).length;
                const earned = commissions
                  .filter((c) => c.partnerId === p.id)
                  .reduce((s, c) => s + c.amount, 0);
                return (
                  <tr key={p.id} className="border-t hover:bg-accent/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-brand text-xs font-semibold text-brand-foreground">
                          {p.name
                            .split(" ")
                            .map((x) => x[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.city}, {p.country}
                    </td>
                    <td className="px-4 py-3">
                      <TierBadge tier={p.tier} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{activeLeads}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmtCurrency(earned)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to="/partners/$id" params={{ id: p.id }}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No partners match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </PageContainer>
    </>
  );
}

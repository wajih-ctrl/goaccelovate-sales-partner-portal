import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { PageHeader, PageContainer, StatusBadge } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { fmtCurrency, daysSince } from "@/lib/mock-data";
import { useState, useMemo, useEffect } from "react";
import { Search, PlusCircle, Download } from "lucide-react";
import { toast } from "sonner";

interface LeadSearch { q?: string; status?: string; stage?: string; partner?: string }

export const Route = createFileRoute("/_app/leads")({
  validateSearch: (s: Record<string, unknown>): LeadSearch => ({
    q: typeof s.q === "string" ? s.q : undefined,
    status: typeof s.status === "string" ? s.status : undefined,
    stage: typeof s.stage === "string" ? s.stage : undefined,
    partner: typeof s.partner === "string" ? s.partner : undefined,
  }),
  component: LeadsPage,
});

const STAGES = ["All", "New Lead", "In Conversation", "Discovery Call", "Proposal Sent", "Negotiation", "Closed Won", "Closed Lost"];
const STATUSES = ["All", "Active", "On Hold", "Closed Won", "Closed Lost", "Duplicate Under Review", "Duplicate Rejected", "Disqualified", "Reopened"];

function LeadsPage() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const { leads, partners } = useStore();
  const initial = Route.useSearch();
  const [q, setQ] = useState(initial.q || "");
  const [stage, setStage] = useState(initial.stage || "All");
  const [status, setStatus] = useState(initial.status || "All");
  const [partner, setPartner] = useState(initial.partner || "All");

  useEffect(() => { if (initial.q !== undefined) setQ(initial.q); }, [initial.q]);

  const visible = useMemo(() => {
    let list = user?.role === "partner" ? leads.filter(l => l.partnerId === user.partnerId) : leads;
    if (q) list = list.filter(l => l.company.toLowerCase().includes(q.toLowerCase()) || l.contactName.toLowerCase().includes(q.toLowerCase()) || l.id.toLowerCase().includes(q.toLowerCase()));
    if (stage !== "All") list = list.filter(l => l.stage === stage);
    if (status !== "All") list = list.filter(l => l.status === status);
    if (partner !== "All") list = list.filter(l => l.partnerId === partner);
    return list;
  }, [leads, q, stage, status, partner, user]);

  if (pathname !== "/leads") return <Outlet />;

  const reset = () => { setQ(""); setStage("All"); setStatus("All"); setPartner("All"); };

  const exportCsv = () => {
    const rows = [["ID", "Company", "Contact", "Country", "Stage", "Status", "Value", "Last activity"]];
    visible.forEach(l => rows.push([l.id, l.company, l.contactName, l.country, l.stage, l.status, String(l.estimatedValue), l.lastActivity]));
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "leads.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${visible.length} leads to CSV`);
  };

  return (
    <>
      <PageHeader
        title={user?.role === "partner" ? "My Leads" : "All Leads"}
        description={user?.role === "partner" ? "Leads you've submitted." : "Every lead across the GTPP network."}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
            {user?.role === "partner" && <Link to="/submit-lead"><Button><PlusCircle className="mr-2 h-4 w-4" />Submit Lead</Button></Link>}
          </>
        }
      />
      <PageContainer>
        <Card className="shadow-card">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search company, contact, or ID…" className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" />
            </div>
            <select value={stage} onChange={e => setStage(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
              {STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={status} onChange={e => setStatus(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            {user?.role !== "partner" && (
              <select value={partner} onChange={e => setPartner(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value="All">All partners</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <Button variant="ghost" size="sm" onClick={reset}>Reset</Button>
            <span className="ml-auto text-xs text-muted-foreground">{visible.length} of {leads.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-accent/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Company</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Country</th>
                  {user?.role !== "partner" && <th className="px-4 py-3 text-left">Partner</th>}
                  <th className="px-4 py-3 text-left">Stage</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Value</th>
                  <th className="px-4 py-3 text-left">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(l => {
                  const p = partners.find(pp => pp.id === l.partnerId);
                  return (
                    <tr key={l.id} className="border-t hover:bg-accent/20">
                      <td className="px-4 py-3"><Link to="/leads/$id" params={{ id: l.id }} className="font-medium hover:underline">{l.company}</Link><div className="text-[11px] text-muted-foreground">{l.id}</div></td>
                      <td className="px-4 py-3">{l.contactName}</td>
                      <td className="px-4 py-3">{l.country}</td>
                      {user?.role !== "partner" && <td className="px-4 py-3">{p?.name}</td>}
                      <td className="px-4 py-3">{l.stage}</td>
                      <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                      <td className="px-4 py-3 text-right">{fmtCurrency(l.estimatedValue)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{daysSince(l.lastActivity)}d ago</td>
                    </tr>
                  );
                })}
                {visible.length === 0 && <tr><td colSpan={user?.role !== "partner" ? 8 : 7} className="py-10 text-center text-muted-foreground">No leads match your filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </PageContainer>
    </>
  );
}

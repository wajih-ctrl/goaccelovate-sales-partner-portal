import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PageContainer } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { fmtCurrency } from "@/lib/mock-data";
import { toast } from "sonner";
import { Download, FileText, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/_app/reports")({ component: Reports });

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = filename; a.click();
  toast.success(`${filename} downloaded`);
}
function downloadPdfStub(filename: string) {
  // Demo: emit a tiny text "PDF" placeholder so download is real.
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([`PDF placeholder for ${filename}`], { type: "application/pdf" })); a.download = filename; a.click();
  toast.success(`${filename} downloaded`);
}

function Reports() {
  const { user } = useAuth();
  const { partners, leads, commissions, payouts, clientPayments } = useStore();
  const isPartner = user?.role === "partner";

  const partnerOverview = () => downloadCsv("partners-overview.csv", [
    ["Name", "Tier", "Status", "Country", "Rate", "Active Leads", "Won", "Earned"],
    ...partners.map(p => {
      const my = leads.filter(l => l.partnerId === p.id);
      const earned = commissions.filter(c => c.partnerId === p.id).reduce((s, c) => s + c.amount, 0);
      return [p.name, p.tier, p.status, p.country, `${p.commissionRate}%`, my.filter(l => l.status === "Active").length, my.filter(l => l.status === "Closed Won").length, earned];
    }),
  ]);
  const pipelineReport = () => downloadCsv("pipeline.csv", [
    ["ID", "Company", "Partner", "Stage", "Status", "Value", "Last Activity"],
    ...leads.map(l => [l.id, l.company, partners.find(p => p.id === l.partnerId)?.name || "", l.stage, l.status, l.estimatedValue, l.lastActivity]),
  ]);
  const liability = () => downloadCsv("commission-liability.csv", [
    ["Partner", "Unpaid", "Approved", "Requested", "Disputed", "Total Owed"],
    ...partners.map(p => {
      const my = commissions.filter(c => c.partnerId === p.id);
      const sum = (st: string) => my.filter(c => c.state === st).reduce((s, c) => s + c.amount, 0);
      return [p.name, sum("Unpaid"), sum("Approved"), sum("Payout Requested"), sum("Disputed"), sum("Unpaid") + sum("Approved") + sum("Payout Requested") + sum("Disputed")];
    }),
  ]);
  const payoutHistory = () => downloadCsv("payout-history.csv", [
    ["ID", "Partner", "Amount", "Status", "Requested", "Paid", "Method", "Reference"],
    ...payouts.map(p => [p.id, partners.find(pp => pp.id === p.partnerId)?.name || "", p.amount, p.status, p.requestedDate, p.paidDate || "", p.method || "", p.reference || ""]),
  ]);
  const revenue = () => downloadCsv("client-revenue.csv", [
    ["Reference", "Deal", "Partner", "Amount", "Date", "Method"],
    ...clientPayments.map(cp => {
      const l = leads.find(x => x.id === cp.leadId);
      const p = l && partners.find(pp => pp.id === l.partnerId);
      return [cp.reference, l?.company || "", p?.name || "", cp.amount, cp.date, cp.method];
    }),
  ]);

  const myLeadsReport = () => downloadCsv("my-leads.csv", [
    ["ID", "Company", "Stage", "Status", "Value", "Last Activity"],
    ...leads.filter(l => l.partnerId === user!.partnerId).map(l => [l.id, l.company, l.stage, l.status, l.estimatedValue, l.lastActivity]),
  ]);
  const myStatement = () => downloadCsv("commission-statement.csv", [
    ["Deal", "Rate", "Amount", "State", "Closed"],
    ...commissions.filter(c => c.partnerId === user!.partnerId).map(c => [leads.find(l => l.id === c.leadId)?.company || c.leadId, `${c.rate}%`, c.amount, c.state, c.closedDate]),
  ]);

  const adminReports = [
    { name: "All Partners Overview", desc: "Roster, tiers, status, performance summary.", csv: partnerOverview, pdf: () => downloadPdfStub("partners-overview.pdf") },
    { name: "Full Pipeline Report", desc: "Every lead across every stage with valuation rollups.", csv: pipelineReport, pdf: () => downloadPdfStub("pipeline.pdf") },
    { name: "Commission Liability Report", desc: "Outstanding partner commission liabilities.", csv: liability, pdf: () => downloadPdfStub("commission-liability.pdf") },
    { name: "Payout History", desc: "Every payout request and its current state.", csv: payoutHistory, pdf: () => downloadPdfStub("payout-history.pdf") },
    { name: "Client Revenue Attribution", desc: "Closed-won revenue attributed by partner.", csv: revenue, pdf: () => downloadPdfStub("client-revenue.pdf") },
  ];
  const partnerReports = [
    { name: "My Leads Report", desc: "Every lead you've submitted, with stage and value.", csv: myLeadsReport, pdf: () => downloadPdfStub("my-leads.pdf") },
    { name: "My Commission Statement", desc: "Earnings, paid, pending — by deal.", csv: myStatement, pdf: () => downloadPdfStub("commission-statement.pdf") },
  ];
  const list = isPartner ? partnerReports : adminReports;

  // Headline numbers
  const totals = isPartner ? {
    leads: leads.filter(l => l.partnerId === user!.partnerId).length,
    earned: commissions.filter(c => c.partnerId === user!.partnerId).reduce((s, c) => s + c.amount, 0),
  } : {
    leads: leads.length,
    earned: commissions.reduce((s, c) => s + c.amount, 0),
  };

  return (
    <>
      <PageHeader title={isPartner ? "My Reports" : "Reports"} description="Generate and export performance reports." />
      <PageContainer>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5"><div className="text-xs uppercase text-muted-foreground">Total leads</div><div className="mt-1 text-2xl font-semibold">{totals.leads}</div></Card>
          <Card className="p-5"><div className="text-xs uppercase text-muted-foreground">Commissions to date</div><div className="mt-1 text-2xl font-semibold">{fmtCurrency(totals.earned)}</div></Card>
          {!isPartner && <Card className="p-5"><div className="text-xs uppercase text-muted-foreground">Active partners</div><div className="mt-1 text-2xl font-semibold">{partners.filter(p => p.status === "Active").length}</div></Card>}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {list.map(r => (
            <Card key={r.name} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{r.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{r.desc}</p>
                </div>
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={r.csv}><FileSpreadsheet className="mr-2 h-4 w-4" />CSV</Button>
                <Button size="sm" variant="outline" onClick={r.pdf}><Download className="mr-2 h-4 w-4" />PDF</Button>
              </div>
            </Card>
          ))}
        </div>
      </PageContainer>
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { FileSpreadsheet, FileText } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { downloadCsv } from "@/lib/exports";
import { fmtCurrency } from "@/lib/domain";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/_app/reports")({ component: Reports });

function Reports() {
  const { user } = useAuth();
  const { partners, leads, commissions, payouts, clientPayments } = useStore();
  const isPartner = user?.role === "partner";
  const partnerId = user?.partnerId;

  const partnerOverviewRows = [
    ["Name", "Status", "Country", "Rate", "In Progress", "Won", "Earned"],
    ...partners.map((partner) => {
      const partnerLeads = leads.filter((lead) => lead.partnerId === partner.id);
      const earned = commissions
        .filter((commission) => commission.partnerId === partner.id)
        .reduce((sum, commission) => sum + commission.amount, 0);
      return [
        partner.name,
        partner.status,
        partner.country,
        `${partner.commissionRate}%`,
        partnerLeads.filter(
          (lead) => !["Closed Won", "Closed Lost", "Duplicate Rejected"].includes(lead.status),
        ).length,
        partnerLeads.filter((lead) => lead.status === "Closed Won").length,
        earned,
      ];
    }),
  ];

  const pipelineRows = [
    ["Company", "Partner", "Stage", "Status", "Value", "Last Activity"],
    ...leads.map((lead) => [
      lead.company,
      partners.find((partner) => partner.id === lead.partnerId)?.name || "",
      lead.stage,
      lead.status,
      lead.estimatedValue,
      lead.lastActivity,
    ]),
  ];

  const liabilityRows = [
    ["Partner", "Payable", "Paid", "Pending Total"],
    ...partners.map((partner) => {
      const partnerCommissions = commissions.filter(
        (commission) => commission.partnerId === partner.id,
      );
      const sum = (state: string) =>
        partnerCommissions
          .filter((commission) => commission.state === state)
          .reduce((total, commission) => total + commission.amount, 0);
      return [
        partner.name,
        partnerCommissions.reduce(
          (total, commission) =>
            total + Math.max(0, (commission.eligibleAmount || 0) - (commission.paidAmount || 0)),
          0,
        ),
        partnerCommissions.reduce((total, commission) => total + (commission.paidAmount || 0), 0),
        sum("Unpaid") + sum("Approved") + sum("Payout Requested"),
      ];
    }),
  ];

  const payoutRows = [
    ["Partner", "Amount", "Status", "Requested", "Paid", "Method", "Reference"],
    ...payouts.map((payout) => [
      partners.find((partner) => partner.id === payout.partnerId)?.name || "",
      payout.amount,
      payout.status,
      payout.requestedDate,
      payout.paidDate || "",
      payout.method || "",
      payout.reference || "",
    ]),
  ];

  const revenueRows = [
    ["Reference", "Deal", "Partner", "Amount", "Date", "Method"],
    ...clientPayments.map((payment) => {
      const lead = leads.find((item) => item.id === payment.leadId);
      const partner = lead && partners.find((item) => item.id === lead.partnerId);
      return [
        payment.reference,
        lead?.company || "",
        partner?.name || "",
        payment.amount,
        payment.date,
        payment.method,
      ];
    }),
  ];

  const myLeadRows = [
    [
      "Company",
      "Stage",
      "Status",
      "Estimated Value",
      "Commission Rate",
      "Commission Amount",
      "Commission State",
      "Last Activity",
    ],
    ...leads
      .filter((lead) => lead.partnerId === partnerId)
      .map((lead) => {
        const commission = commissions.find(
          (item) => item.leadId === lead.id && item.partnerId === partnerId,
        );
        return [
          lead.company,
          lead.stage,
          lead.status,
          lead.estimatedValue,
          commission ? `${commission.rate}%` : "",
          commission?.amount || "",
          commission?.state || "",
          lead.lastActivity,
        ];
      }),
  ];

  const statementRows = [
    ["Deal", "Rate", "Amount", "State", "Closed"],
    ...commissions
      .filter((commission) => commission.partnerId === partnerId)
      .map((commission) => [
        leads.find((lead) => lead.id === commission.leadId)?.company || "Archived lead",
        `${commission.rate}%`,
        commission.amount,
        commission.state,
        commission.closedDate,
      ]),
  ];

  const adminReports = [
    {
      name: "All Partners Overview",
      desc: "Roster, status, commission rate, and performance summary.",
      rows: partnerOverviewRows,
      file: "partners-overview",
    },
    {
      name: "Full Pipeline Report",
      desc: "Every lead across every stage with valuation rollups.",
      rows: pipelineRows,
      file: "pipeline",
    },
    {
      name: "Commission Liability Report",
      desc: "Outstanding partner commission liabilities.",
      rows: liabilityRows,
      file: "commission-liability",
    },
    {
      name: "Payout History",
      desc: "Every payout request and its current state.",
      rows: payoutRows,
      file: "payout-history",
    },
    {
      name: "Client Revenue Attribution",
      desc: "Closed-won revenue attributed by partner.",
      rows: revenueRows,
      file: "client-revenue",
    },
  ];

  const partnerReports = [
    {
      name: "My Leads Report",
      desc: "Every lead you've submitted, with stage, value, and commission.",
      rows: myLeadRows,
      file: "my-leads",
    },
    {
      name: "My Commission Statement",
      desc: "Itemized commission history with deal names, rates, states, and dates.",
      rows: statementRows,
      file: "commission-statement",
    },
  ];

  const list = isPartner ? partnerReports : adminReports;
  const exportReport = (report: {
    file: string;
    rows: (string | number | boolean | null | undefined)[][];
  }) => {
    if (isPartner && report.file !== "my-leads" && report.file !== "commission-statement") {
      return;
    }
    downloadCsv(`${report.file}.csv`, report.rows);
  };
  const totals = isPartner
    ? {
        leads: leads.filter((lead) => lead.partnerId === partnerId).length,
        earned: commissions
          .filter((commission) => commission.partnerId === partnerId)
          .reduce((sum, commission) => sum + commission.amount, 0),
      }
    : {
        leads: leads.length,
        earned: commissions.reduce((sum, commission) => sum + commission.amount, 0),
      };
  const visibleLeads = isPartner ? leads.filter((lead) => lead.partnerId === partnerId) : leads;
  const won = visibleLeads.filter((lead) => lead.stage === "Closed Won").length;
  const lost = visibleLeads.filter((lead) => lead.stage === "Closed Lost").length;
  const inProgress = visibleLeads.filter(
    (lead) =>
      !["Closed Won", "Closed Lost"].includes(lead.stage) && lead.status !== "Duplicate Rejected",
  ).length;
  const pipelineValue = visibleLeads
    .filter((lead) => !["Closed Won", "Closed Lost"].includes(lead.stage))
    .reduce((sum, lead) => sum + lead.estimatedValue, 0);
  const visibleCommissions = isPartner
    ? commissions.filter((commission) => commission.partnerId === partnerId)
    : commissions;
  const commissionPaid = visibleCommissions.reduce(
    (sum, commission) => sum + (commission.paidAmount || 0),
    0,
  );
  const commissionPending = visibleCommissions.reduce(
    (sum, commission) =>
      sum + Math.max(0, (commission.eligibleAmount || 0) - (commission.paidAmount || 0)),
    0,
  );
  const clientReceived = isPartner
    ? 0
    : clientPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = isPartner
    ? 0
    : leads.reduce((sum, lead) => {
        const received = clientPayments
          .filter((payment) => payment.leadId === lead.id)
          .reduce((total, payment) => total + payment.amount, 0);
        return sum + Math.max(0, (lead.confirmedValue || lead.estimatedValue) - received);
      }, 0);
  const averageDays = (values: number[]) =>
    values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  const dayMs = 24 * 60 * 60 * 1000;
  const averageServiceDays = averageDays(
    visibleLeads
      .filter((lead) => lead.stage === "Closed Won")
      .map((lead) =>
        Math.max(
          0,
          (new Date(lead.lastActivity).getTime() - new Date(lead.createdAt).getTime()) / dayMs,
        ),
      ),
  );
  const averageStageDays = averageDays(
    visibleLeads
      .filter((lead) => !["Closed Won", "Closed Lost"].includes(lead.stage))
      .map((lead) => Math.max(0, (Date.now() - new Date(lead.lastActivity).getTime()) / dayMs)),
  );
  const topPartner = partners
    .map((partner) => ({
      name: partner.name,
      won: leads.filter((lead) => lead.partnerId === partner.id && lead.stage === "Closed Won")
        .length,
    }))
    .sort((a, b) => b.won - a.won || a.name.localeCompare(b.name))[0];

  return (
    <>
      <PageHeader
        title={isPartner ? "My Reports" : "Reports"}
        description={
          isPartner
            ? "Your live performance and commission KPIs."
            : "Operational KPIs and role-safe exports."
        }
      />
      <PageContainer>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Won leads</div>
            <div className="mt-1 text-2xl font-semibold">{won}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Lost leads</div>
            <div className="mt-1 text-2xl font-semibold">{lost}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase text-muted-foreground">In progress</div>
            <div className="mt-1 text-2xl font-semibold">{inProgress}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Conversion rate</div>
            <div className="mt-1 text-2xl font-semibold">
              {won + lost ? Math.round((won / (won + lost)) * 100) : 0}%
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Pipeline value</div>
            <div className="mt-1 text-2xl font-semibold">{fmtCurrency(pipelineValue)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Commission paid</div>
            <div className="mt-1 text-2xl font-semibold">{fmtCurrency(commissionPaid)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Pending commission</div>
            <div className="mt-1 text-2xl font-semibold">{fmtCurrency(commissionPending)}</div>
          </Card>
          {!isPartner && (
            <Card className="p-4">
              <div className="text-xs uppercase text-muted-foreground">
                Client payments received
              </div>
              <div className="mt-1 text-2xl font-semibold">{fmtCurrency(clientReceived)}</div>
            </Card>
          )}
          {!isPartner && (
            <Card className="p-4">
              <div className="text-xs uppercase text-muted-foreground">Outstanding balances</div>
              <div className="mt-1 text-2xl font-semibold">{fmtCurrency(outstanding)}</div>
            </Card>
          )}
          <Card className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Average service duration</div>
            <div className="mt-1 text-2xl font-semibold">{averageServiceDays} days</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase text-muted-foreground">Average stage age</div>
            <div className="mt-1 text-2xl font-semibold">{averageStageDays} days</div>
          </Card>
          {!isPartner && (
            <Card className="p-4">
              <div className="text-xs uppercase text-muted-foreground">Top partner by wins</div>
              <div className="mt-1 text-lg font-semibold">{topPartner?.name || "-"}</div>
              <div className="text-xs text-muted-foreground">{topPartner?.won || 0} won leads</div>
            </Card>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <div className="text-xs uppercase text-muted-foreground">Total leads</div>
            <div className="mt-1 text-2xl font-semibold">{totals.leads}</div>
          </Card>
          <Card className="p-5">
            <div className="text-xs uppercase text-muted-foreground">Commissions to date</div>
            <div className="mt-1 text-2xl font-semibold">{fmtCurrency(totals.earned)}</div>
          </Card>
          {!isPartner && (
            <Card className="p-5">
              <div className="text-xs uppercase text-muted-foreground">Active partners</div>
              <div className="mt-1 text-2xl font-semibold">
                {partners.filter((partner) => partner.status === "Active").length}
              </div>
            </Card>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {list.map((report) => (
            <Card key={report.name} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{report.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{report.desc}</p>
                </div>
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              {!isPartner && (
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => exportReport(report)}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    CSV
                  </Button>
                  <Button size="sm" variant="outline" disabled>
                    PDF coming soon
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </PageContainer>
    </>
  );
}

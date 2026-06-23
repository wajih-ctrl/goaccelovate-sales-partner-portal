import { createFileRoute } from "@tanstack/react-router";
import { Download, FileSpreadsheet, FileText } from "lucide-react";

import { PageContainer, PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { downloadCsv, downloadSimplePdf } from "@/lib/exports";
import { fmtCurrency } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/_app/reports")({ component: Reports });

function Reports() {
  const { user } = useAuth();
  const { partners, leads, commissions, payouts, clientPayments } = useStore();
  const isPartner = user?.role === "partner";
  const partnerId = user?.partnerId;

  const partnerOverviewRows = [
    ["Name", "Tier", "Status", "Country", "Rate", "Active Leads", "Won", "Earned"],
    ...partners.map((partner) => {
      const partnerLeads = leads.filter((lead) => lead.partnerId === partner.id);
      const earned = commissions
        .filter((commission) => commission.partnerId === partner.id)
        .reduce((sum, commission) => sum + commission.amount, 0);
      return [
        partner.name,
        partner.tier,
        partner.status,
        partner.country,
        `${partner.commissionRate}%`,
        partnerLeads.filter((lead) => lead.status === "Active").length,
        partnerLeads.filter((lead) => lead.status === "Closed Won").length,
        earned,
      ];
    }),
  ];

  const pipelineRows = [
    ["ID", "Company", "Partner", "Stage", "Status", "Value", "Last Activity"],
    ...leads.map((lead) => [
      lead.id,
      lead.company,
      partners.find((partner) => partner.id === lead.partnerId)?.name || "",
      lead.stage,
      lead.status,
      lead.estimatedValue,
      lead.lastActivity,
    ]),
  ];

  const liabilityRows = [
    ["Partner", "Unpaid", "Approved", "Requested", "Disputed", "Total Owed"],
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
        sum("Unpaid"),
        sum("Approved"),
        sum("Payout Requested"),
        sum("Disputed"),
        sum("Unpaid") + sum("Approved") + sum("Payout Requested") + sum("Disputed"),
      ];
    }),
  ];

  const payoutRows = [
    ["ID", "Partner", "Amount", "Status", "Requested", "Paid", "Method", "Reference"],
    ...payouts.map((payout) => [
      payout.id,
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
      "ID",
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
          lead.id,
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
        leads.find((lead) => lead.id === commission.leadId)?.company || commission.leadId,
        `${commission.rate}%`,
        commission.amount,
        commission.state,
        commission.closedDate,
      ]),
  ];

  const adminReports = [
    {
      name: "All Partners Overview",
      desc: "Roster, tiers, status, performance summary.",
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

  return (
    <>
      <PageHeader
        title={isPartner ? "My Reports" : "Reports"}
        description="Generate and export performance reports."
      />
      <PageContainer>
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
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadCsv(`${report.file}.csv`, report.rows)}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadSimplePdf(`${report.file}.pdf`, report.name, report.rows)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  PDF
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </PageContainer>
    </>
  );
}

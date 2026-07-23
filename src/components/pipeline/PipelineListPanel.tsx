import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";

import { FormDialog, ReasonDialog } from "@/components/common/dialogs";
import { StatusBadge } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { daysSince, fmtCurrency, type LeadStage } from "@/lib/domain";
import { allowedLeadStageTargets, canMoveLeadStage, LEAD_STAGES } from "@/lib/program";
import { useStore } from "@/lib/store";

const STAGES: (LeadStage | "All")[] = ["All", ...LEAD_STAGES];

export function PipelineListPanel() {
  const { user } = useAuth();
  const { leads, partners, updateLeadStage, closeLeadWon } = useStore();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("All");
  const [partner, setPartner] = useState("All");
  const [region, setRegion] = useState("All");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [closeLeadId, setCloseLeadId] = useState<string | null>(null);
  const [closeLostLeadId, setCloseLostLeadId] = useState<string | null>(null);
  const [confirmedValue, setConfirmedValue] = useState("");
  const isPartner = user?.role === "partner";

  const regions = useMemo(
    () => ["All", ...Array.from(new Set(leads.map((lead) => lead.country))).sort()],
    [leads],
  );
  const list = useMemo(() => {
    let result = leads.filter((lead) => lead.status !== "Duplicate Rejected");
    if (q) result = result.filter((lead) => lead.company.toLowerCase().includes(q.toLowerCase()));
    if (stage !== "All") result = result.filter((lead) => lead.stage === stage);
    if (partner !== "All") result = result.filter((lead) => lead.partnerId === partner);
    if (region !== "All") result = result.filter((lead) => lead.country === region);
    if (minValue) result = result.filter((lead) => lead.estimatedValue >= Number(minValue));
    if (maxValue) result = result.filter((lead) => lead.estimatedValue <= Number(maxValue));
    if (dateFrom) result = result.filter((lead) => lead.createdAt.slice(0, 10) >= dateFrom);
    if (dateTo) result = result.filter((lead) => lead.createdAt.slice(0, 10) <= dateTo);
    return [...result].sort((a, b) =>
      sortDesc ? b.estimatedValue - a.estimatedValue : a.estimatedValue - b.estimatedValue,
    );
  }, [dateFrom, dateTo, leads, maxValue, minValue, partner, q, region, sortDesc, stage]);

  const reset = () => {
    setQ("");
    setStage("All");
    setPartner("All");
    setRegion("All");
    setMinValue("");
    setMaxValue("");
    setDateFrom("");
    setDateTo("");
  };

  const exportCsv = () => {
    const rows = [["Company", "Partner", "Region", "Stage", "Status", "Value"]];
    list.forEach((lead) => {
      const owner = partners.find((item) => item.id === lead.partnerId);
      rows.push([
        lead.company,
        owner?.name || "",
        lead.country,
        lead.stage,
        lead.status,
        String(lead.estimatedValue),
      ]);
    });
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    anchor.download = "pipeline.csv";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    toast.success(`Exported ${list.length} pipeline records.`);
  };

  const changeStage = (leadId: string, target: LeadStage) => {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || lead.stage === target || !user) return;
    if (
      !canMoveLeadStage(user.role, lead.stage, target, lead.previousStage, lead.stageAdminLocked)
    ) {
      toast.error("You do not have permission to move this lead to that stage.");
      return;
    }
    if (target === "Closed Won" && !lead.confirmedValue) {
      setCloseLeadId(leadId);
      setConfirmedValue(String(lead.estimatedValue));
      return;
    }
    if (target === "Closed Lost") {
      setCloseLostLeadId(leadId);
      return;
    }
    updateLeadStage(leadId, target, user.name);
    toast.success(`${lead.company} moved to ${target}.`);
  };

  return (
    <>
      <Card className="overflow-hidden shadow-card">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search company..."
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            className="h-9 max-w-full rounded-md border bg-background px-3 text-sm"
          >
            {STAGES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          {!isPartner && (
            <select
              value={partner}
              onChange={(event) => setPartner(event.target.value)}
              className="h-9 max-w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="All">All partners</option>
              {partners
                .filter((item) => item.status !== "Deactivated")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          )}
          <select
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            className="h-9 max-w-full rounded-md border bg-background px-3 text-sm"
          >
            {regions.map((item) => (
              <option key={item}>{item === "All" ? "All regions" : item}</option>
            ))}
          </select>
          <input
            type="number"
            value={minValue}
            onChange={(event) => setMinValue(event.target.value)}
            placeholder="Min value"
            className="h-9 w-28 rounded-md border bg-background px-3 text-sm"
          />
          <select
            value={sortDesc ? "descending" : "ascending"}
            onChange={(event) => setSortDesc(event.target.value === "descending")}
            className="h-9 rounded-md border bg-background px-3 text-sm"
            aria-label="Sort by deal value"
          >
            <option value="ascending">Value: Ascending</option>
            <option value="descending">Value: Descending</option>
          </select>
          <input
            type="number"
            value={maxValue}
            onChange={(event) => setMaxValue(event.target.value)}
            placeholder="Max value"
            className="h-9 w-28 rounded-md border bg-background px-3 text-sm"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="h-9 max-w-full rounded-md border bg-background px-3 text-sm"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="h-9 max-w-full rounded-md border bg-background px-3 text-sm"
          />
          <Button variant="ghost" size="sm" onClick={reset}>
            Reset
          </Button>
          {!isPartner && (
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          )}
        </div>
        <div className="responsive-table-scroll">
          <table className="min-w-[1080px] w-full whitespace-nowrap text-sm">
            <thead className="bg-accent/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Partner</th>
                <th className="px-4 py-3 text-left">Region</th>
                <th className="px-4 py-3 text-left">Stage</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-left">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {list.map((lead) => {
                const owner = partners.find((item) => item.id === lead.partnerId);
                return (
                  <tr key={lead.id} className="border-t hover:bg-accent/20">
                    <td className="px-4 py-3">
                      <Link
                        to="/leads/$id"
                        params={{ id: lead.id }}
                        className="font-medium hover:underline"
                      >
                        {lead.company}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{owner?.name || "Archived partner"}</td>
                    <td className="px-4 py-3">{lead.country}</td>
                    <td className="px-4 py-3">
                      <select
                        value={lead.stage}
                        onChange={(event) => changeStage(lead.id, event.target.value as LeadStage)}
                        className="h-8 max-w-56 rounded-md border bg-background px-2 text-xs"
                      >
                        {(user
                          ? allowedLeadStageTargets(
                              user.role,
                              lead.stage,
                              lead.previousStage,
                              lead.stageAdminLocked,
                            )
                          : [lead.stage]
                        ).map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {fmtCurrency(lead.estimatedValue)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {daysSince(lead.lastActivity)}d
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted-foreground">
                    No leads match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <FormDialog
        open={!!closeLeadId}
        onOpenChange={(open) => !open && setCloseLeadId(null)}
        title="Confirm Closed Won value"
        submitLabel="Close deal"
        canSubmit={Number(confirmedValue) > 0}
        onSubmit={() => {
          if (!closeLeadId || !user) return;
          closeLeadWon(closeLeadId, Number(confirmedValue), user.name);
          toast.success("Deal closed won and commission calculated.");
          setCloseLeadId(null);
          setConfirmedValue("");
        }}
      >
        <label className="text-xs">
          Confirmed deal value
          <input
            type="number"
            value={confirmedValue}
            onChange={(event) => setConfirmedValue(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            placeholder="e.g. 25000"
          />
        </label>
      </FormDialog>

      <ReasonDialog
        open={!!closeLostLeadId}
        onOpenChange={(open) => !open && setCloseLostLeadId(null)}
        title="Move to Closed Lost"
        description="Provide the reason for marking this opportunity Closed Lost."
        confirmLabel="Move lead"
        onConfirm={(reason) => {
          if (!closeLostLeadId || !user) return false;
          const lead = leads.find((item) => item.id === closeLostLeadId);
          updateLeadStage(closeLostLeadId, "Closed Lost", user.name, reason);
          toast.warning(`${lead?.company || "Lead"} moved to Closed Lost.`);
          setCloseLostLeadId(null);
          return true;
        }}
      />
    </>
  );
}

import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { PageHeader, PageContainer, StatusBadge } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { fmtCurrency, daysSince, type LeadStage } from "@/lib/mock-data";
import { useState, useMemo } from "react";
import { Search, Download } from "lucide-react";
import { toast } from "sonner";
import { FormDialog, ReasonDialog } from "@/components/common/dialogs";

export const Route = createFileRoute("/_app/pipeline-list")({ component: PipelineList });

const STAGES: (LeadStage | "All")[] = [
  "All",
  "New Lead",
  "In Conversation",
  "Discovery Call",
  "Proposal Sent",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
];

function PipelineList() {
  const { user } = useAuth();
  const { leads, partners, updateLeadStage, closeLeadWon } = useStore();

  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string>("All");
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
  const regions = useMemo(
    () => ["All", ...Array.from(new Set(leads.map((l) => l.country))).sort()],
    [leads],
  );

  const list = useMemo(() => {
    let l = [...leads];
    if (q) l = l.filter((x) => x.company.toLowerCase().includes(q.toLowerCase()));
    if (stage !== "All") l = l.filter((x) => x.stage === stage);
    if (partner !== "All") l = l.filter((x) => x.partnerId === partner);
    if (region !== "All") l = l.filter((x) => x.country === region);
    if (minValue) l = l.filter((x) => x.estimatedValue >= Number(minValue));
    if (maxValue) l = l.filter((x) => x.estimatedValue <= Number(maxValue));
    if (dateFrom)
      l = l.filter((x) => new Date(x.createdAt).getTime() >= new Date(dateFrom).getTime());
    if (dateTo)
      l = l.filter(
        (x) => new Date(x.createdAt).getTime() <= new Date(dateTo + "T23:59:59").getTime(),
      );
    l.sort((a, b) =>
      sortDesc ? b.estimatedValue - a.estimatedValue : a.estimatedValue - b.estimatedValue,
    );
    return l;
  }, [leads, q, stage, partner, region, minValue, maxValue, dateFrom, dateTo, sortDesc]);

  if (user?.role === "partner") return <Navigate to="/access-denied" replace />;

  const exportCsv = () => {
    const rows = [["ID", "Company", "Partner", "Stage", "Status", "Value"]];
    list.forEach((l) => {
      const p = partners.find((pp) => pp.id === l.partnerId);
      rows.push([l.id, l.company, p?.name || "", l.stage, l.status, String(l.estimatedValue)]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pipeline.csv";
    a.click();
    toast.success(`Exported ${list.length} rows`);
  };

  const changeStage = (leadId: string, target: LeadStage) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === target) return;
    if (target === "Closed Won" && !lead.confirmedValue) {
      setCloseLeadId(leadId);
      setConfirmedValue(String(lead.estimatedValue));
      return;
    }
    if (target === "Closed Lost") {
      setCloseLostLeadId(leadId);
      return;
    }
    updateLeadStage(leadId, target, user!.name);
  };

  return (
    <>
      <PageHeader
        title="Pipeline · List View"
        description="Sortable, filterable view across the full pipeline. Change stages inline."
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        }
      />
      <PageContainer>
        <Card className="shadow-card">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search company…"
                className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
              />
            </div>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              {STAGES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              value={partner}
              onChange={(e) => setPartner(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="All">All partners</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              {regions.map((r) => (
                <option key={r}>{r === "All" ? "All regions" : r}</option>
              ))}
            </select>
            <input
              type="number"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
              placeholder="Min value"
              className="h-9 w-28 rounded-md border bg-background px-3 text-sm"
            />
            <input
              type="number"
              value={maxValue}
              onChange={(e) => setMaxValue(e.target.value)}
              placeholder="Max value"
              className="h-9 w-28 rounded-md border bg-background px-3 text-sm"
            />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                setStage("All");
                setPartner("All");
                setRegion("All");
                setMinValue("");
                setMaxValue("");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Reset
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-accent/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Company</th>
                  <th className="px-4 py-3 text-left">Partner</th>
                  <th className="px-4 py-3 text-left">Region</th>
                  <th className="px-4 py-3 text-left">Stage</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th
                    className="px-4 py-3 text-right cursor-pointer"
                    onClick={() => setSortDesc(!sortDesc)}
                  >
                    Value {sortDesc ? "↓" : "↑"}
                  </th>
                  <th className="px-4 py-3 text-left">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {list.map((l) => {
                  const p = partners.find((pp) => pp.id === l.partnerId);
                  return (
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
                      <td className="px-4 py-3">{p?.name}</td>
                      <td className="px-4 py-3">{l.country}</td>
                      <td className="px-4 py-3">
                        <select
                          value={l.stage}
                          onChange={(e) => changeStage(l.id, e.target.value as LeadStage)}
                          className="h-8 rounded-md border bg-background px-2 text-xs"
                        >
                          {STAGES.filter((s) => s !== "All").map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={l.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {fmtCurrency(l.estimatedValue)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {daysSince(l.lastActivity)}d
                      </td>
                    </tr>
                  );
                })}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-muted-foreground">
                      No leads.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </PageContainer>

      <FormDialog
        open={!!closeLeadId}
        onOpenChange={(open) => {
          if (!open) setCloseLeadId(null);
        }}
        title="Confirm Closed Won value"
        submitLabel="Close deal"
        canSubmit={Number(confirmedValue) > 0}
        onSubmit={() => {
          closeLeadWon(closeLeadId!, Number(confirmedValue), user!.name);
          toast.success("Deal closed won and commission calculated");
          setCloseLeadId(null);
          setConfirmedValue("");
        }}
      >
        <label className="text-xs">
          Confirmed deal value
          <input
            type="number"
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={confirmedValue}
            onChange={(e) => setConfirmedValue(e.target.value)}
          />
        </label>
      </FormDialog>

      <ReasonDialog
        open={!!closeLostLeadId}
        onOpenChange={(open) => {
          if (!open) setCloseLostLeadId(null);
        }}
        title="Move to Closed Lost"
        description="Provide the reason for marking this opportunity Closed Lost."
        confirmLabel="Move lead"
        onConfirm={(reason) => {
          const lead = leads.find((l) => l.id === closeLostLeadId);
          updateLeadStage(closeLostLeadId!, "Closed Lost", user!.name, reason);
          toast.warning(`${lead?.company || "Lead"} moved to Closed Lost`);
          setCloseLostLeadId(null);
        }}
      />
    </>
  );
}

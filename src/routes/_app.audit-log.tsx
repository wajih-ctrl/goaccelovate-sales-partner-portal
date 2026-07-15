import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PageHeader, PageContainer } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { Download, Eye, Search } from "lucide-react";
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AuditEntry } from "@/lib/domain";

export const Route = createFileRoute("/_app/audit-log")({ component: AuditLog });

function AuditLog() {
  const { user } = useAuth();
  const { audit } = useStore();
  const [moduleF, setModule] = useState("All");
  const [q, setQ] = useState("");
  const [userF, setUserF] = useState("All");
  const [actionF, setActionF] = useState("All");
  const [dateF, setDateF] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const sourceAudit = audit;
  const modules = ["All", ...Array.from(new Set(sourceAudit.map((a) => a.module)))];
  const users = ["All", ...Array.from(new Set(sourceAudit.map((a) => a.user)))];
  const actions = ["All", ...Array.from(new Set(sourceAudit.map((a) => a.action)))];

  const list = useMemo(() => {
    let l = sourceAudit;
    if (moduleF !== "All") l = l.filter((a) => a.module === moduleF);
    if (userF !== "All") l = l.filter((a) => a.user === userF);
    if (actionF !== "All") l = l.filter((a) => a.action === actionF);
    if (dateF) l = l.filter((a) => a.date.slice(0, 10) === dateF);
    if (q)
      l = l.filter((a) =>
        `${a.details} ${a.action} ${a.changes.join(" ")}`.toLowerCase().includes(q.toLowerCase()),
      );
    return l;
  }, [sourceAudit, moduleF, userF, actionF, dateF, q]);

  const exportCsv = () => {
    const rows = [["When", "User", "Module", "Action", "Record", "Changes"]];
    list.forEach((a) =>
      rows.push([a.date, a.user, a.module, a.action, a.details, a.changes.join(" ")]),
    );
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "audit-log.csv";
    a.click();
    toast.success(`Exported ${list.length} entries`);
  };

  if (user?.role !== "super_admin") return <Navigate to="/access-denied" />;

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Immutable record of every consequential action across the portal."
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        }
      />
      <PageContainer>
        <Card className="shadow-card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search actions, records, or changes..."
                className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
              />
            </div>
            <select
              value={moduleF}
              onChange={(e) => setModule(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              {modules.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <select
              value={userF}
              onChange={(e) => setUserF(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              {users.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
            <select
              value={actionF}
              onChange={(e) => setActionF(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              {actions.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
            <input
              type="date"
              value={dateF}
              onChange={(e) => setDateF(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                setModule("All");
                setUserF("All");
                setActionF("All");
                setDateF("");
              }}
            >
              Reset
            </Button>
            <span className="text-xs text-muted-foreground">
              Append-only | {list.length} entries
            </span>
          </div>
          <div className="responsive-table-scroll">
            <table className="min-w-[980px] w-full whitespace-nowrap text-sm">
              <thead className="bg-accent/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">When</th>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Module</th>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left">Record</th>
                  <th className="px-4 py-3 text-left">What happened</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {new Date(a.date).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{a.user}</td>
                    <td className="px-4 py-3">{a.module}</td>
                    <td className="px-4 py-3 font-medium">{a.action}</td>
                    <td className="max-w-80 whitespace-normal px-4 py-3 text-muted-foreground">
                      {a.details}
                    </td>
                    <td className="max-w-96 whitespace-normal px-4 py-3 text-xs">
                      {a.changes.length
                        ? a.changes.slice(0, 2).join(" ")
                        : "No field changes recorded."}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedEntry(a)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-muted-foreground">
                      No entries match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </PageContainer>
      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedEntry?.action}</DialogTitle>
            <DialogDescription>
              {selectedEntry && new Date(selectedEntry.date).toLocaleString()} by{" "}
              {selectedEntry?.user}
            </DialogDescription>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 rounded-md border bg-accent/20 p-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Module
                  </div>
                  <div className="mt-1 font-medium">{selectedEntry.module}</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Action
                  </div>
                  <div className="mt-1 font-medium">{selectedEntry.action}</div>
                </div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Record
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
                  {selectedEntry.details}
                </p>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  What happened
                </div>
                <div className="mt-2 rounded-md border bg-accent/10 p-3">
                  {selectedEntry.changes.length ? (
                    <ul className="space-y-2">
                      {selectedEntry.changes.map((change) => (
                        <li key={change} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                          <span className="break-words">{change}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">
                      No field-level changes were recorded for this event.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

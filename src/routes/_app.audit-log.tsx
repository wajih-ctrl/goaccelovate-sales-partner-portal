import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PageHeader, PageContainer } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { Download, Search } from "lucide-react";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/_app/audit-log")({ component: AuditLog });

function AuditLog() {
  const { user } = useAuth();
  const { audit } = useStore();
  const [moduleF, setModule] = useState("All");
  const [q, setQ] = useState("");
  const [userF, setUserF] = useState("All");
  const [actionF, setActionF] = useState("All");
  const [dateF, setDateF] = useState("");
  const modules = ["All", ...Array.from(new Set(audit.map((a) => a.module)))];
  const users = ["All", ...Array.from(new Set(audit.map((a) => a.user)))];
  const actions = ["All", ...Array.from(new Set(audit.map((a) => a.action)))];

  const list = useMemo(() => {
    let l = audit;
    if (moduleF !== "All") l = l.filter((a) => a.module === moduleF);
    if (userF !== "All") l = l.filter((a) => a.user === userF);
    if (actionF !== "All") l = l.filter((a) => a.action === actionF);
    if (dateF) l = l.filter((a) => a.date.slice(0, 10) === dateF);
    if (q)
      l = l.filter((a) => (a.details + " " + a.action).toLowerCase().includes(q.toLowerCase()));
    return l;
  }, [audit, moduleF, userF, actionF, dateF, q]);

  const exportCsv = () => {
    const rows = [["When", "User", "Module", "Action", "Details", "Old", "New"]];
    list.forEach((a) =>
      rows.push([
        a.date,
        a.user,
        a.module,
        a.action,
        a.details,
        a.oldValue || "",
        a.newValue || "",
      ]),
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
                placeholder="Search action or details…"
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
              Append-only · {list.length} entries
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
                  <th className="px-4 py-3 text-left">Details</th>
                  <th className="px-4 py-3 text-left">Change</th>
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
                    <td className="px-4 py-3 text-muted-foreground">{a.details}</td>
                    <td className="px-4 py-3 text-xs">
                      {a.oldValue ? (
                        <span className="text-muted-foreground">
                          {a.oldValue} → <span className="text-foreground">{a.newValue}</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      No entries match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </PageContainer>
    </>
  );
}

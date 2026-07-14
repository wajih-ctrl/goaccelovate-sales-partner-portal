import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PageHeader, PageContainer, StatusBadge } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { toast } from "sonner";
import { UserPlus, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { FormDialog, ReasonDialog } from "@/components/common/dialogs";
import { revokeRealInvitation, sendRealInvitation } from "@/lib/real-invitations";
import { deleteRealUser } from "@/lib/real-users";

export const Route = createFileRoute("/_app/users")({ component: UsersPage });

type InviteRole = "partner" | "admin";
function UsersPage() {
  const { user } = useAuth();
  const {
    partners,
    staffUsers,
    invites,
    settings,
    inviteUser,
    revokeInvitation,
    suspendUser,
    reactivateUser,
    deleteUser,
    changeUserRole,
    changePartnerRate,
  } = useStore();

  const [showInvite, setShowInvite] = useState(false);
  const [invite, setInvite] = useState({
    name: "",
    email: "",
    role: "partner" as InviteRole,
    commissionRate: "10",
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [rateTarget, setRateTarget] = useState<{ id: string; rate: string } | null>(null);
  const [roleTarget, setRoleTarget] = useState<{ id: string; role: InviteRole } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    kind: "staff" | "partner";
    name: string;
  } | null>(null);

  if (!user || !["admin", "super_admin"].includes(user.role))
    return <Navigate to="/access-denied" />;
  const isSuperAdmin = user.role === "super_admin";
  const visibleInvites = isSuperAdmin ? invites : invites.filter((item) => item.role === "partner");

  return (
    <>
      <PageHeader
        title="User Management"
        description={
          isSuperAdmin
            ? "Invite users and manage portal accounts."
            : "Invite and view Sales Partners."
        }
        actions={
          <Button onClick={() => setShowInvite(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite user
          </Button>
        }
      />
      <PageContainer>
        {visibleInvites.length > 0 && (
          <Card className="overflow-hidden">
            <div className="border-b bg-accent/40 px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Pending invitations ({visibleInvites.length})
            </div>
            <div className="responsive-table-scroll">
              <table className="min-w-[760px] w-full text-sm whitespace-nowrap">
                <tbody>
                  {visibleInvites.map((i) => (
                    <tr key={i.id} className="border-t">
                      <td className="px-4 py-3 font-medium">{i.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{i.email}</td>
                      <td className="px-4 py-3 capitalize">
                        {i.role}
                        {i.commissionRate ? ` · ${i.commissionRate}% commission` : ""}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        Sent {new Date(i.invitedDate).toLocaleDateString()} · expires in{" "}
                        {settings.invitationExpiry}h
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        {isSuperAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={revokingInviteId === i.id}
                            onClick={async () => {
                              setRevokingInviteId(i.id);
                              const result = await revokeRealInvitation(i.id);
                              setRevokingInviteId(null);

                              if (result.error) {
                                toast.error(result.error);
                                return;
                              }

                              revokeInvitation(i.id, user.name);
                              toast.warning("Invitation revoked");
                            }}
                          >
                            {revokingInviteId === i.id ? "Revoking..." : "Revoke"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Card className="shadow-card overflow-hidden">
          <div className="border-b bg-accent/40 px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Active accounts
          </div>
          <div className="responsive-table-scroll">
            <table className="min-w-[860px] w-full text-sm whitespace-nowrap">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-right">Rate</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {isSuperAdmin &&
                  staffUsers
                    .filter((u) => u.role !== "partner")
                    .map((u) => (
                      <tr key={u.id} className="border-t hover:bg-accent/20">
                        <td className="px-4 py-3 font-medium">{u.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                        <td className="px-4 py-3 capitalize">{u.role.replace("_", " ")}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            status={
                              u.accountStatus === "suspended"
                                ? "Suspended"
                                : u.accountStatus === "pending"
                                  ? "Pending"
                                  : "Active"
                            }
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isSuperAdmin && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    setRoleTarget({
                                      id: u.id,
                                      role: u.role === "admin" ? "partner" : "admin",
                                    })
                                  }
                                >
                                  Change role
                                </DropdownMenuItem>
                                {u.accountStatus === "suspended" ? (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      reactivateUser(u.id, user.name);
                                      toast.success(`${u.name} reactivated`);
                                    }}
                                  >
                                    Reinstate
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      suspendUser(u.id, user.name);
                                      toast.warning(`${u.name} suspended`);
                                    }}
                                  >
                                    Suspend
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="text-destructive"
                                  disabled={u.id === user.id}
                                  onClick={() =>
                                    setDeleteTarget({ id: u.id, kind: "staff", name: u.name })
                                  }
                                >
                                  Delete account
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    ))}
                {partners
                  .filter((partner) => partner.status !== "Deactivated")
                  .map((p) => (
                    <tr key={p.id} className="border-t hover:bg-accent/20">
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.email}</td>
                      <td className="px-4 py-3">Sales Partner</td>
                      <td className="px-4 py-3 text-right">{p.commissionRate}%</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isSuperAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  setRateTarget({ id: p.id, rate: String(p.commissionRate) })
                                }
                              >
                                Set commission rate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {p.status === "Active" ? (
                                <DropdownMenuItem
                                  onClick={() => {
                                    suspendUser(p.id, user.name);
                                    toast.warning(`${p.name} suspended`);
                                  }}
                                >
                                  Suspend
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => {
                                    reactivateUser(p.id, user.name);
                                    toast.success(`${p.name} reactivated`);
                                  }}
                                >
                                  Reactivate
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() =>
                                  setDeleteTarget({ id: p.id, kind: "partner", name: p.name })
                                }
                              >
                                Delete account
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      </PageContainer>

      <FormDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        title="Invite new user"
        canSubmit={
          !!invite.name.trim() &&
          !!invite.email.trim() &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email) &&
          (invite.role !== "partner" ||
            (Number(invite.commissionRate) > 0 && Number(invite.commissionRate) <= 100))
        }
        submitLabel={inviteLoading ? "Sending..." : "Send invitation"}
        onSubmit={async () => {
          setInviteLoading(true);
          const payload = {
            name: invite.name.trim(),
            email: invite.email.trim(),
            role: invite.role,
            commissionRate: invite.role === "partner" ? Number(invite.commissionRate) : undefined,
          };
          const result = await sendRealInvitation(payload);
          setInviteLoading(false);

          if (result.error) {
            toast.error(result.error);
            return;
          }

          inviteUser(
            {
              ...payload,
              id: result.invitationId,
              invitedDate: result.createdAt,
            },
            user.name,
          );
          toast.success(`Invitation sent to ${invite.email}`);
          setShowInvite(false);
          setInvite({ name: "", email: "", role: "partner", commissionRate: "10" });
        }}
      >
        <label className="text-xs">
          Full name
          <input
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={invite.name}
            onChange={(e) => setInvite({ ...invite, name: e.target.value })}
          />
        </label>
        <label className="text-xs">
          Email
          <input
            type="email"
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={invite.email}
            onChange={(e) => setInvite({ ...invite, email: e.target.value })}
          />
        </label>
        <label className="text-xs">
          Role
          <select
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={invite.role}
            onChange={(e) => setInvite({ ...invite, role: e.target.value as InviteRole })}
          >
            <option value="partner">Sales Partner</option>
            {isSuperAdmin && <option value="admin">Admin</option>}
          </select>
        </label>
        {invite.role === "partner" && (
          <label className="text-xs">
            Commission percentage
            <input
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={invite.commissionRate}
              onChange={(e) => setInvite({ ...invite, commissionRate: e.target.value })}
            />
          </label>
        )}
      </FormDialog>

      <FormDialog
        open={!!roleTarget}
        onOpenChange={(b) => !b && setRoleTarget(null)}
        title="Change user role"
        submitLabel="Save role"
        canSubmit={!!roleTarget}
        onSubmit={() => {
          changeUserRole(roleTarget!.id, roleTarget!.role, user.name);
          toast.success(`Role updated to ${roleTarget!.role}`);
          setRoleTarget(null);
        }}
      >
        {roleTarget && (
          <label className="text-xs">
            Role
            <select
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={roleTarget.role}
              onChange={(e) => setRoleTarget({ ...roleTarget, role: e.target.value as InviteRole })}
            >
              <option value="admin">Admin</option>
              <option value="partner">Sales Partner</option>
            </select>
          </label>
        )}
      </FormDialog>

      <FormDialog
        open={!!rateTarget}
        onOpenChange={(b) => !b && setRateTarget(null)}
        title="Set commission rate"
        submitLabel="Save"
        canSubmit={!!rateTarget && !isNaN(Number(rateTarget.rate))}
        onSubmit={() => {
          changePartnerRate(rateTarget!.id, Number(rateTarget!.rate), user.name);
          toast.success(`Commission rate updated to ${rateTarget!.rate}%`);
          setRateTarget(null);
        }}
      >
        {rateTarget && (
          <label className="text-xs">
            Commission rate (%)
            <input
              type="number"
              step="0.5"
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={rateTarget.rate}
              onChange={(e) => setRateTarget({ ...rateTarget, rate: e.target.value })}
            />
          </label>
        )}
      </FormDialog>

      <ReasonDialog
        open={!!deleteTarget}
        onOpenChange={(b) => !b && setDeleteTarget(null)}
        title="Delete account"
        description={`Permanently remove ${deleteTarget?.name || "this user"}'s login access. Historical lead and financial records will remain archived for audit integrity.`}
        confirmLabel="Delete account"
        onConfirm={async (reason) => {
          if (!deleteTarget) return false;
          const result = await deleteRealUser({
            id: deleteTarget.id,
            kind: deleteTarget.kind,
            reason,
          });
          if (result.error) {
            toast.error(result.error);
            return false;
          }
          deleteUser(deleteTarget.id, user.name);
          if (result.warning) toast.warning(result.warning);
          else toast.success(`${deleteTarget.name}'s account was deleted.`);
          setDeleteTarget(null);
          return true;
        }}
      />
    </>
  );
}

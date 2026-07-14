import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

type DeletePayload = {
  id?: string;
  kind?: "staff" | "partner";
  reason?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function decodeIssuer(jwt: string) {
  try {
    const encoded = jwt.split(".")[1];
    if (!encoded) return "";
    const padded = encoded.padEnd(encoded.length + ((4 - (encoded.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded.replace(/-/g, "+").replace(/_/g, "/"))) as {
      iss?: string;
    };
    return (payload.iss || "").replace(/\/auth\/v1\/?$/, "");
  } catch {
    return "";
  }
}

async function authenticatedService(jwt: string) {
  const url = decodeIssuer(jwt) || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { error: "User management is not configured.", status: 500 };

  const service = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await service.auth.getUser(jwt);
  if (error || !data.user) return { error: "Invalid session. Sign in again.", status: 401 };
  return { service, authUser: data.user };
}

export const Route = createFileRoute("/api/users")({
  server: {
    handlers: {
      DELETE: async ({ request }) => {
        const authHeader = request.headers.get("authorization") || "";
        const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        if (!jwt) return json({ error: "Authentication required." }, 401);

        const auth = await authenticatedService(jwt);
        if ("error" in auth) return json({ error: auth.error }, auth.status);
        const { service, authUser } = auth;
        const { data: actor, error: actorError } = await service
          .from("profiles")
          .select("id,full_name,email,role")
          .eq("id", authUser.id)
          .maybeSingle();
        if (actorError) return json({ error: actorError.message }, 500);
        if (actor?.role !== "super_admin") {
          return json({ error: "Only Super Admin can delete portal accounts." }, 403);
        }

        const payload = (await request.json().catch(() => ({}))) as DeletePayload;
        const id = payload.id?.trim();
        const reason = payload.reason?.trim();
        if (!id || !reason || !["staff", "partner"].includes(payload.kind || "")) {
          return json({ error: "Account, account type, and deletion reason are required." }, 400);
        }

        if (payload.kind === "staff") {
          if (id === actor.id) return json({ error: "You cannot delete your own account." }, 400);
          const { data: target, error: targetError } = await service
            .from("profiles")
            .select("id,full_name,email,role,account_status")
            .eq("id", id)
            .maybeSingle();
          if (targetError) return json({ error: targetError.message }, 500);
          if (!target) return json({ error: "User account not found." }, 404);

          if (target.role === "super_admin") {
            const { count, error: countError } = await service
              .from("profiles")
              .select("id", { count: "exact", head: true })
              .eq("role", "super_admin")
              .eq("account_status", "active");
            if (countError) return json({ error: countError.message }, 500);
            if ((count || 0) <= 1)
              return json({ error: "The last active Super Admin cannot be deleted." }, 400);
          }

          const { error: authDeleteError } = await service.auth.admin.deleteUser(id);
          if (authDeleteError)
            return json({ error: authDeleteError.message || "Unable to delete Auth user." }, 500);

          const { error: auditError } = await service.from("audit_log").insert({
            actor_id: actor.id,
            actor_name: actor.full_name || actor.email,
            action: "Account Deleted",
            module: "Users",
            record_id: id,
            record_name: target.full_name || target.email,
            old_value: { role: target.role, status: target.account_status },
            new_value: { deleted: true, reason },
          });
          return json({
            id,
            archivedPartnerRecord: false,
            warning: auditError
              ? `Account deleted, but audit logging failed: ${auditError.message}`
              : null,
          });
        }

        const { data: partner, error: partnerError } = await service
          .from("partner_profiles")
          .select("id,user_id,name,email,status")
          .eq("id", id)
          .maybeSingle();
        if (partnerError) return json({ error: partnerError.message }, 500);
        if (!partner) return json({ error: "Sales Partner account not found." }, 404);

        const { data: linkedProfiles, error: linkedError } = await service
          .from("profiles")
          .select("id")
          .eq("partner_id", partner.id);
        if (linkedError) return json({ error: linkedError.message }, 500);
        const authIds = [
          ...new Set(
            [partner.user_id, ...(linkedProfiles || []).map((row) => row.id)].filter(Boolean),
          ),
        ] as string[];

        const { error: invitationDeleteError } = await service
          .from("invitations")
          .delete()
          .eq("email", partner.email);
        if (invitationDeleteError) return json({ error: invitationDeleteError.message }, 500);

        const { error: partnerUpdateError } = await service
          .from("partner_profiles")
          .update({ status: "deactivated" })
          .eq("id", partner.id);
        if (partnerUpdateError) return json({ error: partnerUpdateError.message }, 500);

        if (authIds.length) {
          const { error: profileUpdateError } = await service
            .from("profiles")
            .update({ account_status: "deactivated" })
            .in("id", authIds);
          if (profileUpdateError) return json({ error: profileUpdateError.message }, 500);

          for (const authId of authIds) {
            const { error } = await service.auth.admin.deleteUser(authId);
            if (error)
              return json({ error: error.message || "Unable to delete partner Auth user." }, 500);
          }
        }

        const { error: auditError } = await service.from("audit_log").insert({
          actor_id: actor.id,
          actor_name: actor.full_name || actor.email,
          action: "Account Deleted",
          module: "Users",
          record_id: partner.id,
          record_name: partner.name,
          old_value: { email: partner.email, status: partner.status },
          new_value: { auth_deleted: true, archived_partner_record: true, reason },
        });
        return json({
          id: partner.id,
          archivedPartnerRecord: true,
          warning: auditError
            ? `Account deleted, but audit logging failed: ${auditError.message}`
            : null,
        });
      },
    },
  },
});

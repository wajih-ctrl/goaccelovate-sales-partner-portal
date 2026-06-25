import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

type InvitePayload = {
  name?: string;
  email?: string;
  role?: "admin" | "partner";
  tier?: "Associate" | "Specialist" | "Partner";
};

type RevokePayload = {
  id?: string;
};

function normalizePublicUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

const appUrl = () =>
  normalizePublicUrl(process.env.APP_URL) ||
  normalizePublicUrl(process.env.VITE_APP_URL) ||
  normalizePublicUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
  normalizePublicUrl(process.env.VERCEL_URL) ||
  normalizePublicUrl(process.env.URL) ||
  "http://127.0.0.1:5173";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function envValue(name: string) {
  return process.env[name]?.trim();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validate(payload: InvitePayload) {
  const name = payload.name?.trim() || "";
  const email = normalizeEmail(payload.email || "");
  const role = payload.role;
  const tier = payload.tier || "Associate";

  if (!name) return { error: "Full name is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Valid email is required." };
  if (role !== "admin" && role !== "partner")
    return { error: "Role must be Admin or Sales Partner." };
  if (role === "partner" && !["Associate", "Specialist", "Partner"].includes(tier)) {
    return { error: "Partner tier is invalid." };
  }

  return { name, email, role, tier };
}

export const Route = createFileRoute("/api/invitations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = envValue("SUPABASE_URL") || envValue("VITE_SUPABASE_URL");
        const serviceRoleKey = envValue("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !serviceRoleKey) {
          return json(
            {
              error:
                "Real invitations are not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server.",
            },
            500,
          );
        }

        const authHeader = request.headers.get("authorization") || "";
        const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
        if (!jwt) return json({ error: "Authentication required." }, 401);

        const service = createClient<Database>(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const {
          data: { user: authUser },
          error: authError,
        } = await service.auth.getUser(jwt);
        if (authError || !authUser) return json({ error: "Invalid session." }, 401);

        const { data: actor, error: actorError } = await service
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", authUser.id)
          .maybeSingle();

        if (actorError) return json({ error: actorError.message }, 500);
        if (actor?.role !== "super_admin")
          return json({ error: "Only Super Admin can invite users." }, 403);

        const parsed = validate((await request.json()) as InvitePayload);
        if ("error" in parsed) return json({ error: parsed.error }, 400);

        let partnerId: string | null = null;
        if (parsed.role === "partner") {
          const { data: partner, error: partnerError } = await service
            .from("partner_profiles")
            .insert({
              name: parsed.name,
              email: parsed.email,
              tier: parsed.tier,
              status: "pending",
              assigned_contact: actor.full_name || "GoAccelovate Admin",
            })
            .select("id")
            .single();

          if (partnerError) return json({ error: partnerError.message }, 400);
          partnerId = partner.id;
        }

        const { data: inviteData, error: inviteError } = await service.auth.admin.inviteUserByEmail(
          parsed.email,
          {
            redirectTo: `${appUrl()}/invitation`,
            data: {
              full_name: parsed.name,
              role: parsed.role,
              partner_id: partnerId,
            },
          },
        );

        if (inviteError || !inviteData.user) {
          if (partnerId) await service.from("partner_profiles").delete().eq("id", partnerId);
          return json({ error: inviteError?.message || "Unable to send invitation." }, 400);
        }

        const userId = inviteData.user.id;
        const { error: profileError } = await service
          .from("profiles")
          .update({
            full_name: parsed.name,
            role: parsed.role,
            account_status: "pending",
            partner_id: partnerId,
          })
          .eq("id", userId);

        if (profileError) return json({ error: profileError.message }, 500);

        if (partnerId) {
          const { error: partnerLinkError } = await service
            .from("partner_profiles")
            .update({ user_id: userId })
            .eq("id", partnerId);

          if (partnerLinkError) return json({ error: partnerLinkError.message }, 500);
        }

        const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
        const { data: invitation, error: invitationError } = await service
          .from("invitations")
          .insert({
            email: parsed.email,
            role: parsed.role,
            tier: parsed.role === "partner" ? parsed.tier : null,
            partner_id: partnerId,
            invited_by: actor.id,
            token_hash: crypto.randomUUID(),
            expires_at: expiresAt,
          })
          .select("id,created_at,expires_at")
          .single();

        if (invitationError) return json({ error: invitationError.message }, 500);

        return json({
          invitationId: invitation.id,
          email: parsed.email,
          role: parsed.role,
          partnerId,
          createdAt: invitation.created_at,
          expiresAt: invitation.expires_at,
        });
      },
      DELETE: async ({ request }) => {
        const supabaseUrl = envValue("SUPABASE_URL") || envValue("VITE_SUPABASE_URL");
        const serviceRoleKey = envValue("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !serviceRoleKey) {
          return json(
            {
              error:
                "Real invitations are not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server.",
            },
            500,
          );
        }

        const authHeader = request.headers.get("authorization") || "";
        const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
        if (!jwt) return json({ error: "Authentication required." }, 401);

        const service = createClient<Database>(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const {
          data: { user: authUser },
          error: authError,
        } = await service.auth.getUser(jwt);
        if (authError || !authUser) return json({ error: "Invalid session." }, 401);

        const { data: actor, error: actorError } = await service
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", authUser.id)
          .maybeSingle();

        if (actorError) return json({ error: actorError.message }, 500);
        if (actor?.role !== "super_admin")
          return json({ error: "Only Super Admin can revoke invitations." }, 403);

        const payload = (await request.json().catch(() => ({}))) as RevokePayload;
        const id = payload.id?.trim();
        if (!id) return json({ error: "Invitation id is required." }, 400);

        const { data: invitation, error: readError } = await service
          .from("invitations")
          .select("id,email,role,partner_id")
          .eq("id", id)
          .maybeSingle();

        if (readError) return json({ error: readError.message }, 500);
        if (!invitation) return json({ error: "Invitation not found." }, 404);

        const { error: deleteError } = await service.from("invitations").delete().eq("id", id);
        if (deleteError) return json({ error: deleteError.message }, 500);

        if (invitation.partner_id) {
          await service
            .from("partner_profiles")
            .update({ status: "deactivated" })
            .eq("id", invitation.partner_id)
            .eq("status", "pending");
        }

        await service.from("audit_log").insert({
          actor_id: actor.id,
          actor_name: actor.full_name || authUser.email || "Super Admin",
          action: "Invitation Revoked",
          module: "Users",
          record_id: invitation.id,
          record_name: invitation.email,
          old_value: { role: invitation.role, partner_id: invitation.partner_id },
          new_value: { revoked: true },
        });

        return json({ id });
      },
    },
  },
});

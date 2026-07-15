/* eslint-disable @typescript-eslint/no-explicit-any -- Invitation fields are introduced by the pending migration. */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

type InvitePayload = {
  name?: string;
  email?: string;
  role?: "admin" | "partner";
  commissionRate?: number;
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

function requestOrigin(request: Request) {
  const origin = normalizePublicUrl(request.headers.get("origin") || undefined);
  if (origin) return origin;

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || undefined;
  if (!host) return "";
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  return normalizePublicUrl(`${protocol}://${host}`);
}

function isLocalOrigin(value: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value);
}

function appUrl(request: Request) {
  const origin = requestOrigin(request);
  const configured =
    normalizePublicUrl(process.env.APP_URL) ||
    normalizePublicUrl(process.env.VITE_APP_URL) ||
    normalizePublicUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    normalizePublicUrl(process.env.VERCEL_URL) ||
    normalizePublicUrl(process.env.URL);

  return origin && !isLocalOrigin(origin)
    ? origin
    : configured || origin || "http://127.0.0.1:5173";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function envValue(name: string) {
  return process.env[name]?.trim();
}

function normalizeSupabaseUrl(value: string | undefined) {
  const normalized = normalizePublicUrl(value);
  return normalized.endsWith("/auth/v1") ? normalized.slice(0, -"/auth/v1".length) : normalized;
}

function decodeJwtPayload(jwt: string): { iss?: string } | null {
  try {
    const encoded = jwt.split(".")[1];
    if (!encoded) return null;
    const padded = encoded.padEnd(encoded.length + ((4 - (encoded.length % 4)) % 4), "=");
    const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
    if (typeof atob !== "function") return null;
    const json = atob(base64);
    return JSON.parse(json) as { iss?: string };
  } catch {
    return null;
  }
}

function supabaseUrlFromJwt(jwt: string) {
  return normalizeSupabaseUrl(decodeJwtPayload(jwt)?.iss);
}

function candidateSupabaseUrls(jwt: string) {
  return [
    supabaseUrlFromJwt(jwt),
    normalizeSupabaseUrl(envValue("SUPABASE_URL")),
    normalizeSupabaseUrl(envValue("VITE_SUPABASE_URL")),
  ].filter((url, index, urls) => url && urls.indexOf(url) === index);
}

async function getAuthedService(jwt: string) {
  const serviceRoleKey = envValue("SUPABASE_SERVICE_ROLE_KEY");
  const urls = candidateSupabaseUrls(jwt);

  if (!urls.length || !serviceRoleKey) {
    return {
      error:
        "Real invitations are not configured. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.",
      status: 500,
    } as const;
  }

  let lastAuthError = "";
  for (const supabaseUrl of urls) {
    const service = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user: authUser },
      error: authError,
    } = await service.auth.getUser(jwt);

    if (!authError && authUser) return { service, authUser } as const;
    lastAuthError = authError?.message || "Unable to verify session.";
  }

  return {
    error:
      "Invalid session. Sign in again and verify Vercel uses the same Supabase project URL and service-role key as the frontend.",
    detail: lastAuthError,
    status: 401,
  } as const;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validate(payload: InvitePayload) {
  const name = payload.name?.trim() || "";
  const email = normalizeEmail(payload.email || "");
  const role = payload.role;
  const commissionRate = Number(payload.commissionRate);

  if (!name) return { error: "Full name is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Valid email is required." };
  if (role !== "admin" && role !== "partner")
    return { error: "Role must be Admin or Sales Partner." };
  if (
    role === "partner" &&
    (!Number.isFinite(commissionRate) || commissionRate <= 0 || commissionRate > 100)
  )
    return { error: "Commission percentage must be greater than 0 and no more than 100." };

  return { name, email, role, commissionRate: role === "partner" ? commissionRate : null };
}

export const Route = createFileRoute("/api/invitations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") || "";
        const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
        if (!jwt) return json({ error: "Authentication required." }, 401);

        const authed = await getAuthedService(jwt);
        if ("error" in authed)
          return json({ error: authed.error, detail: authed.detail }, authed.status);
        const { service, authUser } = authed;

        const { data: actor, error: actorError } = await service
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", authUser.id)
          .maybeSingle();

        if (actorError) return json({ error: actorError.message }, 500);
        if (!actor || !["admin", "super_admin"].includes(actor.role))
          return json({ error: "Only Admin users can invite users." }, 403);

        const parsed = validate((await request.json()) as InvitePayload);
        if ("error" in parsed) return json({ error: parsed.error }, 400);
        if (actor.role === "admin" && parsed.role !== "partner")
          return json({ error: "Admin can only invite Sales Partners." }, 403);

        let partnerId: string | null = null;
        if (parsed.role === "partner") {
          const { data: partner, error: partnerError } = await (service as any)
            .from("partner_profiles")
            .insert({
              name: parsed.name,
              email: parsed.email,
              commission_rate: parsed.commissionRate,
              status: "pending",
              agreements_required: true,
              assigned_contact: actor.full_name || "GoAccelovate Admin",
            })
            .select("id")
            .single();

          if (partnerError) {
            if (partnerError.code === "23505") {
              return json(
                { error: "An active Sales Partner or pending invitation already uses this email." },
                409,
              );
            }
            return json({ error: partnerError.message }, 400);
          }
          partnerId = partner.id;
        }

        const { data: inviteData, error: inviteError } = await service.auth.admin.inviteUserByEmail(
          parsed.email,
          {
            redirectTo: `${appUrl(request)}/invitation`,
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

        if (profileError) {
          await service.auth.admin.deleteUser(userId);
          if (partnerId) await service.from("partner_profiles").delete().eq("id", partnerId);
          return json({ error: profileError.message }, 500);
        }

        if (partnerId) {
          const { error: partnerLinkError } = await service
            .from("partner_profiles")
            .update({ user_id: userId })
            .eq("id", partnerId);

          if (partnerLinkError) {
            await service.auth.admin.deleteUser(userId);
            await service.from("partner_profiles").delete().eq("id", partnerId);
            return json({ error: partnerLinkError.message }, 500);
          }
        }

        const agreementSignedAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
        const { data: invitation, error: invitationError } = await (service as any)
          .from("invitations")
          .insert({
            email: parsed.email,
            role: parsed.role,
            tier: null,
            commission_rate: parsed.commissionRate,
            partner_id: partnerId,
            invited_by: actor.id,
            agreement_signer_name: actor.full_name || authUser.email || "GoAccelovate Admin",
            agreement_signer_role: actor.role,
            agreement_signed_at: agreementSignedAt,
            token_hash: crypto.randomUUID(),
            expires_at: expiresAt,
          })
          .select("id,created_at,expires_at")
          .single();

        if (invitationError) {
          await service.auth.admin.deleteUser(userId);
          if (partnerId) await service.from("partner_profiles").delete().eq("id", partnerId);
          return json({ error: invitationError.message }, 500);
        }

        return json({
          invitationId: invitation.id,
          email: parsed.email,
          role: parsed.role,
          partnerId,
          agreementSignerName: actor.full_name || authUser.email,
          agreementSignedAt,
          createdAt: invitation.created_at,
          expiresAt: invitation.expires_at,
        });
      },
      DELETE: async ({ request }) => {
        const authHeader = request.headers.get("authorization") || "";
        const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
        if (!jwt) return json({ error: "Authentication required." }, 401);

        const authed = await getAuthedService(jwt);
        if ("error" in authed)
          return json({ error: authed.error, detail: authed.detail }, authed.status);
        const { service, authUser } = authed;

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

        const { data: pendingProfile } = await service
          .from("profiles")
          .select("id,account_status")
          .eq("email", invitation.email)
          .maybeSingle();
        if (pendingProfile?.account_status === "pending") {
          await service.auth.admin.deleteUser(pendingProfile.id);
        }

        if (invitation.partner_id) {
          await service
            .from("partner_profiles")
            .delete()
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

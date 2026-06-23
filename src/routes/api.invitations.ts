import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

type InvitePayload = {
  name?: string;
  email?: string;
  role?: "admin" | "partner";
  tier?: "Associate" | "Specialist" | "Partner";
};

const appUrl = () =>
  process.env.APP_URL || process.env.VITE_APP_URL || process.env.URL || "http://127.0.0.1:5173";

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
        await service.from("invitations").insert({
          email: parsed.email,
          role: parsed.role,
          tier: parsed.role === "partner" ? parsed.tier : null,
          partner_id: partnerId,
          invited_by: actor.id,
          token_hash: crypto.randomUUID(),
          expires_at: expiresAt,
        });

        return json({
          email: parsed.email,
          role: parsed.role,
          partnerId,
          expiresAt,
        });
      },
    },
  },
});

import { supabase } from "./supabase";

export type InviteUserPayload = {
  name: string;
  email: string;
  role: "admin" | "partner";
  commissionRate?: number;
};

export type InviteUserResult = {
  error?: string;
  invitationId?: string;
  email?: string;
  role?: "admin" | "partner";
  partnerId?: string | null;
  createdAt?: string;
  expiresAt?: string;
};

export async function sendRealInvitation(payload: InviteUserPayload): Promise<InviteUserResult> {
  if (!supabase) {
    return { error: "Supabase is not configured. Add Supabase env vars before sending invites." };
  }

  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !data.session?.access_token) {
    return { error: "Sign in with a real Admin account before sending invites." };
  }

  const response = await fetch("/api/invitations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => ({}))) as InviteUserResult;
  if (!response.ok) return { error: body.error || "Invitation failed." };

  return body;
}

export async function revokeRealInvitation(id: string) {
  if (!supabase) {
    return { error: "Supabase is not configured. Add Supabase env vars before revoking invites." };
  }

  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !data.session?.access_token) {
    return { error: "Sign in with a real Super Admin account before revoking invites." };
  }

  const response = await fetch("/api/invitations", {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({ id }),
  });

  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) return { error: body.error || "Invitation revoke failed." };

  return {};
}

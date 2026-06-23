import { supabase } from "./supabase";

export type InviteUserPayload = {
  name: string;
  email: string;
  role: "admin" | "partner";
  tier?: "Associate" | "Specialist" | "Partner";
};

export async function sendRealInvitation(payload: InviteUserPayload) {
  if (!supabase) {
    return { error: "Supabase is not configured. Add Supabase env vars before sending invites." };
  }

  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !data.session?.access_token) {
    return { error: "Sign in with a real Super Admin account before sending invites." };
  }

  const response = await fetch("/api/invitations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) return { error: body.error || "Invitation failed." };

  return {};
}

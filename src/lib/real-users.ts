import { supabase } from "./supabase";

export type DeletePortalUserPayload = {
  id: string;
  kind: "staff" | "partner";
  reason: string;
};

export async function deleteRealUser(payload: DeletePortalUserPayload) {
  if (!supabase) return { error: "Supabase is not configured." };

  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !data.session?.access_token) {
    return { error: "Your session has expired. Sign in again before deleting an account." };
  }

  const response = await fetch("/api/users", {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    archivedPartnerRecord?: boolean;
    warning?: string | null;
  };
  if (!response.ok) return { error: body.error || "Account deletion failed." };
  return {
    archivedPartnerRecord: Boolean(body.archivedPartnerRecord),
    warning: body.warning || undefined,
  };
}

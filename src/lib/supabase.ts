import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizePublicUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  return trimTrailingSlash(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
}

export function getAuthRedirectUrl(path = "/login") {
  const envOrigin =
    normalizePublicUrl(import.meta.env.VITE_APP_URL) ||
    normalizePublicUrl(import.meta.env.VITE_VERCEL_PROJECT_PRODUCTION_URL) ||
    normalizePublicUrl(import.meta.env.VITE_VERCEL_URL);

  if (typeof window === "undefined") {
    const serverFallback =
      normalizePublicUrl(import.meta.env.VITE_VERCEL_PROJECT_PRODUCTION_URL) ||
      normalizePublicUrl(import.meta.env.VITE_VERCEL_URL) ||
      normalizePublicUrl(import.meta.env.VITE_APP_URL);

    return `${envOrigin || serverFallback || "https://goaccelovate-sales-partner-portal.vercel.app"}${path}`;
  }

  const origin = window.location.origin;
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  const redirectOrigin = isLocalhost && envOrigin ? envOrigin : origin;
  return `${redirectOrigin}${path}`;
}

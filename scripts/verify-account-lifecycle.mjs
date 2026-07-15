import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(file) {
  const path = resolve(file);
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function fail(message, error) {
  const detail = error?.message ? `: ${error.message}` : "";
  throw new Error(`${message}${detail}`);
}

loadEnvFile(".env.local");

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  fail("Missing Supabase URL, publishable key, or service-role key");
}

const service = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const partnerClient = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `lifecycle-${suffix}@example.com`;
const password = `Lifecycle!${suffix}`;
const createdPartnerIds = [];
let authUserId;

try {
  const { data: authData, error: authError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Lifecycle Verification Partner", role: "partner" },
  });
  if (authError || !authData.user) fail("Unable to create lifecycle Auth user", authError);
  authUserId = authData.user.id;

  const { error: profileError } = await service.from("profiles").upsert({
    id: authUserId,
    email,
    full_name: "Lifecycle Verification Partner",
    role: "partner",
    account_status: "active",
  });
  if (profileError) fail("Unable to prepare lifecycle profile", profileError);

  const { data: originalPartner, error: partnerError } = await service
    .from("partner_profiles")
    .insert({
      user_id: authUserId,
      name: "Lifecycle Verification Partner",
      email,
      status: "active",
    })
    .select("id")
    .single();
  if (partnerError || !originalPartner) fail("Unable to create lifecycle partner", partnerError);
  createdPartnerIds.push(originalPartner.id);

  const { error: linkError } = await service
    .from("profiles")
    .update({ partner_id: originalPartner.id })
    .eq("id", authUserId);
  if (linkError) fail("Unable to link lifecycle partner", linkError);

  const { data: signInData, error: signInError } = await partnerClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signInData.session) fail("Lifecycle partner could not sign in", signInError);

  const { error: archiveError } = await service
    .from("partner_profiles")
    .update({ user_id: null, status: "deactivated", deleted_at: new Date().toISOString() })
    .eq("id", originalPartner.id);
  if (archiveError) fail("Unable to archive lifecycle partner", archiveError);

  const { error: deleteError } = await service.auth.admin.deleteUser(authUserId);
  if (deleteError) fail("Unable to delete lifecycle Auth user", deleteError);
  authUserId = undefined;

  const { data: deletedUserData, error: deletedUserError } = await partnerClient.auth.getUser();
  if (!deletedUserError || deletedUserData.user) {
    fail("Deleted Auth user still passed remote session validation");
  }

  const { data: replacement, error: replacementError } = await service
    .from("partner_profiles")
    .insert({ name: "Lifecycle Replacement Partner", email, status: "pending" })
    .select("id")
    .single();
  if (replacementError || !replacement) {
    fail("Archived partner email could not be reused", replacementError);
  }
  createdPartnerIds.push(replacement.id);

  const { error: duplicateActiveError } = await service
    .from("partner_profiles")
    .insert({ name: "Lifecycle Duplicate Partner", email, status: "pending" });
  if (duplicateActiveError?.code !== "23505") {
    fail("A second active partner with the same email was not rejected", duplicateActiveError);
  }

  console.log("PASS: partner could sign in before deletion");
  console.log("PASS: deleted Auth user failed remote session validation");
  console.log("PASS: archived partner email was reusable");
  console.log("PASS: duplicate active partner email remained blocked");
} finally {
  await partnerClient.auth.signOut({ scope: "local" }).catch(() => undefined);
  if (authUserId) await service.auth.admin.deleteUser(authUserId).catch(() => undefined);
  if (createdPartnerIds.length) {
    await service.from("partner_profiles").delete().in("id", createdPartnerIds);
  }
}

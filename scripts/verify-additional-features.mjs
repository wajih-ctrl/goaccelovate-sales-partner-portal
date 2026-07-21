import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

function loadEnv(file) {
  const path = resolve(file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

loadEnv(".env.local");
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !serviceKey || !anonKey) throw new Error("Missing Supabase verification settings.");

const service = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const stamp = `${Date.now()}-${randomBytes(3).toString("hex")}`;
const password = `Additional!${randomBytes(18).toString("base64url")}9a`;
const createdUsers = [];
const partnerIds = [];
const announcementIds = [];
const storagePaths = [];
let invitationId;

async function must(promise, label) {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function expectError(promise, label) {
  const result = await promise;
  if (!result.error) throw new Error(`${label}: expected an error`);
}

async function account(label, role) {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const email = `codex-additional-${slug}-${stamp}@example.com`;
  const result = await must(
    service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Additional ${label}`, role },
    }),
    `Create ${label}`,
  );
  createdUsers.push(result.user.id);
  await must(
    service
      .from("profiles")
      .update({ full_name: `Additional ${label}`, role, account_status: "active" })
      .eq("id", result.user.id),
    `Activate ${label}`,
  );
  return { id: result.user.id, email, name: `Additional ${label}` };
}

async function signIn(account) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await must(
    client.auth.signInWithPassword({ email: account.email, password }),
    `Sign in ${account.email}`,
  );
  return client;
}

try {
  const superAccount = await account("Super Admin", "super_admin");
  const adminAccount = await account("Admin", "admin");
  const partnerAAccount = await account("Partner A", "partner");
  const partnerBAccount = await account("Partner B", "partner");
  const profiles = await must(
    service
      .from("partner_profiles")
      .insert([
        {
          user_id: partnerAAccount.id,
          name: partnerAAccount.name,
          email: partnerAAccount.email,
          status: "active",
          commission_rate: 10,
          agreements_required: false,
        },
        {
          user_id: partnerBAccount.id,
          name: partnerBAccount.name,
          email: partnerBAccount.email,
          status: "active",
          commission_rate: 10,
          agreements_required: false,
        },
      ])
      .select("id,email"),
    "Create partner profiles",
  );
  const partnerA = profiles.find((profile) => profile.email === partnerAAccount.email);
  const partnerB = profiles.find((profile) => profile.email === partnerBAccount.email);
  partnerIds.push(partnerA.id, partnerB.id);
  await must(
    service.from("profiles").update({ partner_id: partnerA.id }).eq("id", partnerAAccount.id),
    "Link Partner A",
  );
  await must(
    service.from("profiles").update({ partner_id: partnerB.id }).eq("id", partnerBAccount.id),
    "Link Partner B",
  );

  const superAdmin = await signIn(superAccount);
  const admin = await signIn(adminAccount);
  const partnerAClient = await signIn(partnerAAccount);
  const partnerBClient = await signIn(partnerBAccount);

  const announcementId = globalThis.crypto.randomUUID();
  announcementIds.push(announcementId);
  const attachmentPath = `${adminAccount.id}/${announcementId}/business-update.pdf`;
  storagePaths.push(attachmentPath);
  await must(
    admin.storage
      .from("announcement-attachments")
      .upload(attachmentPath, new TextEncoder().encode("%PDF-1.4 announcement verification"), {
        contentType: "application/pdf",
      }),
    "Admin uploads announcement attachment",
  );
  await must(
    admin.from("announcements").insert({
      id: announcementId,
      title: `Business update ${stamp}`,
      body: "Important verification announcement for every Sales Partner.",
      priority: "Important",
      target_type: "all_partners",
      target_rules: {},
      published_by: adminAccount.id,
      attachment_name: "business-update.pdf",
      attachment_bucket: "announcement-attachments",
      attachment_path: attachmentPath,
      attachment_type: "application/pdf",
      attachment_size: 34,
    }),
    "Admin publishes announcement",
  );
  await expectError(
    partnerAClient.from("announcements").insert({
      title: "Unauthorized announcement",
      body: "A Sales Partner must not be able to publish this record.",
      priority: "General",
      target_type: "all_partners",
      target_rules: {},
    }),
    "Partner announcement creation denied",
  );
  const visible = await must(
    partnerAClient.from("announcements").select("id").eq("id", announcementId),
    "Partner reads targeted announcement",
  );
  if (visible.length !== 1) throw new Error("Targeted announcement was not visible to Partner A.");
  const file = await must(
    partnerAClient.storage.from("announcement-attachments").download(attachmentPath),
    "Partner downloads announcement attachment",
  );
  if (!file) throw new Error("Announcement attachment download returned no file.");

  const notificationsBefore = await must(
    service.from("notifications").select("id").eq("partner_id", partnerA.id),
    "Read Partner A notifications before reply",
  );
  const comment = await must(
    partnerAClient
      .from("announcement_comments")
      .insert({
        announcement_id: announcementId,
        actor_id: partnerAAccount.id,
        actor_name: "Spoofed Name",
        body: "Thank you. This business update is clear.",
      })
      .select("actor_name,body")
      .single(),
    "Partner replies to announcement",
  );
  if (comment.actor_name !== partnerAAccount.name) {
    throw new Error("Announcement comment actor name was not server-authored.");
  }
  await must(
    partnerAClient.from("announcement_reactions").upsert(
      {
        announcement_id: announcementId,
        actor_id: partnerAAccount.id,
        reaction: "Celebrate",
      },
      { onConflict: "announcement_id,actor_id" },
    ),
    "Partner reacts to announcement",
  );
  const notificationsAfter = await must(
    service.from("notifications").select("id").eq("partner_id", partnerA.id),
    "Read Partner A notifications after reply",
  );
  if (notificationsAfter.length !== notificationsBefore.length) {
    throw new Error("Partner received a notification for their own announcement reply.");
  }

  const selectedId = globalThis.crypto.randomUUID();
  announcementIds.push(selectedId);
  await must(
    admin.from("announcements").insert({
      id: selectedId,
      title: `Selected update ${stamp}`,
      body: "Visible only to the selected Sales Partner.",
      priority: "General",
      target_type: "selected_partners",
      target_rules: { partner_ids: [partnerB.id] },
      published_by: adminAccount.id,
    }),
    "Publish selected-partner announcement",
  );
  const hiddenFromA = await must(
    partnerAClient.from("announcements").select("id").eq("id", selectedId),
    "Partner A selected announcement isolation",
  );
  if (hiddenFromA.length) throw new Error("Partner A saw Partner B's selected announcement.");
  const visibleToB = await must(
    partnerBClient.from("announcements").select("id").eq("id", selectedId),
    "Partner B selected announcement read",
  );
  if (visibleToB.length !== 1) throw new Error("Partner B could not read their announcement.");

  await partnerAClient.storage.from("announcement-attachments").remove([attachmentPath]);
  await must(
    partnerAClient.storage.from("announcement-attachments").download(attachmentPath),
    "Partner delete attempt leaves announcement attachment intact",
  );
  await must(
    superAdmin.storage.from("announcement-attachments").remove([attachmentPath]),
    "Super Admin deletes announcement attachment",
  );
  storagePaths.splice(storagePaths.indexOf(attachmentPath), 1);

  const invitation = await must(
    service
      .from("invitations")
      .insert({
        email: partnerAAccount.email,
        role: "partner",
        partner_id: partnerA.id,
        invited_by: adminAccount.id,
        agreement_signer_name: adminAccount.name,
        agreement_signer_role: "admin",
        agreement_signed_at: new Date().toISOString(),
        agreement_text: `Custom agreement ${stamp} with {{COMMISSION_RATE}} commission.`,
        token_hash: `additional-${stamp}`,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      })
      .select("id")
      .single(),
    "Create custom invitation agreement",
  );
  invitationId = invitation.id;
  const agreement = await must(
    partnerAClient.rpc("get_current_partner_invitation_agreement"),
    "Partner reads custom invitation agreement",
  );
  if (!agreement[0]?.agreement_text?.includes(`Custom agreement ${stamp}`)) {
    throw new Error("Partner did not receive the invitation-specific agreement text.");
  }

  console.log("Additional feature verification passed");
} finally {
  if (storagePaths.length) {
    await service.storage.from("announcement-attachments").remove(storagePaths);
  }
  if (invitationId) await service.from("invitations").delete().eq("id", invitationId);
  if (announcementIds.length) {
    await service.from("announcements").delete().in("id", announcementIds);
  }
  for (const id of createdUsers) await service.auth.admin.deleteUser(id);
  if (partnerIds.length) await service.from("partner_profiles").delete().in("id", partnerIds);
}

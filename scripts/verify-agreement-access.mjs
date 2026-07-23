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
    if (!process.env[key]) process.env[key] = trimmed.slice(index + 1);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

loadEnvFile(".env.local");

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(url && anonKey && serviceKey, "Missing Supabase verification configuration");

const service = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const partnerClient = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const adminClient = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const marker = `Agreement gate ${suffix}`;
const partnerEmail = `agreement-partner-${suffix}@example.com`;
const adminEmail = `agreement-admin-${suffix}@example.com`;
const password = `AgreementGate!${suffix}`;
const cleanup = {
  authUserIds: [],
  partnerIds: [],
  leadIds: [],
  commissionIds: [],
  notificationIds: [],
  announcementIds: [],
};

async function createAuthUser(email, fullName, role) {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });
  if (error || !data.user) throw error || new Error(`Unable to create ${role} user`);
  cleanup.authUserIds.push(data.user.id);
  const { error: profileError } = await service.from("profiles").upsert({
    id: data.user.id,
    email,
    full_name: fullName,
    role,
    account_status: "active",
  });
  if (profileError) throw profileError;
  return data.user;
}

try {
  const partnerUser = await createAuthUser(partnerEmail, "Agreement Gate Partner", "partner");
  const adminUser = await createAuthUser(adminEmail, "Agreement Gate Admin", "admin");

  const { data: partners, error: partnersError } = await service
    .from("partner_profiles")
    .insert([
      {
        user_id: partnerUser.id,
        name: "Agreement Gate Partner",
        email: partnerEmail,
        status: "active",
        agreements_required: true,
      },
      {
        name: "Agreement Gate Other Partner",
        email: `agreement-other-${suffix}@example.com`,
        status: "active",
        agreements_required: true,
      },
    ])
    .select("id,email");
  if (partnersError || partners?.length !== 2)
    throw partnersError || new Error("Partner fixtures failed");
  const ownPartnerId = partners.find((partner) => partner.email === partnerEmail)?.id;
  const otherPartnerId = partners.find((partner) => partner.email !== partnerEmail)?.id;
  assert(ownPartnerId && otherPartnerId, "Unable to identify partner fixtures");
  cleanup.partnerIds.push(ownPartnerId, otherPartnerId);

  const { error: linkError } = await service
    .from("profiles")
    .update({ partner_id: ownPartnerId })
    .eq("id", partnerUser.id);
  if (linkError) throw linkError;

  const { data: lead, error: leadError } = await service
    .from("leads")
    .insert({
      partner_id: ownPartnerId,
      company_name: marker,
      contact_name: "Agreement Contact",
      contact_title: "Director",
      contact_email: `agreement-contact-${suffix}@example.com`,
      country: "United States",
      industry: "SaaS",
      estimated_value: 25000,
      currency: "USD",
      description:
        "A temporary production verification lead used to validate agreement access controls.",
      stage: "Identified Opportunity",
      status: "Open",
      created_by: partnerUser.id,
    })
    .select("id")
    .single();
  if (leadError) throw leadError;
  cleanup.leadIds.push(lead.id);

  const { data: commission, error: commissionError } = await service
    .from("commissions")
    .insert({
      lead_id: lead.id,
      partner_id: ownPartnerId,
      rate: 10,
      base_amount: 25000,
      amount: 2500,
      state: "On Hold",
    })
    .select("id")
    .single();
  if (commissionError) throw commissionError;
  cleanup.commissionIds.push(commission.id);

  const { data: announcement, error: announcementError } = await service
    .from("announcements")
    .insert({ title: marker, body: marker, priority: "General", target_type: "all_partners" })
    .select("id")
    .single();
  if (announcementError) throw announcementError;
  cleanup.announcementIds.push(announcement.id);

  const { data: notificationRows, error: notificationError } = await service
    .from("notifications")
    .insert([
      { partner_id: ownPartnerId, title: `${marker} own`, body: "Own partner notification" },
      { partner_id: otherPartnerId, title: `${marker} other`, body: "Other partner notification" },
      { recipient_id: adminUser.id, title: `${marker} staff`, body: "Own staff notification" },
    ])
    .select("id");
  if (notificationError) throw notificationError;
  cleanup.notificationIds.push(...notificationRows.map((row) => row.id));

  const { error: partnerSignInError } = await partnerClient.auth.signInWithPassword({
    email: partnerEmail,
    password,
  });
  if (partnerSignInError) throw partnerSignInError;
  const { error: adminSignInError } = await adminClient.auth.signInWithPassword({
    email: adminEmail,
    password,
  });
  if (adminSignInError) throw adminSignInError;

  const { data: accessBefore, error: accessBeforeError } = await partnerClient.rpc(
    "partner_has_program_access",
  );
  if (accessBeforeError) throw accessBeforeError;
  assert(accessBefore === false, "Unsigned partner unexpectedly had program access");

  const [unsignedLeads, unsignedCommissions, unsignedAnnouncements, partnerNotifications] =
    await Promise.all([
      partnerClient.from("leads").select("id").eq("id", lead.id),
      partnerClient.from("commissions").select("id").eq("id", commission.id),
      partnerClient.from("announcements").select("id").eq("id", announcement.id),
      partnerClient.from("notifications").select("title").ilike("title", `${marker}%`),
    ]);
  for (const result of [
    unsignedLeads,
    unsignedCommissions,
    unsignedAnnouncements,
    partnerNotifications,
  ]) {
    if (result.error) throw result.error;
  }
  assert(unsignedLeads.data.length === 0, "Unsigned partner could read a lead");
  assert(unsignedCommissions.data.length === 0, "Unsigned partner could read a commission");
  assert(unsignedAnnouncements.data.length === 0, "Unsigned partner could read an announcement");
  assert(
    partnerNotifications.data.length === 1 && partnerNotifications.data[0].title.endsWith("own"),
    "Partner notification feed was not isolated",
  );

  const { data: staffNotifications, error: staffNotificationsError } = await adminClient
    .from("notifications")
    .select("title")
    .ilike("title", `${marker}%`);
  if (staffNotificationsError) throw staffNotificationsError;
  assert(
    staffNotifications.length === 1 && staffNotifications[0].title.endsWith("staff"),
    "Staff notification feed included another recipient's alert",
  );

  const { data: agreementComplete, error: agreementError } = await partnerClient.rpc(
    "accept_partner_agreement_document",
    {
      target_document_type: "Agreement",
      signer_name: "Agreement Gate Partner",
      signer_email: partnerEmail,
      browser_user_agent: "GoAccelovate individual Agreement verification",
    },
  );
  if (agreementError) throw agreementError;
  assert(agreementComplete === false, "Agreement-only signature unexpectedly unlocked access");

  const { data: accessAfterAgreement, error: accessAfterAgreementError } = await partnerClient.rpc(
    "partner_has_program_access",
  );
  if (accessAfterAgreementError) throw accessAfterAgreementError;
  assert(accessAfterAgreement === false, "Agreement-only partner received program access");

  const { data: acceptanceAfterAgreement, error: acceptanceAfterAgreementError } = await service
    .from("partner_agreement_acceptances")
    .select("agreement_documents!inner(document_type)")
    .eq("partner_id", ownPartnerId);
  if (acceptanceAfterAgreementError) throw acceptanceAfterAgreementError;
  assert(
    acceptanceAfterAgreement.length === 1 &&
      acceptanceAfterAgreement[0].agreement_documents.document_type === "Agreement",
    "Agreement signature did not remain isolated to the Agreement",
  );

  const { data: ndaComplete, error: ndaError } = await partnerClient.rpc(
    "accept_partner_agreement_document",
    {
      target_document_type: "NDA",
      signer_name: "Agreement Gate Partner",
      signer_email: partnerEmail,
      browser_user_agent: "GoAccelovate individual NDA verification",
    },
  );
  if (ndaError) throw ndaError;
  assert(ndaComplete === true, "NDA signature did not complete both required documents");

  const { data: accessAfter, error: accessAfterError } = await partnerClient.rpc(
    "partner_has_program_access",
  );
  if (accessAfterError) throw accessAfterError;
  assert(accessAfter === true, "Signed partner did not receive program access");

  const [signedLeads, signedCommissions, signedAnnouncements] = await Promise.all([
    partnerClient.from("leads").select("id").eq("id", lead.id),
    partnerClient.from("commissions").select("id").eq("id", commission.id),
    partnerClient.from("announcements").select("id").eq("id", announcement.id),
  ]);
  for (const result of [signedLeads, signedCommissions, signedAnnouncements]) {
    if (result.error) throw result.error;
    assert(result.data.length === 1, "Signed partner did not regain an operational record");
  }

  console.log("PASS: unsigned partner operational access was blocked");
  console.log("PASS: unsigned partner retained only their own notification");
  console.log("PASS: staff notification feed was recipient-scoped");
  console.log("PASS: Agreement signed independently without unlocking operational data");
  console.log("PASS: NDA signed independently and unlocked own operational data");
} finally {
  await partnerClient.auth.signOut({ scope: "local" }).catch(() => undefined);
  await adminClient.auth.signOut({ scope: "local" }).catch(() => undefined);
  if (cleanup.notificationIds.length)
    await service.from("notifications").delete().in("id", cleanup.notificationIds);
  if (cleanup.commissionIds.length)
    await service.from("commissions").delete().in("id", cleanup.commissionIds);
  if (cleanup.leadIds.length) await service.from("leads").delete().in("id", cleanup.leadIds);
  if (cleanup.announcementIds.length)
    await service.from("announcements").delete().in("id", cleanup.announcementIds);
  for (const userId of cleanup.authUserIds) {
    await service.auth.admin.deleteUser(userId).catch(() => undefined);
  }
  if (cleanup.partnerIds.length)
    await service.from("partner_profiles").delete().in("id", cleanup.partnerIds);
}

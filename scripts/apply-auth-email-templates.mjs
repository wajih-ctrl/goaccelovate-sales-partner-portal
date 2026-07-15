import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(file) {
  const path = resolve(file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

loadEnvFile(".env.local");
const token = process.env.SUPABASE_ACCESS_TOKEN;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const projectRef = process.env.SUPABASE_PROJECT_REF || new URL(supabaseUrl).hostname.split(".")[0];
if (!token) throw new Error("Set SUPABASE_ACCESS_TOKEN before applying hosted email templates.");
if (!projectRef) throw new Error("Unable to determine the Supabase project reference.");

const template = (name) => readFileSync(resolve("supabase", "templates", name), "utf8");
const payload = {
  mailer_subjects_invite: "Welcome to the GoAccelovate Global Partner Program",
  mailer_templates_invite_content: template("invite.html"),
  mailer_subjects_recovery: "Reset your GoAccelovate portal password",
  mailer_templates_recovery_content: template("recovery.html"),
  mailer_subjects_confirmation: "Confirm your GoAccelovate portal email",
  mailer_templates_confirmation_content: template("confirmation.html"),
  mailer_subjects_email_change: "Confirm your new GoAccelovate portal email",
  mailer_templates_email_change_content: template("email-change.html"),
  mailer_subjects_magic_link: "Your secure GoAccelovate sign-in link",
  mailer_templates_magic_link_content: template("magic-link.html"),
  mailer_subjects_reauthentication: "Your GoAccelovate verification code",
  mailer_templates_reauthentication_content: template("reauthentication.html"),
  mailer_notifications_password_changed_enabled: true,
  mailer_subjects_password_changed_notification: "Your GoAccelovate password was changed",
  mailer_templates_password_changed_notification_content: template("password-changed.html"),
  mailer_notifications_email_changed_enabled: true,
  mailer_subjects_email_changed_notification: "Your GoAccelovate email was changed",
  mailer_templates_email_changed_notification_content: template("email-changed.html"),
};

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
  method: "PATCH",
  headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
  body: JSON.stringify(payload),
});
if (!response.ok) {
  throw new Error(
    `Supabase Auth template update failed (${response.status}): ${await response.text()}`,
  );
}
console.log("Hosted Supabase Auth email templates updated successfully.");

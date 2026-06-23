import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(file) {
  const path = resolve(file);
  if (!existsSync(path)) return;

  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

async function findUserByEmail(admin, email) {
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await admin.listUsers({ page, perPage });
    if (error) throw error;

    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

loadEnvFile(".env.local");

const [email, password, ...nameParts] = process.argv.slice(2);
const fullName = nameParts.join(" ").trim() || "GoAccelovate Super Admin";

if (!email || !password) {
  console.error(
    'Usage: node scripts/bootstrap-super-admin.mjs admin@example.com StrongPassword123 "Full Name"',
  );
  process.exit(1);
}

if (password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE URL or SUPABASE_SERVICE_ROLE_KEY. Check .env.local.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let user = await findUserByEmail(supabase.auth.admin, email);

if (!user) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: "super_admin",
    },
  });

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  user = data.user;
}

const { error: profileError } = await supabase.from("profiles").upsert({
  id: user.id,
  email,
  full_name: fullName,
  role: "super_admin",
  account_status: "active",
});

if (profileError) {
  console.error(profileError.message);
  process.exit(1);
}

console.log(`Super Admin ready: ${email}`);

/* eslint-disable @typescript-eslint/no-explicit-any -- New agreement RPCs are introduced by the pending migration. */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role, User } from "./domain";
import { getAuthRedirectUrl, isSupabaseConfigured, supabase } from "./supabase";

interface AuthResult {
  error?: string;
}

interface AuthCtx {
  user: User | null;
  ready: boolean;
  authMode: "supabase" | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  acceptInvitation: (payload: { fullName: string; password: string }) => Promise<AuthResult>;
  signRequiredAgreements: (legalName: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  ready: false,
  authMode: null,
  signIn: async () => ({}),
  resetPassword: async () => ({}),
  acceptInvitation: async () => ({}),
  signRequiredAgreements: async () => ({}),
  logout: async () => {},
});

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  account_status: "active" | "suspended" | "pending" | "deactivated";
  partner_id: string | null;
  avatar_url: string | null;
}

function mapProfile(profile: ProfileRow): User {
  return {
    id: profile.id,
    name: profile.full_name || profile.email,
    email: profile.email,
    role: profile.role,
    partnerId: profile.partner_id || undefined,
    avatar: profile.avatar_url || undefined,
    accountStatus: profile.account_status,
  };
}

async function loadSupabaseUser(): Promise<User | null> {
  if (!supabase) return null;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user) return null;

  const authUser = sessionData.session.user;
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,account_status,partner_id,avatar_url")
    .eq("id", authUser.id)
    .maybeSingle<ProfileRow>();

  if (error) throw error;

  if (!profile) {
    return {
      id: authUser.id,
      name: authUser.user_metadata?.full_name || authUser.email || "User",
      email: authUser.email || "",
      role: (authUser.user_metadata?.role as Role | undefined) || "partner",
    };
  }

  if (profile.account_status === "suspended" || profile.account_status === "deactivated") {
    await supabase.auth.signOut();
    throw new Error("This account is not active. Please contact GoAccelovate support.");
  }

  const mapped = mapProfile(profile);
  if (mapped.role === "partner" && mapped.partnerId) {
    const { data: complete, error: agreementError } = await (supabase as any).rpc(
      "partner_agreements_complete",
      { check_partner: mapped.partnerId },
    );
    mapped.agreementsComplete = agreementError ? false : Boolean(complete);
  }
  return mapped;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthCtx["authMode"]>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        localStorage.removeItem("gtpp_demo_user");
        if (isSupabaseConfigured) {
          const supabaseUser = await loadSupabaseUser();
          if (!cancelled && supabaseUser) {
            setUser(supabaseUser);
            setAuthMode("supabase");
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    boot();

    const { data: authListener } = supabase?.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        setAuthMode(null);
        return;
      }

      loadSupabaseUser()
        .then((nextUser) => {
          if (nextUser) {
            setUser(nextUser);
            setAuthMode("supabase");
          }
        })
        .catch((error) => console.error(error));
    }) || { data: { subscription: null } };

    return () => {
      cancelled = true;
      authListener.subscription?.unsubscribe();
    };
  }, []);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    if (!supabase) return { error: "Supabase is not configured for this environment." };

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    try {
      const nextUser = await loadSupabaseUser();
      if (nextUser) {
        setUser(nextUser);
        setAuthMode("supabase");
      }
      return {};
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Unable to load account profile.";
      return { error: message };
    }
  };

  const resetPassword: AuthCtx["resetPassword"] = async (email) => {
    if (!supabase) return { error: "Supabase is not configured for this environment." };

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl("/invitation?mode=recovery"),
    });

    return error ? { error: error.message } : {};
  };

  const acceptInvitation: AuthCtx["acceptInvitation"] = async ({ fullName, password }) => {
    if (!supabase) return { error: "Supabase is not configured for this environment." };
    if (password.length < 12) return { error: "Password must be at least 12 characters." };

    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type");

    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "invite" | "recovery" | "email",
      });
      if (error) return { error: error.message };
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { full_name: fullName },
    });
    if (updateError) return { error: updateError.message };

    const { error: profileError } = await supabase.rpc("activate_current_profile", {
      new_full_name: fullName,
    });
    if (profileError) return { error: profileError.message };

    const nextUser = await loadSupabaseUser();
    if (nextUser) {
      setUser(nextUser);
      setAuthMode("supabase");
    }

    return {};
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setAuthMode(null);
  };

  const signRequiredAgreements: AuthCtx["signRequiredAgreements"] = async (legalName) => {
    if (!supabase || !user) return { error: "You must be signed in to sign agreements." };
    const { error } = await (supabase as any).rpc("accept_required_partner_agreements", {
      signer_name: legalName,
      signer_email: user.email,
      browser_user_agent: typeof navigator === "undefined" ? null : navigator.userAgent,
    });
    if (error) return { error: error.message };
    const nextUser = await loadSupabaseUser();
    if (nextUser) setUser(nextUser);
    return {};
  };

  return (
    <Ctx.Provider
      value={{
        user,
        ready,
        authMode,
        signIn,
        resetPassword,
        acceptInvitation,
        signRequiredAgreements,
        logout,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);

export function canAccess(role: Role | undefined, allowed: Role[]): boolean {
  return !!role && allowed.includes(role);
}

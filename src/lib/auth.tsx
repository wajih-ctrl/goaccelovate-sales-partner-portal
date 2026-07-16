/* eslint-disable @typescript-eslint/no-explicit-any -- New agreement RPCs are introduced by the pending migration. */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role, User } from "./domain";
import { getAuthRedirectUrl, isSupabaseConfigured, supabase } from "./supabase";

interface AuthResult {
  error?: string;
  requiresAgreement?: boolean;
}

interface AuthCtx {
  user: User | null;
  ready: boolean;
  authMode: "supabase" | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  acceptInvitation: (payload: { fullName: string; password: string }) => Promise<AuthResult>;
  signRequiredAgreements: (legalName: string) => Promise<AuthResult>;
  validateAccount: () => Promise<boolean>;
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
  validateAccount: async () => false,
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

function samePortalUser(current: User | null, next: User) {
  return (
    current?.id === next.id &&
    current.name === next.name &&
    current.email === next.email &&
    current.role === next.role &&
    current.partnerId === next.partnerId &&
    current.avatar === next.avatar &&
    current.accountStatus === next.accountStatus &&
    current.agreementsComplete === next.agreementsComplete
  );
}

async function loadSupabaseUser(verifyRemote = false): Promise<User | null> {
  if (!supabase) return null;

  const authUser = verifyRemote
    ? (await supabase.auth.getUser()).data.user
    : (await supabase.auth.getSession()).data.session?.user;
  if (!authUser) return null;
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,account_status,partner_id,avatar_url")
    .eq("id", authUser.id)
    .maybeSingle<ProfileRow>();

  if (error) throw error;

  if (!profile) {
    await supabase.auth.signOut({ scope: "local" });
    return null;
  }

  if (profile.account_status === "suspended" || profile.account_status === "deactivated") {
    await supabase.auth.signOut({ scope: "local" });
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

  const validateAccount = useCallback(async () => {
    if (!supabase) return false;
    try {
      const nextUser = await loadSupabaseUser(true);
      if (!nextUser) {
        await supabase.auth.signOut({ scope: "local" });
        setUser(null);
        setAuthMode(null);
        return false;
      }
      setUser((current) => (samePortalUser(current, nextUser) ? current : nextUser));
      setAuthMode("supabase");
      return true;
    } catch (error) {
      console.error("Unable to revalidate portal account", error);
      const { data } = await supabase.auth.getSession();
      if (data.session) return true;
      setUser(null);
      setAuthMode(null);
      return false;
    }
  }, []);

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
          } else {
            setUser(null);
            setAuthMode(null);
          }
        })
        .catch((error) => console.error(error));
    }) || { data: { subscription: null } };

    return () => {
      cancelled = true;
      authListener.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !user?.id) return;
    const authClient = supabase;

    let cancelled = false;
    const verify = () => {
      if (!cancelled) void validateAccount();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") verify();
    };
    const interval = window.setInterval(verify, 10_000);
    window.addEventListener("focus", verify);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const channel = authClient
      .channel(`account-lifecycle-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        verify,
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", verify);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void authClient.removeChannel(channel);
    };
  }, [user?.id, validateAccount]);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    if (!supabase) return { error: "Supabase is not configured for this environment." };

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    try {
      const nextUser = await loadSupabaseUser();
      if (nextUser) {
        setUser(nextUser);
        setAuthMode("supabase");
      } else {
        return { error: "This portal account is no longer active." };
      }
      return {
        requiresAgreement: nextUser.role === "partner" && nextUser.agreementsComplete !== true,
      };
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

    return {
      requiresAgreement: nextUser?.role === "partner" && nextUser.agreementsComplete !== true,
    };
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
    setUser((current) => (current ? { ...current, agreementsComplete: true } : current));
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
        validateAccount,
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

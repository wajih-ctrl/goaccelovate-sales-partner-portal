import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEMO_USERS, type User, type Role } from "./mock-data";

interface AuthCtx {
  user: User | null;
  ready: boolean;
  login: (role: Role) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({ user: null, ready: false, login: () => {}, logout: () => {} });

const KEY = "gtpp_demo_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    if (raw) {
      try { setUser(JSON.parse(raw)); } catch {}
    }
    setReady(true);
  }, []);

  const login = (role: Role) => {
    const u = DEMO_USERS.find(u => u.role === role)!;
    localStorage.setItem(KEY, JSON.stringify(u));
    setUser(u);
  };
  const logout = () => {
    localStorage.removeItem(KEY);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, ready, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

export function canAccess(role: Role | undefined, allowed: Role[]): boolean {
  return !!role && allowed.includes(role);
}

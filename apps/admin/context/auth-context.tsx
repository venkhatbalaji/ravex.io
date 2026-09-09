"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

interface AdminUser {
  id: string;
  email: string;
  role: string;
}

interface AuthContextValue {
  token: string | null;
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = "ravex.admin.token";

// There is no registration flow here on purpose — an Admin account can only
// come from Identity's controlled bootstrap (ADMIN_BOOTSTRAP_EMAIL/PASSWORD).
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) setToken(stored);
    else setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    api
      .me(token)
      .then((me) => {
        if (me.role !== "Admin") {
          setToken(null);
          setUser(null);
          return;
        }
        setUser(me);
      })
      .catch(() => {
        setToken(null);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  useEffect(() => {
    if (token) window.localStorage.setItem(STORAGE_KEY, token);
    else window.localStorage.removeItem(STORAGE_KEY);
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token && user),
      isLoading,
      async login(email, password) {
        const result = await api.login(email, password);
        if (result.user.role !== "Admin") {
          throw new Error("This account doesn't have admin access.");
        }
        setToken(result.accessToken);
        setUser({ id: result.user.id, email: result.user.email, role: result.user.role });
      },
      logout() {
        setToken(null);
        setUser(null);
      },
    }),
    [token, user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

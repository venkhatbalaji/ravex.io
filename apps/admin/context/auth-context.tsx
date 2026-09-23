"use client";

import { createContext, useContext, useCallback, Fragment, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useBrowserSession, type SessionStatus } from "@ravex/browser-session";
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
  sessionStatus: SessionStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const privateQueries = new Set(["operations"]);

const acceptAdmin = (user: AdminUser) => user.role === "Admin";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const clearPrivateData = useCallback(() => {
    const filters = { predicate: (query: { queryKey: readonly unknown[] }) => privateQueries.has(String(query.queryKey[0])) };
    void queryClient.cancelQueries(filters);
    queryClient.removeQueries(filters);
  }, [queryClient]);
  const session = useBrowserSession<AdminUser>({
    storageKey: "ravex.admin.token",
    loadUser: api.me,
    acceptUser: acceptAdmin,
    onSessionChange: clearPrivateData,
  });
  const value: AuthContextValue = {
    token: session.token,
    user: session.user,
    isAuthenticated: session.isAuthenticated,
    isLoading: session.isLoading,
    sessionStatus: session.status,
    login: (email, password) => session.signIn(() => api.login(email, password)),
    logout: session.logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {session.notice && (
        <div role="alert" className="border-b border-border bg-surface px-6 py-4 text-sm text-fg">
          <p>{session.notice}</p>
          {session.status === "unavailable" && (
            <div className="mt-2 flex gap-4">
              <button type="button" className="underline" onClick={session.retrySession}>Retry session verification</button>
              <button type="button" className="underline" onClick={session.logout}>Clear saved session</button>
            </div>
          )}
        </div>
      )}
      {/* Drop private operator form state when the session changes. */}
      <Fragment key={session.isAuthenticated ? session.epoch : "anonymous"}>{children}</Fragment>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

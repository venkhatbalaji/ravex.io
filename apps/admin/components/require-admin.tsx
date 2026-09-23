"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, sessionStatus } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (sessionStatus === "anonymous") router.replace("/login");
  }, [sessionStatus, router]);

  if (sessionStatus === "unavailable") return <p className="py-16 text-sm text-muted">Verify your saved session to continue.</p>;
  if (isLoading || !isAuthenticated) return <p className="py-16 text-sm text-muted">Loading…</p>;
  return <>{children}</>;
}

"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login");
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) return <p className="py-16 text-sm text-muted">Loading…</p>;
  return <>{children}</>;
}

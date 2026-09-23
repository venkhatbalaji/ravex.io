"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

export default function RootPage() {
  const { isAuthenticated, isLoading, sessionStatus } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || sessionStatus === "unavailable") return;
    router.replace(isAuthenticated ? "/markets" : "/login");
  }, [isAuthenticated, isLoading, sessionStatus, router]);

  return null;
}

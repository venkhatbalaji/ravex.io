"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/auth-context";
import { BrandingProvider } from "@/context/branding-context";
import { ThemeProvider } from "@/components/theme-context";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrandingProvider>
          <AuthProvider>{children}</AuthProvider>
        </BrandingProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

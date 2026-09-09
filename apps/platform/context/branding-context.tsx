"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type Theme } from "@/lib/api";

interface BrandingContextValue {
  copy: Record<string, string>;
}

const BrandingContext = createContext<BrandingContextValue>({ copy: {} });

const FONT_VAR: Record<Theme["font"], string> = {
  Fredoka: "var(--font-fredoka)",
  Nunito: "var(--font-nunito)",
  Poppins: "var(--font-poppins)",
  SpaceGrotesk: "var(--font-space-grotesk)",
};

/**
 * Fetches the admin-configured theme and copy once on load and applies them
 * at runtime — CSS custom properties for theme, a lookup dictionary (via
 * useCopy) for text. Branding is optional: any fetch failure, or a field
 * left at its default, just falls through to what's already in globals.css.
 */
export function BrandingProvider({ children }: { children: ReactNode }) {
  const { data: theme } = useQuery({ queryKey: ["branding-theme"], queryFn: () => api.theme(), retry: false });
  const { data: copyOverrides } = useQuery({
    queryKey: ["branding-copy"],
    queryFn: () => api.copyOverrides(),
    retry: false,
  });

  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement.style;
    if (theme.accentColor) root.setProperty("--accent", theme.accentColor);
    if (theme.accent2Color) root.setProperty("--accent-2", theme.accent2Color);
    const fontVar = FONT_VAR[theme.font] ?? FONT_VAR.Fredoka;
    root.setProperty("--font-display-active", `${fontVar}, "Segoe UI", sans-serif`);
    root.setProperty("--font-body-active", `${fontVar}, "Segoe UI", sans-serif`);
  }, [theme]);

  const copy: Record<string, string> = {};
  copyOverrides?.forEach((entry) => {
    copy[entry.key] = entry.value;
  });

  return <BrandingContext.Provider value={{ copy }}>{children}</BrandingContext.Provider>;
}

export function useCopy(key: string, fallback: string): string {
  const { copy } = useContext(BrandingContext);
  return copy[key] ?? fallback;
}

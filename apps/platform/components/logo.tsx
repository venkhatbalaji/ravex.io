"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "./theme-context";
import { api } from "@/lib/api";

/**
 * lockup-dark-master.png is transparent — it needs a dark surface behind it
 * for the cream wordmark to read, so it's used in dark mode where the nav
 * itself is already dark. lockup-light.png carries its own navy badge
 * background, so it stays legible sitting on a light page in light mode.
 * An admin-configured logo URL (any host) takes over from either default —
 * `unoptimized` is required for that case since next/image's optimizer only
 * accepts pre-allowlisted hosts, and a white-label logo can be anywhere.
 */
export function Logo() {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const { data: brand } = useQuery({ queryKey: ["branding-theme"], queryFn: () => api.theme(), retry: false });

  const fallbackSrc = isLight ? "/png/lockup-light.png" : "/png/lockup-dark-master.png";
  const customSrc = isLight ? brand?.logoLightUrl : brand?.logoDarkUrl;
  const src = customSrc || fallbackSrc;
  const alt = brand?.brandName || "Predict Play";

  return (
    <Link href="/" aria-label={`${alt} — home`} className="flex shrink-0 items-center">
      <Image
        src={src}
        alt={alt}
        width={isLight ? 2048 : 1983}
        height={isLight ? 900 : 793}
        priority
        unoptimized={Boolean(customSrc)}
        className="h-8 w-auto sm:h-9"
      />
    </Link>
  );
}

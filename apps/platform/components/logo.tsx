"use client";

import Image from "next/image";
import Link from "next/link";
import { useTheme } from "./theme-context";

/**
 * lockup-dark-master.png is transparent — it needs a dark surface behind it
 * for the cream wordmark to read, so it's used in dark mode where the nav
 * itself is already dark. lockup-light.png carries its own navy badge
 * background, so it stays legible sitting on a light page in light mode.
 */
export function Logo() {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <Link href="/" aria-label="Predict Play — home" className="flex shrink-0 items-center">
      <Image
        src={isLight ? "/png/lockup-light.png" : "/png/lockup-dark-master.png"}
        alt="Predict Play"
        width={isLight ? 2048 : 1983}
        height={isLight ? 900 : 793}
        priority
        className="h-8 w-auto sm:h-9"
      />
    </Link>
  );
}

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";

/**
 * The one above-the-fold moment worth GSAP over the plain data-reveal
 * pattern — a staggered entrance on mount, no ScrollTrigger needed since
 * it's always in view immediately.
 */
export function HeroReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const targets = ref.current.querySelectorAll("[data-hero-item]");
    gsap.fromTo(
      targets,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.08 },
    );
  }, []);

  return <div ref={ref}>{children}</div>;
}

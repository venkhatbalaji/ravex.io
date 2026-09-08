"use client";

import { useEffect } from "react";

/**
 * Same pattern as apps/web: an IntersectionObserver flips a `.revealed`
 * class on anything marked `data-reveal`, and CSS does the rest. No
 * animation library needed for the common case of "fade+rise in on scroll".
 */
export function RevealController() {
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return null;
}

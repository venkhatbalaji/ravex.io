"use client";

import { useEffect } from "react";

/**
 * An IntersectionObserver flips a `.revealed` class on anything marked
 * `data-reveal`, and CSS does the rest. This component lives once in the
 * root layout and never remounts across client-side navigation, so a
 * one-time querySelectorAll would only ever see whatever was on the very
 * first page load — every page navigated to afterward (and every element
 * that only appears once a data fetch resolves, which is most of them here)
 * would stay stuck at opacity:0 forever. A MutationObserver watches for
 * anything added later — new routes, async content — and observes it too.
 */
export function RevealController() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            io.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );

    function observeWithin(root: ParentNode) {
      root.querySelectorAll<HTMLElement>("[data-reveal]:not(.revealed)").forEach((el) => io.observe(el));
    }

    observeWithin(document.body);

    const mo = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches("[data-reveal]")) io.observe(node);
          observeWithin(node);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}

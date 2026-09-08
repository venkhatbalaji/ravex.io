"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

/**
 * Tweens a displayed number from its previous value to `value` whenever it
 * changes — GSAP earns its place here specifically because numeric tweening
 * with a good ease is what it's genuinely better at than a CSS transition.
 */
export function useCountUp(value: number, duration = 0.6) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    const proxy = { value: previous.current };
    const tween = gsap.to(proxy, {
      value,
      duration,
      ease: "power2.out",
      onUpdate: () => setDisplay(Math.round(proxy.value)),
    });
    previous.current = value;
    return () => {
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return display;
}

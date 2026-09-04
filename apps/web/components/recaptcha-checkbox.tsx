"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    grecaptcha?: {
      ready(callback: () => void): void;
      render(
        container: HTMLElement,
        params: { sitekey: string; callback: (token: string) => void; "expired-callback"?: () => void },
      ): number;
      reset(widgetId?: number): void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    if (window.grecaptcha) return resolve();
    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js?render=explicit";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load reCAPTCHA"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Renders nothing when NEXT_PUBLIC_RECAPTCHA_SITE_KEY isn't set, matching the
 * server-side plugin (lib/auth.ts) which is likewise inactive until configured.
 */
export function RecaptchaCheckbox({ onChange }: { onChange: (token: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        window.grecaptcha!.ready(() => {
          if (cancelled || !containerRef.current) return;
          window.grecaptcha!.render(containerRef.current, {
            sitekey: siteKey,
            callback: onChange,
            "expired-callback": () => onChange(null),
          });
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={containerRef} className="recaptcha-checkbox" />;
}

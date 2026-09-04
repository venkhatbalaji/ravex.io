"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { RecaptchaCheckbox } from "@/components/recaptcha-checkbox";

export function SignUpForm() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [message, setMessage] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const captchaRequired = Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const { error } = await authClient.signUp.email({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      fetchOptions: captchaToken ? { headers: { "x-captcha-response": captchaToken } } : undefined,
    });
    if (error) {
      setStatus("error");
      setMessage(error.message ?? "Something went wrong.");
      setCaptchaToken(null);
      setCaptchaResetKey((k) => k + 1); // v2 tokens are single-use — force a fresh checkbox
      return;
    }
    router.push("/chat");
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>Name<input name="name" required autoComplete="name" placeholder="Alex Morgan" maxLength={80} /></label>
      <label>Email<input type="email" name="email" required autoComplete="email" placeholder="alex@company.com" maxLength={180} /></label>
      <label>Password<input type="password" name="password" required autoComplete="new-password" minLength={8} maxLength={128} /></label>
      <RecaptchaCheckbox key={captchaResetKey} onChange={setCaptchaToken} />
      <button className="submit-button" disabled={status === "sending" || (captchaRequired && !captchaToken)}>
        {status === "sending" ? "Creating account…" : "Create account"}<span>↗</span>
      </button>
      {status === "error" && <p className="form-error" role="alert">{message}</p>}
      <p className="form-note">Already have an account? <a href="/sign-in">Sign in</a>.</p>
    </form>
  );
}

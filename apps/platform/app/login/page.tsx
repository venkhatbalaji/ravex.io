"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";

const fieldClass =
  "block w-full border-0 border-b border-border-strong bg-transparent py-2.5 text-sm text-fg normal-case tracking-normal outline-none transition focus:border-accent";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div data-reveal className="mx-auto max-w-sm space-y-6 py-10">
      <h1 className="font-display text-3xl font-semibold text-fg">Log in</h1>
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block space-y-1.5 text-xs uppercase tracking-wider text-muted">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={fieldClass} />
        </label>
        <label className="block space-y-1.5 text-xs uppercase tracking-wider text-muted">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={fieldClass}
          />
        </label>
        {error && <p className="text-xs text-danger">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="glow-accent w-full rounded-full bg-accent px-5 py-3 text-xs font-semibold text-accent-fg transition hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="text-xs text-muted">
        No account?{" "}
        <Link href="/register" className="text-accent-text">
          Register
        </Link>
      </p>
    </div>
  );
}

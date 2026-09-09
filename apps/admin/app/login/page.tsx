"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

const fieldClass =
  "block w-full rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-sm text-fg outline-none transition focus:border-accent";

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
      router.push("/markets");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-fg">Admin sign in</h1>
        <p className="mt-1 text-sm text-muted">Only accounts provisioned as Admin can access this tool.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1.5 text-xs text-muted">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={fieldClass} />
        </label>
        <label className="block space-y-1.5 text-xs text-muted">
          <span>Password</span>
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
          className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg transition hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

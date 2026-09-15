"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { api, ApiError, SUPPORTED_FONTS, type CopyOverride, type Theme } from "@/lib/api";
import { RequireAdmin } from "@/components/require-admin";

const fieldClass =
  "w-full rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent";

export default function BrandingPage() {
  return (
    <RequireAdmin>
      <BrandingContent />
    </RequireAdmin>
  );
}

function BrandingContent() {
  const queryClient = useQueryClient();
  const { data: theme } = useQuery({ queryKey: ["theme"], queryFn: () => api.theme() });
  const { data: copyOverrides, isLoading: copyLoading } = useQuery({
    queryKey: ["copy"],
    queryFn: () => api.copyOverrides(),
  });

  return (
    <div className="space-y-12">
      <h1 className="text-xl font-semibold text-fg">Branding</h1>
      {theme && <ThemeForm theme={theme} onSaved={() => queryClient.invalidateQueries({ queryKey: ["theme"] })} />}
      <CopySection
        overrides={copyOverrides ?? []}
        isLoading={copyLoading}
        onChanged={() => queryClient.invalidateQueries({ queryKey: ["copy"] })}
      />
    </div>
  );
}

function ThemeForm({ theme, onSaved }: { theme: Theme; onSaved: () => void }) {
  const { token } = useAuth();
  const [form, setForm] = useState(theme);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setForm(theme), [theme]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await api.updateTheme(token!, form);
      setMessage("Theme saved — reload the player app to see it.");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the theme.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-border bg-surface p-6">
      <div>
        <h2 className="text-sm font-semibold text-fg">Theme</h2>
        <p className="mt-1 text-xs text-muted">
          Curated fields only — every combination is guaranteed to render legibly in both light and dark mode.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-xs text-muted">
          <span>Brand name</span>
          <input
            value={form.brandName}
            onChange={(e) => setForm({ ...form, brandName: e.target.value })}
            required
            className={fieldClass}
          />
        </label>
        <label className="space-y-1.5 text-xs text-muted">
          <span>Font</span>
          <select
            value={form.font}
            onChange={(e) => setForm({ ...form, font: e.target.value as Theme["font"] })}
            className={fieldClass}
          >
            {SUPPORTED_FONTS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-xs text-muted">
          <span>Logo (light mode) URL</span>
          <input
            value={form.logoLightUrl}
            onChange={(e) => setForm({ ...form, logoLightUrl: e.target.value })}
            placeholder="https://…"
            className={fieldClass}
          />
        </label>
        <label className="space-y-1.5 text-xs text-muted">
          <span>Logo (dark mode) URL</span>
          <input
            value={form.logoDarkUrl}
            onChange={(e) => setForm({ ...form, logoDarkUrl: e.target.value })}
            placeholder="https://…"
            className={fieldClass}
          />
        </label>
        <label className="space-y-1.5 text-xs text-muted">
          <span>Accent color</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.accentColor}
              onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
              className="h-9 w-12 shrink-0 rounded border border-border-strong bg-transparent"
            />
            <input
              value={form.accentColor}
              onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
              className={fieldClass}
            />
          </div>
        </label>
        <label className="space-y-1.5 text-xs text-muted">
          <span>Secondary accent color</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.accent2Color}
              onChange={(e) => setForm({ ...form, accent2Color: e.target.value })}
              className="h-9 w-12 shrink-0 rounded border border-border-strong bg-transparent"
            />
            <input
              value={form.accent2Color}
              onChange={(e) => setForm({ ...form, accent2Color: e.target.value })}
              className={fieldClass}
            />
          </div>
        </label>
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <span className="text-xs text-muted">Preview</span>
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold text-black"
          style={{ background: form.accentColor }}
        >
          Primary
        </span>
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold text-black"
          style={{ background: form.accent2Color }}
        >
          Secondary
        </span>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
      {message && <p className="text-xs text-accent">{message}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save theme"}
      </button>
    </form>
  );
}

/** Every copy key the player app actually reads — see docs/admin-and-white-label.md. */
const COPY_KEYS: { key: string; label: string; default: string }[] = [
  { key: "nav.linkPredictions", label: "Predictions navigation", default: "My predictions" },
  { key: "predictions.heading", label: "Prediction history heading", default: "My predictions" },
  { key: "nav.linkMarkets", label: "Nav — Markets link", default: "Markets" },
  { key: "nav.linkWallet", label: "Nav — Wallet link", default: "Wallet" },
  { key: "nav.logIn", label: "Nav — Log in link", default: "Log in" },
  { key: "nav.register", label: "Nav — Register button", default: "Register" },
  { key: "nav.logOut", label: "Nav — Log out button", default: "Log out" },
  { key: "hero.eyebrow", label: "Hero — eyebrow", default: "Live Markets" },
  { key: "hero.heading1", label: "Hero — heading line 1", default: "Predict the match." },
  { key: "hero.heading2", label: "Hero — heading line 2", default: "Win the powerplay." },
  {
    key: "hero.subheading",
    label: "Hero — subheading",
    default: "Free coins, real pari-mutuel odds. Stake on an outcome before the market locks — the pool sets the price, not the house.",
  },
  { key: "markets.heading", label: "Markets — section heading", default: "All markets" },
  { key: "markets.emptyState", label: "Markets — empty state", default: "No markets yet — check back soon." },
  { key: "market.stakeHeading", label: "Market detail — stake form heading", default: "Place a stake" },
  {
    key: "market.stakeLoginPrompt",
    label: "Market detail — login prompt",
    default: "Log in to stake — this debits your wallet for real.",
  },
  { key: "market.stakeButton", label: "Market detail — stake button", default: "Stake" },
  { key: "wallet.heading", label: "Wallet — page heading", default: "Wallet" },
  { key: "wallet.earnDailyLogin", label: "Wallet — daily login button", default: "Daily login bonus" },
  { key: "wallet.recentActivity", label: "Wallet — activity heading", default: "Recent activity" },
  { key: "auth.loginHeading", label: "Login page — heading", default: "Log in" },
  { key: "auth.registerHeading", label: "Register page — heading", default: "Create an account" },
  { key: "auth.noAccount", label: "Login page — no account prompt", default: "No account?" },
  { key: "auth.haveAccount", label: "Register page — have account prompt", default: "Already have an account?" },
];

function CopySection({
  overrides,
  isLoading,
  onChanged,
}: {
  overrides: CopyOverride[];
  isLoading: boolean;
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function overrideFor(key: string) {
    return overrides.find((o) => o.key === key)?.value;
  }

  async function save(key: string) {
    setError(null);
    const value = drafts[key];
    if (value === undefined) return;
    try {
      await api.upsertCopyOverride(token!, key, value);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save that override.");
    }
  }

  async function reset(key: string) {
    setError(null);
    try {
      await api.deleteCopyOverride(token!, key);
      setDrafts((d) => {
        const next = { ...d };
        delete next[key];
        return next;
      });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset that override.");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-fg">Text overrides</h2>
        <p className="mt-1 text-xs text-muted">
          Change what the app says. Leave a field alone to keep the built-in default — this is a single override
          dictionary, not multi-language translation.
        </p>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {isLoading && <p className="text-xs text-muted">Loading…</p>}
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {COPY_KEYS.map(({ key, label, default: defaultValue }) => {
          const current = overrideFor(key);
          const draft = drafts[key] ?? current ?? defaultValue;
          return (
            <div key={key} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
              <div className="sm:w-64 sm:shrink-0">
                <p className="text-xs font-medium text-fg">{label}</p>
                <p className="font-mono text-[11px] text-muted">{key}</p>
              </div>
              <input
                value={draft}
                onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                className={`flex-1 ${fieldClass} ${current !== undefined ? "border-accent/50" : ""}`}
              />
              <div className="flex shrink-0 gap-3 text-xs">
                <button onClick={() => save(key)} className="text-accent hover:underline">
                  Save
                </button>
                {current !== undefined && (
                  <button onClick={() => reset(key)} className="text-muted hover:underline">
                    Reset
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

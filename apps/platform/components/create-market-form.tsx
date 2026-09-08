"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/lib/api";

const inputClass =
  "w-full rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-sm text-fg outline-none transition focus:border-accent/50";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5 text-xs text-muted">
      <span className="uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}

export function CreateMarketForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [eventStartAt, setEventStartAt] = useState("");
  const [outcomeA, setOutcomeA] = useState("");
  const [outcomeB, setOutcomeB] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.createMarket(title, new Date(eventStartAt).toISOString(), [outcomeA, outcomeB]);
      setTitle("");
      setEventStartAt("");
      setOutcomeA("");
      setOutcomeB("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the market.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-reveal
      className="grid gap-4 rounded-xl border border-dashed border-border-strong bg-surface p-5 sm:grid-cols-2"
    >
      <p className="text-xs text-muted sm:col-span-2">
        Admin — Market Catalog has no auth yet, so this is open to anyone locally.
      </p>
      <Field label="Title">
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputClass} />
      </Field>
      <Field label="Event start">
        <input
          type="datetime-local"
          value={eventStartAt}
          onChange={(e) => setEventStartAt(e.target.value)}
          required
          className={inputClass}
        />
      </Field>
      <Field label="Outcome A">
        <input value={outcomeA} onChange={(e) => setOutcomeA(e.target.value)} required className={inputClass} />
      </Field>
      <Field label="Outcome B">
        <input value={outcomeB} onChange={(e) => setOutcomeB(e.target.value)} required className={inputClass} />
      </Field>
      {error && <p className="text-xs text-danger sm:col-span-2">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="glow-accent justify-self-start rounded-full bg-accent px-5 py-2 text-xs font-semibold text-accent-fg transition hover:opacity-90 disabled:opacity-50 sm:col-span-2"
      >
        {submitting ? "Creating…" : "Create market"}
      </button>
    </form>
  );
}

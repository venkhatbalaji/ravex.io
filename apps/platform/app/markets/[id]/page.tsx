"use client";

import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { OddsBar } from "@/components/odds-bar";
import { StatusBadge } from "@/components/status-badge";
import { useCopy } from "@/context/branding-context";

interface StakeAttempt {
  key: string;
  outcomeId: string;
  amount: number;
}

export default function MarketDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const { token, user, isAuthenticated } = useAuth();
  const stakeHeading = useCopy("market.stakeHeading", "Place a stake");
  const stakeLoginPrompt = useCopy("market.stakeLoginPrompt", "Log in to stake — this debits your wallet for real.");
  const stakeButtonLabel = useCopy("market.stakeButton", "Stake");
  const [outcomeId, setOutcomeId] = useState("");
  const [amount, setAmount] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAttempt, setPendingAttempt] = useState<StakeAttempt | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const attemptStorageKey = user ? `ravex.stake.${user.id}.${id}` : null;
  useEffect(() => {
    setPendingAttempt(null);
    if (!attemptStorageKey) return;
    try {
      const saved = sessionStorage.getItem(attemptStorageKey);
      if (saved) {
        const attempt = JSON.parse(saved) as StakeAttempt;
        if (typeof attempt.key === "string" && typeof attempt.outcomeId === "string" && Number.isSafeInteger(attempt.amount) && attempt.amount > 0) {
          setPendingAttempt(attempt);
          setOutcomeId(attempt.outcomeId);
          setAmount(attempt.amount);
        }
      }
    } catch {
      setError("Could not restore the previous prediction request.");
    }
  }, [attemptStorageKey]);

  const { data: market } = useQuery({
    queryKey: ["market", id],
    queryFn: () => api.market(id),
    enabled: Boolean(id),
  });
  const { data: pool } = useQuery({
    queryKey: ["pool", id],
    queryFn: () => api.pool(id),
    enabled: Boolean(id),
    refetchInterval: 5000,
  });

  if (!market) return <p className="text-sm text-muted">Loading market…</p>;

  async function stake(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    setError(null);
    setMessage(null);
    if (!token || !attemptStorageKey) {
      setError("Log in to place a stake.");
      return;
    }
    const attempt = pendingAttempt ?? { key: crypto.randomUUID(), outcomeId, amount };
    if (!Number.isSafeInteger(attempt.amount) || attempt.amount <= 0 || !attempt.outcomeId) {
      setError("Choose an outcome and a positive whole number of coins.");
      return;
    }
    submitting.current = true;
    setIsSubmitting(true);
    try {
      // Save before sending: a lost response or a reload must reuse the same request.
      sessionStorage.setItem(attemptStorageKey, JSON.stringify(attempt));
      setPendingAttempt(attempt);
      const result = await api.stake(token, id, attempt.outcomeId, attempt.amount, attempt.key);
      if (result.stake.state === "pending") {
        setMessage("Your prediction is processing. Check it again shortly.");
      } else {
        sessionStorage.removeItem(attemptStorageKey);
        setPendingAttempt(null);
        setMessage(`Staked ${attempt.amount} coins on ${market!.outcomes.find((o) => o.id === attempt.outcomeId)?.label}.`);
      }
      queryClient.invalidateQueries({ queryKey: ["pool", id] });
      queryClient.invalidateQueries({ queryKey: ["balance"] });
    } catch (err) {
      // Auth expiry and transport/server failures can occur after admission.
      // Keep the original request for a later authenticated retry.
      if (err instanceof ApiError && [400, 402, 404, 409].includes(err.status)) {
        sessionStorage.removeItem(attemptStorageKey);
        setPendingAttempt(null);
      }
      setError(err instanceof ApiError ? err.message : "Could not confirm your prediction. Check the same request again.");
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div data-reveal className="space-y-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl font-semibold text-fg">{market.title}</h1>
          <StatusBadge status={market.status} />
        </div>
        <p className="text-xs text-muted">{new Date(market.eventStartAt).toLocaleString()}</p>
        <OddsBar outcomes={market.outcomes} odds={pool?.impliedOdds} winningOutcomeId={market.winningOutcomeId} />
        <p className="font-mono text-xs tabular-nums text-muted">{pool?.totalPool ?? 0} coins in the pool</p>
      </div>

      {(market.status === "open" || pendingAttempt) && (
        <form
          onSubmit={stake}
          data-reveal
          className="max-w-sm space-y-4 rounded-xl border border-border bg-surface p-5"
        >
          <h2 className="font-display text-lg font-medium text-fg">{stakeHeading}</h2>
          {!isAuthenticated && <p className="text-xs text-muted">{stakeLoginPrompt}</p>}
          <label className="block space-y-1.5 text-xs text-muted">
            <span className="uppercase tracking-wider">Outcome</span>
            <select
              disabled={isSubmitting || Boolean(pendingAttempt)}
              value={outcomeId}
              onChange={(e) => setOutcomeId(e.target.value)}
              required
              className="w-full rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent/50"
            >
              <option value="" disabled>
                Choose an outcome
              </option>
              {market.outcomes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 text-xs text-muted">
            <span className="uppercase tracking-wider">Amount</span>
            <input
              type="number"
              min={1}
              step={1}
              disabled={isSubmitting || Boolean(pendingAttempt)}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
              className="w-full rounded-lg border border-border-strong bg-surface-2 px-3 py-2 font-mono text-sm text-fg outline-none focus:border-accent/50"
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting || !isAuthenticated}
            className="glow-accent w-full rounded-full bg-accent px-5 py-2.5 text-xs font-semibold text-accent-fg transition hover:opacity-90 active:scale-[0.98]"
          >
            {isSubmitting ? "Checking…" : pendingAttempt ? "Check prediction" : stakeButtonLabel}
          </button>
        </form>
      )}

      {message && <p role="status" className="text-xs text-accent-text">{message}</p>}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}

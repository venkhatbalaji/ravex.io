"use client";

import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { OddsBar } from "@/components/odds-bar";
import { StatusBadge } from "@/components/status-badge";

export default function MarketDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const { token, isAuthenticated } = useAuth();
  const [outcomeId, setOutcomeId] = useState("");
  const [amount, setAmount] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
    setError(null);
    setMessage(null);
    if (!token) {
      setError("Log in to place a stake.");
      return;
    }
    try {
      await api.stake(token, market!.id, outcomeId, amount);
      setMessage(`Staked ${amount} coins on ${market!.outcomes.find((o) => o.id === outcomeId)?.label}.`);
      queryClient.invalidateQueries({ queryKey: ["pool", id] });
      queryClient.invalidateQueries({ queryKey: ["balance"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not place the stake.");
    }
  }

  async function lock() {
    await api.lockMarket(market!.id);
    queryClient.invalidateQueries({ queryKey: ["market", id] });
  }

  async function settle(winningOutcomeId: string) {
    await api.settlePool(market!.id, winningOutcomeId);
    await api.settleMarket(market!.id, winningOutcomeId);
    queryClient.invalidateQueries({ queryKey: ["market", id] });
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

      {market.status === "open" && (
        <form
          onSubmit={stake}
          data-reveal
          className="max-w-sm space-y-4 rounded-xl border border-border bg-surface p-5"
        >
          <h2 className="font-display text-lg font-medium text-fg">Place a stake</h2>
          {!isAuthenticated && <p className="text-xs text-muted">Log in to stake — this debits your wallet for real.</p>}
          <label className="block space-y-1.5 text-xs text-muted">
            <span className="uppercase tracking-wider">Outcome</span>
            <select
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
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
              className="w-full rounded-lg border border-border-strong bg-surface-2 px-3 py-2 font-mono text-sm text-fg outline-none focus:border-accent/50"
            />
          </label>
          {error && <p className="text-xs text-danger">{error}</p>}
          {message && <p className="text-xs text-accent-text">{message}</p>}
          <button
            type="submit"
            className="glow-accent w-full rounded-full bg-accent px-5 py-2.5 text-xs font-semibold text-accent-fg transition hover:opacity-90 active:scale-[0.98]"
          >
            Stake
          </button>
        </form>
      )}

      {market.status === "open" && (
        <div data-reveal className="max-w-sm space-y-3 rounded-xl border border-dashed border-border-strong bg-surface p-5">
          <p className="text-xs text-muted">Admin — no auth yet on these either.</p>
          <button
            onClick={lock}
            className="rounded-full border border-border-strong px-4 py-1.5 text-xs text-muted transition hover:border-accent/40 hover:text-fg"
          >
            Lock market
          </button>
        </div>
      )}

      {market.status === "locked" && (
        <div data-reveal className="max-w-sm space-y-3 rounded-xl border border-dashed border-border-strong bg-surface p-5">
          <p className="text-xs text-muted">Admin — settle by picking the winning outcome.</p>
          <div className="flex flex-wrap gap-2">
            {market.outcomes.map((o) => (
              <button
                key={o.id}
                onClick={() => settle(o.id)}
                className="glow-accent rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg transition hover:opacity-90"
              >
                {o.label} wins
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { api, ApiError } from "@/lib/api";
import { useCountUp } from "@/components/use-count-up";
import { useCopy } from "@/context/branding-context";

export default function WalletPage() {
  const { token, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const claiming = useRef(false);

  const heading = useCopy("wallet.heading", "Wallet");
  const recentActivity = useCopy("wallet.recentActivity", "Recent activity");
  const dailyLabel = useCopy("wallet.earnDailyLogin", "Daily login bonus");
  const rewards = useQuery({
    queryKey: ["rewards", token], queryFn: () => api.rewards(token!),
    enabled: Boolean(token), refetchInterval: 10000, retry: false,
  });

  const { data: balance } = useQuery({
    queryKey: ["balance", token],
    queryFn: () => api.balance(token!),
    enabled: Boolean(token),
  });
  const { data: ledger } = useQuery({
    queryKey: ["ledger", token],
    queryFn: () => api.ledger(token!),
    enabled: Boolean(token),
  });
  const displayBalance = useCountUp(balance?.balance ?? 0);

  async function earn(reason: string) {
    if (!token || claiming.current) return;
    claiming.current = true;
    setIsClaiming(true);
    setMessage(null);
    setError(null);
    try {
      const result = await api.earn(token, reason);
      setMessage(`+${result.credited} coins`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not confirm the claim. Check your balance and try again.");
    } finally {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["balance", token] }),
        queryClient.invalidateQueries({ queryKey: ["ledger", token] }),
        queryClient.invalidateQueries({ queryKey: ["rewards", token] }),
      ]);
      claiming.current = false;
      setIsClaiming(false);
    }
  }

  if (isLoading) return <p className="text-sm text-muted">Loading wallet…</p>;
  if (!token) return <p className="text-sm text-muted"><Link href="/login" className="text-accent-text underline">Log in</Link> to view your wallet and claim rewards.</p>;

  return (
    <div className="space-y-10">
      <div data-reveal className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">{heading}</p>
        <p className="font-display font-mono text-5xl font-semibold tabular-nums text-fg">
          {displayBalance} <span className="font-body text-lg font-normal text-muted">coins</span>
        </p>
      </div>

      <div data-reveal className="space-y-3">
        <h2 className="font-display text-lg font-medium text-fg">Available rewards</h2>
        {rewards.isPending && <p className="text-sm text-muted">Loading rewards…</p>}
        {rewards.error && <p role="alert" className="text-sm text-danger">Could not refresh rewards. <button onClick={() => void rewards.refetch()} className="underline">Try again</button>.</p>}
        {rewards.data?.items.map((r) => (
          <div key={r.reason} className="space-y-2">
            <button
              onClick={() => earn(r.reason)}
              disabled={!r.available || isClaiming || Boolean(rewards.error)}
              className="glow-accent rounded-full border border-border-strong bg-surface px-4 py-2 text-xs text-fg transition hover:border-accent/40 active:scale-[0.98] disabled:opacity-50"
            >
              {isClaiming ? "Claiming…" : r.available ? dailyLabel : "Daily bonus claimed"} <span className="font-mono text-accent-text">+{r.amount}</span>
            </button>
            {r.nextAvailableAt && <p className="text-xs text-muted">Next daily bonus: {new Date(r.nextAvailableAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>}
          </div>
        ))}
        <p className="text-xs text-muted">Daily rewards reset at 05:30 IST (00:00 UTC). More reward options are coming soon.</p>
      </div>
      {message && <p role="status" className="text-xs text-accent-text">{message}</p>}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}

      <div data-reveal className="space-y-3">
        <h2 className="font-display text-lg font-medium text-fg">{recentActivity}</h2>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {ledger?.map((entry, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-muted">{new Date(entry.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-fg">{entry.reason}</td>
                  <td
                    className={`px-4 py-3 text-right font-mono font-medium tabular-nums ${entry.amount >= 0 ? "text-accent-text" : "text-danger"}`}
                  >
                    {entry.amount >= 0 ? "+" : ""}
                    {entry.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ledger?.length === 0 && <p className="p-4 text-xs text-muted">No activity yet.</p>}
        </div>
      </div>
    </div>
  );
}

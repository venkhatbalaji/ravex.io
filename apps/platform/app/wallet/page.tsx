"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { api, ApiError } from "@/lib/api";
import { useCountUp } from "@/components/use-count-up";

const EARN_REASONS = [
  { key: "daily_login", label: "Daily login bonus", amount: 50 },
  { key: "rewarded_ad", label: "Watch a rewarded ad", amount: 20 },
  { key: "referral", label: "Referral bonus", amount: 100 },
];

export default function WalletPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

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
    setMessage(null);
    try {
      const result = await api.earn(token!, reason);
      setMessage(`+${result.credited} coins`);
      queryClient.invalidateQueries({ queryKey: ["balance"] });
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not claim that right now.");
    }
  }

  return (
    <div className="space-y-10">
      <div data-reveal className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Wallet</p>
        <p className="font-display font-mono text-5xl font-semibold tabular-nums text-fg">
          {displayBalance} <span className="font-body text-lg font-normal text-muted">coins</span>
        </p>
      </div>

      <div data-reveal className="flex flex-wrap gap-3">
        {EARN_REASONS.map((r) => (
          <button
            key={r.key}
            onClick={() => earn(r.key)}
            className="glow-accent rounded-full border border-border-strong bg-surface px-4 py-2 text-xs text-fg transition hover:border-accent/40 active:scale-[0.98]"
          >
            {r.label} <span className="font-mono text-accent-text">+{r.amount}</span>
          </button>
        ))}
      </div>
      {message && <p className="text-xs text-accent-text">{message}</p>}

      <div data-reveal className="space-y-3">
        <h2 className="font-display text-lg font-medium text-fg">Recent activity</h2>
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

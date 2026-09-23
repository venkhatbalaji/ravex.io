"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useCopy } from "@/context/branding-context";
import { api, type Prediction } from "@/lib/api";

const labels: Record<Prediction["result"], string> = {
  pending: "Confirming stake", active: "Awaiting result", processing: "Transferring coins",
  won: "Won", lost: "Lost", refunded: "Refunded", rejected: "Not accepted",
};

export default function PredictionsPage() {
  const { token, user, isLoading, sessionStatus } = useAuth();
  const [offset, setOffset] = useState(0);
  const heading = useCopy("predictions.heading", "My predictions");
  const { data, error, isPending } = useQuery({
    queryKey: ["predictions", user?.id, token, offset],
    queryFn: () => api.predictions(token!, offset), enabled: Boolean(token && user), refetchInterval: 3000,
  });
  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (sessionStatus === "unavailable") return <p className="text-sm text-muted">Verify your saved session to continue.</p>;
  if (!token || !user) return <p className="text-muted"><Link href="/login" className="text-accent-text underline">Log in</Link> to see your predictions.</p>;
  return (
    <section className="space-y-6">
      <h1 className="font-display text-3xl font-semibold text-fg">{heading}</h1>
      <p className="text-sm text-muted">Follow your stakes, results, and coins returned to your wallet.</p>
      {error && <p role="alert" className="text-danger">Could not load predictions. Please try again.</p>}
      {isPending && <p className="text-muted">Loading predictions…</p>}
      {data?.items.length === 0 && <p className="text-muted">No predictions yet. <Link href="/" className="text-accent-text underline">Explore markets</Link>.</p>}
      <div className="space-y-3">{data?.items.map(item => <PredictionCard key={item.id} item={item} />)}</div>
      <div className="flex items-center gap-4">
        <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))} className="rounded-full border border-border px-4 py-2 text-sm text-fg disabled:opacity-30">Previous</button>
        <span className="text-sm text-muted">Page {Math.floor(offset / 20) + 1}</span>
        <button disabled={data?.nextOffset == null} onClick={() => setOffset(data!.nextOffset!)} className="rounded-full border border-border px-4 py-2 text-sm text-fg disabled:opacity-30">Next</button>
      </div>
    </section>
  );
}
function PredictionCard({ item }: { item: Prediction }) {
  const { data: market } = useQuery({ queryKey: ["market", item.marketId], queryFn: () => api.market(item.marketId) });
  const outcome = market?.outcomes.find(o => o.id === item.outcomeId)?.label ?? "Selected outcome";
  return (
    <article className="space-y-3 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <Link href={`/markets/${item.marketId}`} className="font-display text-lg font-semibold text-fg hover:underline">{market?.title ?? "Prediction market"}</Link>
        <span className="rounded-full bg-accent/10 px-3 py-1 text-xs text-accent-text">{labels[item.result]}</span>
      </div>
      <p className="text-sm text-muted">{outcome} · {item.amount} coins staked · {item.payout} coins returned</p>
      <p className="text-xs text-muted">{new Date(item.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>
      {market?.resultSource && <p className="text-xs text-muted">Result: {market.resultSource}</p>}
    </article>
  );
}

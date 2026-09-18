"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MarketPagination } from "@/components/market-filters";
import { RequireAdmin } from "@/components/require-admin";
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api";

export default function OperationsPage() {
  return <RequireAdmin><OperationsContent /></RequireAdmin>;
}

function OperationsContent() {
  const { token } = useAuth();
  const [marketOffset, setMarketOffset] = useState(0);
  const [offset, setOffset] = useState(0);
  const backlog = useQuery({
    queryKey: ["operations", token, offset], queryFn: () => api.operations(token!, offset),
    enabled: Boolean(token), refetchInterval: 5000, retry: false,
  });
  const markets = useQuery({ queryKey: ["markets", "processing", marketOffset],
    queryFn: () => api.markets({ phase: "processing", offset: marketOffset }), refetchInterval: 5000, retry: false });
  const pendingMarkets = markets.data?.items;
  const snapshot = backlog.data;
  const oldestAge = snapshot?.oldestPendingAt
    ? Math.max(0, Math.floor((Date.parse(snapshot.observedAt) - Date.parse(snapshot.oldestPendingAt)) / 1000)) : null;
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-fg">Operations</h1>
        <button onClick={() => { void backlog.refetch(); void markets.refetch(); }} disabled={backlog.isFetching || markets.isFetching}
          className="rounded-md border border-border-strong px-4 py-2 text-sm text-fg disabled:opacity-50">Refresh</button>
      </div>
      <p className="text-sm text-muted">Monitor pending coin transfers and recorded results. Recovery runs automatically; do not submit a different result to retry a payment.</p>
      {backlog.isPending && <p className="text-sm text-muted">Loading recovery backlog…</p>}
      {backlog.error && <p role="alert" className="text-sm text-danger">Cannot refresh recovery backlog. Any displayed snapshot may be stale. Check service readiness and try again.</p>}
      {snapshot && <>
        <p className="text-xs text-muted">Snapshot: {new Date(snapshot.observedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST · refreshes every 5 seconds</p>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Metric label="Pending debits" value={snapshot.pendingDebits} />
          <Metric label="Pending payouts or refunds" value={snapshot.pendingResolutions} />
          <Metric label="Oldest pending operation" value={oldestAge == null ? "None" : `${oldestAge} seconds`} />
        </dl>
        {oldestAge != null && oldestAge >= 300 && <p role="status" className="text-sm text-amber-500">An operation has been pending for at least five minutes. Check Wallet, Catalog, and Settlement readiness, then inspect logs using its market or operation ID.</p>}
        <h2 className="text-lg font-semibold text-fg">Recovery backlog</h2>
        <p className="text-xs text-muted">Oldest first. Counts cover all pending work; this table is paginated. Items can move between pages as recovery completes.</p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-muted"><tr><th className="p-3">Operation</th><th className="p-3">Market ID</th><th className="p-3">Coins</th><th className="p-3">Pending since (IST)</th><th className="p-3">Last update (IST)</th></tr></thead>
            <tbody>{snapshot.items.map(item => <tr key={`${item.kind}:${item.id}`} className="border-t border-border">
              <td className="p-3 text-fg">{item.kind}<span className="block font-mono text-xs text-muted">{item.id}</span></td>
              <td className="p-3 font-mono text-xs text-muted">{item.marketId}</td>
              <td className="p-3 text-fg">{item.amount}</td>
              <td className="p-3 text-muted">{formatTime(item.createdAt)}</td>
              <td className="p-3 text-muted">{formatTime(item.updatedAt)}</td>
            </tr>)}</tbody>
          </table>
          {snapshot.items.length === 0 && <p className="p-4 text-sm text-muted">{offset === 0 ? "No pending coin transfers." : "No items on this page. Return to the previous page."}</p>}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))} className="rounded border border-border px-3 py-2 disabled:opacity-40">Previous</button>
          <span>Page {Math.floor(offset / 50) + 1}</span>
          <button disabled={snapshot.nextOffset == null} onClick={() => setOffset(snapshot.nextOffset!)} className="rounded border border-border px-3 py-2 disabled:opacity-40">Next</button>
        </div>
      </>}
      <h2 className="text-lg font-semibold text-fg">Results awaiting completion</h2>
      <p className="text-xs text-muted">Catalog decisions can appear here before Settlement creates a payout plan. <Link href="/markets" className="text-accent underline">Manage markets</Link>.</p>
      {markets.error && <p role="alert" className="text-sm text-danger">Cannot refresh market decisions. Displayed results may be stale.</p>}
      {markets.isPending && <p className="text-sm text-muted">Loading recorded results…</p>}
      {pendingMarkets?.length === 0 && !markets.error && <p className="text-sm text-muted">{marketOffset === 0 ? "No results awaiting completion." : "No results on this page. Return to the previous page."}</p>}
      <div className="space-y-3">{pendingMarkets?.map(m => <article key={m.id} className="rounded-lg border border-border p-4">
        <h3 className="font-semibold text-fg">{m.title}</h3>
        <p className="text-sm text-muted">{m.status} · {m.resolutionRequestedAt ? formatTime(m.resolutionRequestedAt) + " IST" : "Request time unavailable"}</p>
        <p className="mt-1 text-xs text-muted">{m.resultSource}</p>
        <p className="mt-1 font-mono text-xs text-muted">{m.id}</p>
      </article>)}</div>
      <MarketPagination label="Result pages" offset={marketOffset} nextOffset={markets.data?.nextOffset ?? null}
        busy={markets.isFetching} onChange={setMarketOffset} />
    </section>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-border bg-surface p-4"><dt className="text-sm text-muted">{label}</dt><dd className="mt-2 text-2xl font-semibold text-fg">{value}</dd></div>;
}
function formatTime(value: string) { return new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }); }

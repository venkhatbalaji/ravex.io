"use client";

import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { api, ApiError, type Market } from "@/lib/api";
import { MarketFilterControls, MarketPagination, initialMarketFilters } from "@/components/market-filters";
import { RequireAdmin } from "@/components/require-admin";

const STATUS_STYLE: Record<Market["status"], string> = {
  open: "bg-accent/10 text-accent",
  locked: "bg-amber-500/10 text-amber-500",
  settled: "bg-surface-2 text-muted",
  cancelled: "bg-surface-2 text-muted",
  settling: "bg-amber-500/10 text-amber-500",
  refunding: "bg-amber-500/10 text-amber-500",
};

const fieldClass =
  "w-full rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent";

export default function MarketsPage() {
  return (
    <RequireAdmin>
      <MarketsContent />
    </RequireAdmin>
  );
}

function MarketsContent() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(initialMarketFilters);
  const { data: markets, isLoading, error: listError, isFetching, refetch } = useQuery({
    queryKey: ["markets", filters], queryFn: () => api.markets(filters), refetchInterval: 3000, retry: false,
  });
  const { data: categories, error: categoriesError } = useQuery({ queryKey: ["categories"], queryFn: () => api.categories() });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function categoryName(id: string | null) {
    if (!id) return "—";
    return categories?.find((c) => c.id === id)?.name ?? "—";
  }

  async function lock(id: string) {
    setError(null);
    try {
      await api.lockMarket(token!, id);
      queryClient.invalidateQueries({ queryKey: ["markets"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not lock the market.");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-fg">Markets</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md border border-border-strong px-4 py-1.5 text-sm text-muted transition hover:border-accent/40 hover:text-fg"
        >
          {showForm ? "Cancel" : "+ New market"}
        </button>
      </div>

      {showForm && (
        <CreateMarketForm
          categories={categories ?? []}
          onCreated={() => {
            setShowForm(false);
            setFilters({ ...initialMarketFilters });
            queryClient.invalidateQueries({ queryKey: ["markets"] });
          }}
        />
      )}

      <MarketFilterControls key={filters.search} filters={filters} onChange={setFilters} categories={categories ?? []} admin />
      {categoriesError && <p role="alert" className="text-sm text-danger">Categories are unavailable. Try refreshing the page.</p>}
      {listError && <p role="alert" className="text-sm text-danger">Cannot load markets. Any displayed results may be stale. <button onClick={() => void refetch()} className="underline">Try again</button></p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Event start</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {markets?.items.map((market) => (
              <tr key={market.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-fg">{market.title}</td>
                <td className="px-4 py-3 text-muted">{categoryName(market.categoryId)}</td>
                <td className="px-4 py-3 text-muted">{new Date(market.eventStartAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[market.status]}`}>
                    {market.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {market.status === "open" && (
                    <button onClick={() => lock(market.id)} className="text-xs text-accent hover:underline">
                      Lock
                    </button>
                  )}
                  {(market.status === "open" || market.status === "locked") && (
                    <ResolutionForm market={market} />
                  )}
                  {(market.status === "settling" || market.status === "refunding") && (
                    <p role="status" className="text-xs text-muted">Transferring coins. This page updates automatically.</p>
                  )}
                  {market.resultSource && (
                    <p className="mt-2 max-w-sm text-xs text-muted">
                      {market.resultSource}
                      {market.resolvedAt && <> · Completed {new Date(market.resolvedAt).toLocaleString()}</>}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {markets?.items.length === 0 && !isLoading && !listError && <p className="p-4 text-sm text-muted">No markets on this page. Clear the filters or return to the previous page.</p>}
      </div>
      <MarketPagination offset={filters.offset} nextOffset={markets?.nextOffset ?? null} busy={isFetching}
        onChange={offset => setFilters({ ...filters, offset })} />
    </div>
  );
}

function CreateMarketForm({
  categories,
  onCreated,
}: {
  categories: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [eventStartAt, setEventStartAt] = useState("");
  const [outcomeA, setOutcomeA] = useState("");
  const [outcomeB, setOutcomeB] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.createMarket(
        token!,
        title,
        new Date(eventStartAt).toISOString(),
        [outcomeA, outcomeB],
        categoryId || null,
      );
      setTitle("");
      setEventStartAt("");
      setOutcomeA("");
      setOutcomeB("");
      setCategoryId("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the market.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-border bg-surface p-5 sm:grid-cols-2">
      <label className="space-y-1.5 text-xs text-muted">
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required className={fieldClass} />
      </label>
      <label className="space-y-1.5 text-xs text-muted">
        <span>Event start</span>
        <input
          type="datetime-local"
          value={eventStartAt}
          onChange={(e) => setEventStartAt(e.target.value)}
          required
          className={fieldClass}
        />
      </label>
      <label className="space-y-1.5 text-xs text-muted">
        <span>Outcome A</span>
        <input value={outcomeA} onChange={(e) => setOutcomeA(e.target.value)} required className={fieldClass} />
      </label>
      <label className="space-y-1.5 text-xs text-muted">
        <span>Outcome B</span>
        <input value={outcomeB} onChange={(e) => setOutcomeB(e.target.value)} required className={fieldClass} />
      </label>
      <label className="space-y-1.5 text-xs text-muted sm:col-span-2">
        <span>Category (optional)</span>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={fieldClass}>
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="text-xs text-danger sm:col-span-2">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="justify-self-start rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:opacity-90 disabled:opacity-50 sm:col-span-2"
      >
        {submitting ? "Creating…" : "Create market"}
      </button>
    </form>
  );
}

function ResolutionForm({ market }: { market: Market }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [action, setAction] = useState("cancel");
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      if (action === "cancel") await api.cancelMarket(token!, market.id, source);
      else await api.settleMarket(token!, market.id, action, source);
      await queryClient.invalidateQueries({ queryKey: ["markets"] });
    } catch (err) { setError(err instanceof Error ? err.message : "Could not record the decision."); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="mt-2 min-w-60 space-y-2">
      <label className="block text-xs text-muted">Resolution
        <select aria-label={`Resolution for ${market.title}`} value={action} onChange={(e) => setAction(e.target.value)} disabled={busy} className={fieldClass}>
          <option value="cancel">Cancel and refund every stake</option>
          {market.status === "locked" && market.outcomes.map(o => <option key={o.id} value={o.id}>{o.label} wins</option>)}
        </select>
      </label>
      <label className="block text-xs text-muted">Result evidence or cancellation reason
        <input aria-label={`Evidence for ${market.title}`} value={source} onChange={(e) => setSource(e.target.value)} maxLength={500} required disabled={busy} className={fieldClass} />
      </label>
      <p className="text-xs text-muted">The recorded decision is final. Unbacked winning outcomes refund all stakes.</p>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <button disabled={busy} className="rounded-md bg-accent px-3 py-1.5 text-xs text-accent-fg disabled:opacity-50">{busy ? "Recording…" : action === "cancel" ? "Cancel and refund" : "Record result and pay"}</button>
    </form>
  );
}

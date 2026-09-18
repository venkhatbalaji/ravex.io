"use client";

import { useState, type FormEvent } from "react";
import type { MarketFilters } from "@/lib/api";

export const initialMarketFilters: MarketFilters = { search: "", categoryId: "", status: "", phase: "", offset: 0 };
const fieldClass = "rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-sm text-fg";

export function MarketFilterControls({ filters, onChange, categories, admin = false }: {
  filters: MarketFilters;
  onChange: (filters: MarketFilters) => void;
  categories: { id: string; name: string }[];
  admin?: boolean;
}) {
  const [search, setSearch] = useState(filters.search);
  function submit(event: FormEvent) {
    event.preventDefault();
    onChange({ ...filters, search: search.trim(), offset: 0 });
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3" aria-label="Market filters">
      <label className="flex flex-col gap-1 text-xs text-muted">Search markets
        <input type="search" maxLength={100} value={search} onChange={e => setSearch(e.target.value)} className={fieldClass} />
      </label>
      <button className={fieldClass}>Search</button>
      <label className="flex flex-col gap-1 text-xs text-muted">Filter by category
        <select value={filters.categoryId} onChange={e => onChange({ ...filters, categoryId: e.target.value, offset: 0 })} className={fieldClass}>
          <option value="">All categories</option>
          {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">Market phase
        <select value={filters.phase} onChange={e => onChange({ ...filters, phase: e.target.value, offset: 0 })} className={fieldClass}>
          <option value="">All phases</option>
          <option value="upcoming">Upcoming</option>
          <option value="live">Live / awaiting result</option>
          <option value="processing">Processing payouts</option>
          <option value="completed">Completed</option>
        </select>
      </label>
      {admin && <label className="flex flex-col gap-1 text-xs text-muted">Market status
        <select value={filters.status} onChange={e => onChange({ ...filters, status: e.target.value, offset: 0 })} className={fieldClass}>
          <option value="">All statuses</option>
          {["open", "locked", "settling", "refunding", "settled", "cancelled"].map(status => <option key={status} value={status}>{status}</option>)}
        </select>
      </label>}
      <button type="button" onClick={() => { setSearch(""); onChange({ ...initialMarketFilters }); }} className={fieldClass}>Clear filters</button>
    </form>
  );
}

export function MarketPagination({ offset, nextOffset, onChange, busy = false, label = "Market pages" }: {
  offset: number; nextOffset: number | null; onChange: (offset: number) => void; busy?: boolean; label?: string;
}) {
  return <nav aria-label={label} className="flex items-center gap-4 text-sm text-muted">
    <button disabled={offset === 0 || busy} onClick={() => onChange(Math.max(0, offset - 20))} className={`${fieldClass} disabled:opacity-40`}>Previous</button>
    <span>Page {Math.floor(offset / 20) + 1}</span>
    <button disabled={nextOffset == null || busy} onClick={() => { if (nextOffset != null) onChange(nextOffset); }} className={`${fieldClass} disabled:opacity-40`}>Next</button>
  </nav>;
}

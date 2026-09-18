# Market discovery and player cutoff controls

Player and Admin market lists now query Catalog with server-side search,
category/phase filters and pages of 20. Admin also exposes exact lifecycle status.
Changing a filter returns to page one. Both apps distinguish failed requests from
empty results and warn when a previously loaded list may be stale.

## API contract

`GET /markets/browse` is public through Gateway and directly on Catalog. It returns
`{ items: MarketDto[], nextOffset: number | null, observedAt: string }` with
`Cache-Control: no-store`.

| Parameter | Contract |
| --- | --- |
| `search` | Optional, up to 100 characters before trimming; case-insensitive literal substring of title or description. `%`, `_` and backslash are literal characters. |
| `categoryId` | Optional UUID; an unknown category returns an empty page. |
| `status` | Optional exact lifecycle name: open, locked, settling, refunding, settled, cancelled. Case-insensitive; unknown names and numeric enum values return 400. |
| `phase` | Optional upcoming, live, processing or completed; case-insensitive. |
| `limit` | Default 20; range 1–100. |
| `offset` | Default 0; range 0–1,000,000. |

All filters combine with AND. Invalid parameters return 400. Upcoming means open
or locked with an event start after the server's `observedAt`. Live means open or
locked with an event start at or before that time, including events still awaiting
a result. It does not imply a live sports feed. Processing means settling or
refunding; completed means settled or cancelled.

Ordering is event start descending, then market UUID ascending to break ties.
Filtering, sorting and pagination run in PostgreSQL. Catalog reads at most
`limit + 1` markets to detect the next page and uses a read-only query. Offset
pages are not an immutable snapshot: insertions, result changes and passing event
cutoffs can move records between pages. At the maximum supported offset there is
no next page; narrow the filters to find older records. Query/index capacity work
remains part of OPS-08.

The existing `GET /markets` preserves its array response shape and accepts the
same filters, with a default and maximum page size of 100. **It no longer returns
an unbounded catalog.** Consumers needing every result must migrate to
`/markets/browse` and follow `nextOffset`. Both repository frontends use the new
endpoint. Settlement continues to read individual markets by ID. Catalog's
internal recovery worker retains its existing query independently of public
pagination, so recovery is not limited to the first page.

Admin Operations uses `phase=processing` and its own page controls for recorded
results. It no longer downloads the catalog and filters it in the browser.

## Player behavior

Market cards, details and the Admin list display event starts explicitly in IST.
The detail page refreshes market state every five seconds and checks its local
clock each second. New submissions are disabled at cutoff, when a market closes,
or when market refresh fails. The submit handler checks the cutoff again;
Settlement remains the authoritative server-side admission check.

An uncertain request keeps its original idempotency key and can still be checked
after cutoff or closure. After any submission attempt the app refreshes market,
pool, balance and prediction queries. Pool copy explains that percentages can
change and are not a guaranteed payout, and that coins have no cash value.

Browser clock skew can make the local cutoff indicator early or late; it cannot
bypass server admission. Session renewal, fixtures, publication workflows,
rankings and telemetry remain separate pending requirements.

## Verification

Run `npm run test:ui` for the isolated backend/PostgreSQL and Chromium suite.
`services/tests/discovery_features.py` covers the default and maximum bounds,
101 equal-time records across pages, literal and case-insensitive search,
combined category/status/phase filters, empty pages, and invalid parameters at
Gateway and Catalog. An outage check verifies that processing decisions beyond
the unfiltered first page remain discoverable and recover when Wallet returns. Browser tests cover player/admin filtering and paging,
error recovery, automatic cutoff, and a lost-response retry after closure with
the same idempotency key and a single debit.

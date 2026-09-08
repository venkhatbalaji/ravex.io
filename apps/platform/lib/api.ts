const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:5100";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${GATEWAY_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.error ?? message;
    } catch {
      // no JSON body on this error — fall back to the status text
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface Outcome {
  id: string;
  label: string;
}

export interface Market {
  id: string;
  title: string;
  description: string;
  eventStartAt: string;
  status: "open" | "locked" | "settled";
  winningOutcomeId: string | null;
  outcomes: Outcome[];
}

export interface PoolSnapshot {
  marketId: string;
  totals: Record<string, number>;
  impliedOdds: Record<string, number>;
  totalPool: number;
}

export interface SettlementResult {
  marketId: string;
  winningOutcomeId: string;
  totalPool: number;
  winningPool: number;
  payoutRatio: number;
}

export interface LedgerEntry {
  amount: number;
  reason: string;
  createdAt: string;
}

export const api = {
  register: (email: string, password: string, displayName: string) =>
    request<{ id: string; email: string; displayName: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    }),
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: { id: string; email: string; displayName: string } }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: (token: string) => request<{ id: string; email: string }>("/me", {}, token),

  balance: (token: string) => request<{ balance: number }>("/wallet/me/balance", {}, token),
  ledger: (token: string) => request<LedgerEntry[]>("/wallet/me/ledger", {}, token),
  earn: (token: string, reason: string) =>
    request<{ credited: number; balance: number }>(
      "/wallet/me/earn",
      { method: "POST", body: JSON.stringify({ reason }) },
      token,
    ),

  markets: (status?: string) => request<Market[]>(`/markets${status ? `?status=${status}` : ""}`),
  market: (id: string) => request<Market>(`/markets/${id}`),
  createMarket: (title: string, eventStartAt: string, outcomes: string[]) =>
    request<Market>("/markets", {
      method: "POST",
      body: JSON.stringify({ title, eventStartAt, outcomes }),
    }),
  lockMarket: (id: string) => request<{ id: string; status: string }>(`/markets/${id}/lock`, { method: "POST" }),
  settleMarket: (id: string, winningOutcomeId: string) =>
    request<Market>(`/markets/${id}/settle`, {
      method: "POST",
      body: JSON.stringify({ winningOutcomeId }),
    }),

  pool: (marketId: string) => request<PoolSnapshot>(`/pools/${marketId}`),
  stake: (token: string, marketId: string, outcomeId: string, amount: number) =>
    request<PoolSnapshot>(
      `/pools/${marketId}/stakes`,
      { method: "POST", body: JSON.stringify({ outcomeId, amount }) },
      token,
    ),
  settlePool: (marketId: string, winningOutcomeId: string) =>
    request<SettlementResult>(`/pools/${marketId}/settle`, {
      method: "POST",
      body: JSON.stringify({ winningOutcomeId }),
    }),
};

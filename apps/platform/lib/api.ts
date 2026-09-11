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
  status: "open" | "locked" | "settling" | "refunding" | "settled" | "cancelled";
  winningOutcomeId: string | null;
  categoryId: string | null;
  resultSource: string;
  resolvedBy: string | null;
  resolutionRequestedAt: string | null;
  resolvedAt: string | null;
  outcomes: Outcome[];
}

export interface Theme {
  brandName: string;
  logoLightUrl: string;
  logoDarkUrl: string;
  accentColor: string;
  accent2Color: string;
  font: "Fredoka" | "Nunito" | "Poppins" | "SpaceGrotesk";
}

export interface CopyOverride {
  key: string;
  value: string;
}

export interface PoolSnapshot {
  marketId: string;
  totals: Record<string, number>;
  impliedOdds: Record<string, number>;
  totalPool: number;
}

export interface StakeSubmission extends PoolSnapshot {
  stake: {
    id: string;
    marketId: string;
    outcomeId: string;
    amount: number;
    state: "pending" | "accepted" | "rejected";
    createdAt: string;
    updatedAt: string;
  };
}

export interface LedgerEntry {
  amount: number;
  reason: string;
  createdAt: string;
}

export interface Prediction {
  id: string;
  marketId: string;
  outcomeId: string;
  amount: number;
  state: "pending" | "accepted" | "rejected";
  result: "pending" | "active" | "processing" | "won" | "lost" | "refunded" | "rejected";
  payout: number;
  createdAt: string;
}

export const api = {
  predictions: (token: string, offset = 0) =>
    request<{ items: Prediction[]; nextOffset: number | null }>(`/predictions/me?limit=20&offset=${offset}`, {}, token),
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

  pool: (marketId: string) => request<PoolSnapshot>(`/pools/${marketId}`),
  stake: (token: string, marketId: string, outcomeId: string, amount: number, idempotencyKey: string) =>
    request<StakeSubmission>(
      `/pools/${marketId}/stakes`,
      { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: JSON.stringify({ outcomeId, amount }) },
      token,
    ),

  theme: () => request<Theme>("/branding/theme"),
  copyOverrides: () => request<CopyOverride[]>("/branding/copy"),
};

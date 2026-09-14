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

export interface Category {
  id: string;
  name: string;
}

export interface Theme {
  brandName: string;
  logoLightUrl: string;
  logoDarkUrl: string;
  accentColor: string;
  accent2Color: string;
  font: "Fredoka" | "Nunito" | "Poppins" | "SpaceGrotesk";
}

export const SUPPORTED_FONTS: Theme["font"][] = ["Fredoka", "Nunito", "Poppins", "SpaceGrotesk"];

export interface CopyOverride {
  key: string;
  value: string;
}

export interface Operations {
  observedAt: string;
  pendingDebits: number;
  pendingResolutions: number;
  oldestPendingAt: string | null;
  items: { id: string; marketId: string; kind: "debit" | "payout" | "refund"; amount: number; createdAt: string; updatedAt: string }[];
  nextOffset: number | null;
}

export const api = {
  operations: (token: string, offset = 0) => request<Operations>(`/operations/settlement?limit=50&offset=${offset}`, {}, token),
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: { id: string; email: string; displayName: string; role: string } }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
    ),
  me: (token: string) => request<{ id: string; email: string; role: string }>("/me", {}, token),

  markets: (status?: string) => request<Market[]>(`/markets${status ? `?status=${status}` : ""}`),
  market: (id: string) => request<Market>(`/markets/${id}`),
  createMarket: (
    token: string,
    title: string,
    eventStartAt: string,
    outcomes: string[],
    categoryId: string | null,
  ) =>
    request<Market>(
      "/markets",
      { method: "POST", body: JSON.stringify({ title, eventStartAt, outcomes, categoryId }) },
      token,
    ),
  lockMarket: (token: string, id: string) =>
    request<{ id: string; status: string }>(`/markets/${id}/lock`, { method: "POST" }, token),
  settleMarket: (token: string, id: string, winningOutcomeId: string, source: string) =>
    request<Market>(`/markets/${id}/settle`, { method: "POST", body: JSON.stringify({ winningOutcomeId, source }) }, token),

  cancelMarket: (token: string, id: string, reason: string) =>
    request<Market>(`/markets/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }, token),

  categories: () => request<Category[]>("/categories"),
  createCategory: (token: string, name: string) =>
    request<Category>("/categories", { method: "POST", body: JSON.stringify({ name }) }, token),
  updateCategory: (token: string, id: string, name: string) =>
    request<Category>(`/categories/${id}`, { method: "PUT", body: JSON.stringify({ name }) }, token),
  deleteCategory: (token: string, id: string) =>
    request<void>(`/categories/${id}`, { method: "DELETE" }, token),

  theme: () => request<Theme>("/branding/theme"),
  updateTheme: (token: string, theme: Theme) =>
    request<Theme>("/branding/theme", { method: "PUT", body: JSON.stringify(theme) }, token),

  copyOverrides: () => request<CopyOverride[]>("/branding/copy"),
  upsertCopyOverride: (token: string, key: string, value: string) =>
    request<CopyOverride>(`/branding/copy/${encodeURIComponent(key)}`, { method: "PUT", body: JSON.stringify({ value }) }, token),
  deleteCopyOverride: (token: string, key: string) =>
    request<void>(`/branding/copy/${encodeURIComponent(key)}`, { method: "DELETE" }, token),
};

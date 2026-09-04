import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { chatUsageEvents } from "@/db/schema";

function requiredIntEnv(name: string, fallback: number) {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getDailyTokenQuota() {
  return requiredIntEnv("CHAT_DAILY_TOKEN_QUOTA", 20_000);
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export type UsageSummary = { used: number; quota: number; resetsAt: string };

export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const quota = getDailyTokenQuota();
  const todayStart = startOfUtcDay();
  const resetsAt = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const [row] = await getDb()
    .select({ used: sql<number>`coalesce(sum(${chatUsageEvents.promptTokens} + ${chatUsageEvents.completionTokens}), 0)` })
    .from(chatUsageEvents)
    .where(and(eq(chatUsageEvents.userId, userId), gte(chatUsageEvents.createdAt, todayStart)));

  return { used: Number(row?.used ?? 0), quota, resetsAt };
}

export async function isOverQuota(userId: string) {
  const summary = await getUsageSummary(userId);
  return summary.used >= summary.quota;
}

export async function recordUsage(params: {
  userId: string;
  conversationId: string | null;
  promptTokens: number;
  completionTokens: number;
  model: string;
}) {
  await getDb().insert(chatUsageEvents).values({
    id: crypto.randomUUID(),
    userId: params.userId,
    conversationId: params.conversationId,
    promptTokens: params.promptTokens,
    completionTokens: params.completionTokens,
    model: params.model,
  });
}

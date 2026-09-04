import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { chatConversations, chatMessages } from "@/db/schema";

const HISTORY_LIMIT = 20;
const TITLE_LIMIT = 48;

/** Untitled (never-chatted-in) conversations are left out — the client only ever shows its own current draft, never someone else's abandoned empty chats. */
export async function listConversations(userId: string) {
  const db = getDb();
  return db
    .select({ id: chatConversations.id, title: chatConversations.title, updatedAt: chatConversations.updatedAt })
    .from(chatConversations)
    .where(and(eq(chatConversations.userId, userId), isNotNull(chatConversations.title)))
    .orderBy(desc(chatConversations.updatedAt));
}

export async function createConversation(userId: string) {
  const db = getDb();
  const [created] = await db
    .insert(chatConversations)
    .values({ id: crypto.randomUUID(), userId })
    .returning();
  return created;
}

export async function getOrCreateConversation(userId: string) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.userId, userId))
    .orderBy(desc(chatConversations.updatedAt))
    .limit(1);
  if (existing) return existing;
  return createConversation(userId);
}

/** Fetches a conversation only if it belongs to the given user — for ownership checks before use. */
export async function getConversationForUser(conversationId: string, userId: string) {
  const db = getDb();
  const [conversation] = await db
    .select()
    .from(chatConversations)
    .where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId)))
    .limit(1);
  return conversation ?? null;
}

export async function getRecentMessages(conversationId: string, limit = HISTORY_LIMIT) {
  const db = getDb();
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
  return rows.reverse();
}

export async function getAllMessages(conversationId: string) {
  const db = getDb();
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(asc(chatMessages.createdAt));
}

export async function insertMessage(params: { conversationId: string; role: "user" | "assistant"; content: string }) {
  const db = getDb();
  const [row] = await db
    .insert(chatMessages)
    .values({ id: crypto.randomUUID(), conversationId: params.conversationId, role: params.role, content: params.content })
    .returning();
  await db
    .update(chatConversations)
    .set({ updatedAt: new Date() })
    .where(eq(chatConversations.id, params.conversationId));
  return row;
}

/** Titles a conversation from its first message, once, so the sidebar has something to show. */
export async function ensureConversationTitle(conversationId: string, firstMessage: string) {
  const title = firstMessage.length > TITLE_LIMIT ? `${firstMessage.slice(0, TITLE_LIMIT).trimEnd()}…` : firstMessage;
  const db = getDb();
  await db
    .update(chatConversations)
    .set({ title })
    .where(and(eq(chatConversations.id, conversationId), isNull(chatConversations.title)));
}

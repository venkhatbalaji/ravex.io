import { APICallError } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured. Copy apps/web/.env.example to apps/web/.env.local.`);
  return value;
}

export const SYSTEM_PROMPT =
  "You are the Ravex assistant. Answer clearly and concisely, and say when you're not sure about something.";

let provider: ReturnType<typeof createGoogleGenerativeAI> | undefined;

function getProvider() {
  provider ??= createGoogleGenerativeAI({ apiKey: requiredEnv("GEMINI_API_KEY") });
  return provider;
}

export function getChatModel() {
  return getProvider().chat(process.env.GEMINI_MODEL_ID ?? "gemini-flash-latest");
}

export type ChatHistoryMessage = { role: "user" | "assistant"; content: string };

export function buildMessages(history: ChatHistoryMessage[], newUserMessage: string): ChatHistoryMessage[] {
  return [...history, { role: "user", content: newUserMessage }];
}

/** Maps a streamText/model error to a message safe to show the end user. */
export function describeModelError(error: unknown) {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 503 || error.isRetryable) return "The assistant is temporarily overloaded. Please try again in a moment.";
    if (error.statusCode === 429) return "The assistant is rate-limited right now. Please try again shortly.";
    if (error.statusCode === 401 || error.statusCode === 403) return "The assistant is misconfigured (invalid API key). Please contact support.";
  }
  return "Something went wrong while generating a reply. Please try again.";
}

export function getMaxOutputTokens() {
  const raw = process.env.CHAT_MAX_OUTPUT_TOKENS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 512;
}

/**
 * Gemini 3's "thinking" tokens are billed as completion tokens and can dwarf the visible
 * reply (e.g. ~256 tokens for a 4-word answer) — capping this is the highest-leverage way
 * to cut per-message cost. 0 disables thinking outright on models that allow it; if the
 * configured model rejects 0, raise GEMINI_THINKING_BUDGET rather than removing this.
 */
export function getThinkingBudget() {
  const raw = process.env.GEMINI_THINKING_BUDGET;
  const parsed = raw !== undefined ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

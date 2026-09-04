import { NextResponse } from "next/server";
import { z } from "zod";
import { streamText } from "ai";
import { getSession } from "@/lib/session";
import { getChatModel, buildMessages, getMaxOutputTokens, getThinkingBudget, SYSTEM_PROMPT, describeModelError } from "@/lib/llm";
import { getConversationForUser, getRecentMessages, insertMessage, ensureConversationTitle } from "@/lib/conversations";
import { isOverQuota, getUsageSummary, recordUsage } from "@/lib/usage";

const chatRequestSchema = z.object({ message: z.string().trim().min(1).max(4000), conversationId: z.string().min(1) });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to chat." }, { status: 401 });

  const userId = session.user.id;

  try {
    const body = chatRequestSchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });

    if (await isOverQuota(userId)) {
      const usage = await getUsageSummary(userId);
      return NextResponse.json({ error: "Daily quota reached. Try again after it resets.", usage }, { status: 429 });
    }

    const conversation = await getConversationForUser(body.data.conversationId, userId);
    if (!conversation) return NextResponse.json({ error: "Chat not found." }, { status: 404 });

    const history = await getRecentMessages(conversation.id);
    const modelMessages = buildMessages(
      history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      body.data.message,
    );
    if (history.length === 0) await ensureConversationTitle(conversation.id, body.data.message);
    await insertMessage({ conversationId: conversation.id, role: "user", content: body.data.message });

    const model = process.env.GEMINI_MODEL_ID ?? "gemini-flash-latest";
    const result = streamText({
      model: getChatModel(),
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      maxOutputTokens: getMaxOutputTokens(),
      providerOptions: { google: { thinkingConfig: { thinkingBudget: getThinkingBudget() } } },
      onEnd: async (event) => {
        try {
          await insertMessage({ conversationId: conversation.id, role: "assistant", content: event.text });
          await recordUsage({
            userId,
            conversationId: conversation.id,
            promptTokens: event.usage.inputTokens ?? 0,
            completionTokens: event.usage.outputTokens ?? 0,
            model,
          });
        } catch (error) {
          console.error("Failed to persist chat exchange", error);
        }
      },
    });

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        console.error("Chat stream error", error);
        return describeModelError(error);
      },
    });
  } catch (error) {
    console.error("Chat request failed", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

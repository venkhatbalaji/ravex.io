import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { ChatShell } from "@/components/chat-shell";
import { requireSession } from "@/lib/session";
import { getAllMessages, getOrCreateConversation, listConversations } from "@/lib/conversations";
import { getUsageSummary } from "@/lib/usage";

export const metadata: Metadata = { title: "Chat", description: "Chat with the Ravex assistant.", alternates: { canonical: "/chat" } };

export default async function ChatPage() {
  const session = await requireSession();
  const conversation = await getOrCreateConversation(session.user.id);
  const [messages, usage, conversations] = await Promise.all([
    getAllMessages(conversation.id),
    getUsageSummary(session.user.id),
    listConversations(session.user.id),
  ]);

  const initialMessages = messages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    parts: [{ type: "text" as const, text: m.content }],
  }));

  // listConversations() omits untitled (never-chatted-in) conversations — if the active one
  // is still untitled (brand new user, or a fresh "New chat" reload), add it back in so the
  // sidebar always shows the chat you're currently looking at.
  const sidebarConversations = conversations.some((c) => c.id === conversation.id)
    ? conversations
    : [{ id: conversation.id, title: conversation.title, updatedAt: conversation.updatedAt }, ...conversations];

  return (
    <main className="inner-page">
      <Nav />
      <section className="chat-page">
        <ChatShell
          activeConversationId={conversation.id}
          initialConversations={sidebarConversations.map((c) => ({ ...c, updatedAt: c.updatedAt.toISOString() }))}
          initialMessages={initialMessages}
          initialUsage={usage}
        />
      </section>
    </main>
  );
}

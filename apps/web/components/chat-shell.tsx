"use client";

import { useState } from "react";
import type { UIMessage } from "ai";
import { ChatSidebar, type ConversationSummary } from "@/components/chat-sidebar";
import { ChatPanel } from "@/components/chat-panel";
import type { UsageSummary } from "@/lib/usage";

type DbMessage = { id: string; role: string; content: string };

function toUIMessages(messages: DbMessage[]): UIMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    parts: [{ type: "text" as const, text: m.content }],
  }));
}

export function ChatShell({
  activeConversationId,
  initialConversations,
  initialMessages,
  initialUsage,
}: {
  activeConversationId: string;
  initialConversations: ConversationSummary[];
  initialMessages: UIMessage[];
  initialUsage: UsageSummary;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState(activeConversationId);
  const [activeMessages, setActiveMessages] = useState(initialMessages);
  const [usage, setUsage] = useState(initialUsage);
  const [switching, setSwitching] = useState(false);

  async function refreshConversations() {
    try {
      const res = await fetch("/api/chat/conversations");
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations);
    } catch {
      // best-effort — sidebar just won't reorder/retitle until next refresh
    }
  }

  async function selectConversation(id: string) {
    if (id === activeId || switching) return;
    setSwitching(true);
    try {
      const res = await fetch(`/api/chat/conversations/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setActiveMessages(toUIMessages(data.messages));
      setActiveId(id);
    } finally {
      setSwitching(false);
    }
  }

  async function startNewChat() {
    if (switching) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/chat/conversations", { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      // Drop any previous untitled draft (an abandoned "New chat" nobody sent a message
      // in) so the list never shows more than one "New chat" placeholder at a time.
      setConversations((prev) => [
        { id: data.conversation.id, title: null, updatedAt: data.conversation.updatedAt },
        ...prev.filter((c) => c.title !== null),
      ]);
      setActiveMessages([]);
      setActiveId(data.conversation.id);
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className={sidebarOpen ? "chat-shell" : "chat-shell chat-shell-collapsed"}>
      <ChatSidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        conversations={conversations}
        activeId={activeId}
        onSelect={selectConversation}
        onNewChat={startNewChat}
      />
      <ChatPanel
        key={activeId}
        conversationId={activeId}
        initialMessages={activeMessages}
        usage={usage}
        onUsageChange={setUsage}
        onExchangeComplete={refreshConversations}
      />
    </div>
  );
}

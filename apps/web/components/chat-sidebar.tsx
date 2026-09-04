"use client";

export type ConversationSummary = { id: string; title: string | null; updatedAt: string };

function formatDate(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ChatSidebar({
  open,
  onToggle,
  conversations,
  activeId,
  onSelect,
  onNewChat,
}: {
  open: boolean;
  onToggle: () => void;
  conversations: ConversationSummary[];
  activeId: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}) {
  return (
    <aside className="chat-sidebar" aria-label="Chat history">
      <div className="chat-sidebar-header">
        <button type="button" className="chat-sidebar-toggle" onClick={onToggle} aria-expanded={open} aria-label={open ? "Collapse chat history" : "Expand chat history"}>
          <span />
          <span />
          <span />
        </button>
        {open && <button type="button" className="chat-sidebar-new" onClick={onNewChat}>New chat</button>}
      </div>
      {open && (
        <nav className="chat-sidebar-list" aria-label="Previous chats">
          {conversations.length === 0 && <p className="chat-sidebar-empty">No chats yet.</p>}
          {conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              className={c.id === activeId ? "chat-sidebar-item chat-sidebar-item-active" : "chat-sidebar-item"}
              onClick={() => onSelect(c.id)}
            >
              <span className="chat-sidebar-item-title">{c.title ?? "New chat"}</span>
              <span className="chat-sidebar-item-date">{formatDate(c.updatedAt)}</span>
            </button>
          ))}
        </nav>
      )}
    </aside>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import type { UsageSummary } from "@/lib/usage";

function messageText(message: UIMessage) {
  return message.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
}

// Errors from a pre-stream failure (401/429/500 JSON responses) arrive as the raw
// response body text; in-stream failures arrive as the plain message our API route's
// onError already made user-friendly. Try to unwrap the former, pass the latter through.
function friendlyError(message: string) {
  try {
    const parsed = JSON.parse(message);
    if (typeof parsed?.error === "string") return parsed.error;
  } catch {
    // not JSON — already a plain message
  }
  return message;
}

export function ChatPanel({
  conversationId,
  initialMessages,
  usage,
  onUsageChange,
  onExchangeComplete,
}: {
  conversationId: string;
  initialMessages: UIMessage[];
  usage: UsageSummary;
  onUsageChange: (usage: UsageSummary) => void;
  onExchangeComplete: () => void;
}) {
  const [input, setInput] = useState("");

  const { messages, sendMessage, regenerate, status, error } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages: current }) => ({
        body: { message: messageText(current[current.length - 1]), conversationId },
      }),
    }),
    onFinish: () => {
      fetch("/api/chat/usage")
        .then((res) => res.json())
        .then(onUsageChange)
        .catch(() => {});
      onExchangeComplete();
    },
  });

  const overQuota = usage.used >= usage.quota;
  const nearQuota = !overQuota && usage.used >= usage.quota * 0.8;
  const busy = status === "submitted" || status === "streaming";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy || overQuota) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <div className="chat-panel">
      <div className={overQuota ? "usage-meter usage-meter-blocked" : nearQuota ? "usage-meter usage-meter-warning" : "usage-meter"}>
        <span>{usage.used.toLocaleString()} / {usage.quota.toLocaleString()} tokens today</span>
        {overQuota && <span>Daily quota reached — resets at midnight UTC.</span>}
      </div>

      <div className="chat-messages" role="log">
        {messages.length === 0 && <p className="chat-empty">Ask the Ravex assistant anything to get started.</p>}
        {messages.map((message) => (
          <div key={message.id} className={`chat-message chat-message-${message.role}`}>
            <p>{messageText(message)}</p>
          </div>
        ))}
      </div>

      <form className="chat-input-row" onSubmit={submit}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={overQuota ? "Daily quota reached" : "Send a message…"}
          rows={2}
          maxLength={4000}
          disabled={overQuota}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button className="submit-button" disabled={busy || overQuota || !input.trim()}>
          {busy ? "Sending…" : "Send"}
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {friendlyError(error.message)}{" "}
          <button type="button" className="retry-link" onClick={() => regenerate()}>Try again</button>
        </p>
      )}
    </div>
  );
}

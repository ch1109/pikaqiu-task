import { useEffect, useRef } from "react";
import ChatMessageItem from "./ChatMessage";
import type { ChatMessage } from "@/types/chat";

interface ChatHistoryProps {
  messages: ChatMessage[];
  loading?: boolean;
}

export default function ChatHistory({ messages, loading }: ChatHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {messages.length === 0 && !loading && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            color: "var(--text-muted)",
          }}
        >
          <div style={{ fontSize: 28 }}>🤖</div>
          <div
            style={{
              fontSize: 13,
              fontFamily: "var(--font-body)",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            嗨! 告诉我你今天的计划
            <br />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              比如: "上午写周报，下午3点开会，晚上健身"
            </span>
          </div>
        </div>
      )}

      {messages.map((msg, i) => (
        <ChatMessageItem
          key={msg.id}
          role={msg.role}
          content={msg.content}
          index={i}
        />
      ))}

      {loading && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            padding: "3px 0",
          }}
        >
          <div
            className="animate-neon-pulse"
            style={{
              padding: "8px 16px",
              borderRadius: "14px 14px 14px 4px",
              background: "rgba(0, 240, 255, 0.08)",
              border: "1px solid rgba(0, 240, 255, 0.15)",
              fontSize: 12,
              color: "var(--cyan-dim)",
              fontFamily: "var(--font-display)",
              letterSpacing: "0.05em",
            }}
          >
            思考中...
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

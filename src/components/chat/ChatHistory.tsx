import { useEffect, useRef } from "react";
import ChatMessageItem from "./ChatMessage";
import SectionMasthead from "@/components/shared/SectionMasthead";
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
        padding: "20px 22px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {messages.length === 0 && !loading && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            gap: 18,
            position: "relative",
          }}
        >
          {/* 章节刊头 */}
          <SectionMasthead variant="dialogue" subtitle="开启一场新对话" />

          {/* 大号问候 */}
          <div
            className="animate-ink"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 4,
              animationDelay: "140ms",
            }}
          >
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: 26,
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
                color: "var(--ink-900)",
                margin: 0,
              }}
            >
              你好呀 👋
            </h1>
            <span
              style={{
                fontSize: 15,
                color: "var(--ink-500)",
                lineHeight: 1.55,
              }}
            >
              有什么我可以帮你的吗？聊天、问问题，或者规划今天的任务
            </span>
          </div>

          {/* 示例卡片 */}
          <div
            className="stagger-child"
            style={{
              "--stagger-index": 2,
              marginTop: 8,
              padding: "14px 18px",
              background: "var(--paper-0)",
              border: "1px solid var(--rule-line)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-paper-low)",
              fontSize: 13,
              lineHeight: 1.65,
              color: "var(--ink-600)",
              maxWidth: 300,
            } as React.CSSProperties}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "var(--vermilion-600)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              试试看
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span>💬 帮我把这段话翻译成英文</span>
              <span>📋 上午写周报，下午 3 点开会，晚上健身</span>
            </div>
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
            style={{
              borderRadius: "var(--radius-lg)",
              background: "var(--paper-0)",
              border: "1px solid var(--rule-line)",
              padding: "8px 14px",
              boxShadow: "var(--shadow-paper-low)",
            }}
          >
            <div className="typing-dots">
              <span /><span /><span />
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

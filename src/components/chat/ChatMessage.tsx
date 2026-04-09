import type { ChatRole } from "@/types/chat";

interface ChatMessageProps {
  role: ChatRole;
  content: string;
  index: number;
}

export default function ChatMessage({ role, content, index }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className="animate-card-enter"
      style={{
        "--i": index,
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        padding: "3px 0",
      } as React.CSSProperties}
    >
      <div
        style={{
          maxWidth: "82%",
          padding: "8px 13px",
          borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
          background: isUser
            ? "rgba(255, 60, 172, 0.12)"
            : "rgba(0, 240, 255, 0.08)",
          border: isUser
            ? "1px solid rgba(255, 60, 172, 0.2)"
            : "1px solid rgba(0, 240, 255, 0.15)",
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--text-primary)",
          fontFamily: "var(--font-body)",
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
        }}
      >
        {!isUser && (
          <div
            style={{
              fontSize: 10,
              fontFamily: "var(--font-display)",
              color: "var(--cyan-dim)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 3,
            }}
          >
            CyberPet
          </div>
        )}
        {content}
      </div>
    </div>
  );
}

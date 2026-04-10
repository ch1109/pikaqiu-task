import type { ChatRole } from "@/types/chat";
import Icon from "@/components/shared/Icon";

interface ChatMessageProps {
  role: ChatRole;
  content: string;
  index: number;
}

/** 简单 Markdown 渲染：**粗体**、💡提示行（改为 lucide lightbulb）、列表编号 */
function renderContent(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const trimmed = line.trimStart();
    const isHint = trimmed.startsWith("💡");
    const stripped = isHint ? trimmed.replace(/^💡\s*/, "") : line;
    const isNumbered = /^\d+\./.test(trimmed);

    const parts = stripped.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={j} style={{ color: "var(--ink-900)", fontWeight: 700 }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });

    return (
      <div
        key={i}
        style={{
          minHeight: line.trim() === "" ? 8 : undefined,
          paddingLeft: isHint ? 16 : isNumbered ? 4 : 0,
          color: isHint ? "var(--amber-600)" : undefined,
          fontSize: isHint ? 12 : undefined,
          position: "relative",
          display: isHint ? "flex" : undefined,
          alignItems: isHint ? "baseline" : undefined,
          gap: isHint ? 6 : undefined,
        }}
      >
        {isHint && (
          <span style={{ display: "inline-flex", alignSelf: "center" }}>
            <Icon name="lightbulb" size="xs" color="var(--amber-600)" />
          </span>
        )}
        <span>{rendered}</span>
      </div>
    );
  });
}

export default function ChatMessage({ role, content, index }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={isUser ? "animate-message-send" : "animate-card-enter"}
      style={{
        "--i": index,
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        padding: "4px 0",
      } as React.CSSProperties}
    >
      <div
        style={{
          maxWidth: "78%",
          padding: "14px 18px",
          borderRadius: "var(--radius-lg)",
          background: isUser ? "var(--vermilion-600)" : "var(--paper-0)",
          border: isUser ? "none" : "1px solid var(--rule-line)",
          fontSize: 14,
          lineHeight: 1.7,
          color: isUser ? "#FFFFFF" : "var(--ink-800)",
          fontFamily: "var(--font-body)",
          wordBreak: "break-word",
          boxShadow: isUser
            ? "0 4px 14px rgba(46, 111, 235, 0.22)"
            : "var(--shadow-paper-low)",
        }}
      >
        {!isUser && (
          <div
            className="smallcaps"
            style={{
              fontSize: 10,
              color: "var(--vermilion-600)",
              letterSpacing: "0.1em",
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 5,
                height: 5,
                borderRadius: 999,
                background: "var(--vermilion-600)",
              }}
            />
            CYBERPET
          </div>
        )}
        {isUser ? content : renderContent(content)}
      </div>
    </div>
  );
}

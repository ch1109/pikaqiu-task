import { useState, useRef, useCallback } from "react";

const MAX_CHARS = 2000;

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = "告诉我你今天要做什么...",
}: ChatInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= MAX_CHARS) {
      setText(val);
    }
    // 自动高度
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
  };

  return (
    <div
      style={{
        padding: "8px 12px 10px",
        borderTop: "1px solid rgba(0, 240, 255, 0.08)",
        flexShrink: 0,
      }}
    >
      <div
        className="neon-hover-cyan"
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          background: "var(--bg-input)",
          border: "var(--border-glow)",
          borderRadius: "var(--radius-md)",
          padding: "8px 10px",
          transition: "var(--transition-fast)",
        }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            color: "var(--text-primary)",
            fontSize: 13,
            fontFamily: "var(--font-body)",
            lineHeight: 1.5,
            resize: "none",
            outline: "none",
            maxHeight: 120,
            minHeight: 20,
          }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          style={{
            width: 32,
            height: 32,
            flexShrink: 0,
            border: "none",
            borderRadius: "var(--radius-sm)",
            background:
              disabled || !text.trim()
                ? "rgba(0, 240, 255, 0.06)"
                : "rgba(0, 240, 255, 0.15)",
            color:
              disabled || !text.trim()
                ? "var(--text-muted)"
                : "var(--cyan-glow)",
            fontSize: 15,
            cursor: disabled || !text.trim() ? "not-allowed" : "pointer",
            transition: "var(--transition-fast)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => {
            if (!disabled && text.trim())
              e.currentTarget.style.background = "rgba(0, 240, 255, 0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              disabled || !text.trim()
                ? "rgba(0, 240, 255, 0.06)"
                : "rgba(0, 240, 255, 0.15)";
          }}
        >
          ▶
        </button>
      </div>
      {text.length > MAX_CHARS * 0.8 && (
        <div
          className="text-mono"
          style={{
            textAlign: "right",
            marginTop: 4,
            color:
              text.length >= MAX_CHARS
                ? "var(--coral-warn)"
                : "var(--text-muted)",
            fontSize: 10,
          }}
        >
          {text.length}/{MAX_CHARS}
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useCallback } from "react";
import Icon from "@/components/shared/Icon";

const MAX_CHARS = 2000;

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = "整段描述今天的计划，让 AI 帮你规划…",
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

  const hasText = text.trim().length > 0;

  return (
    <div
      style={{
        padding: "14px 20px 18px",
        background: "var(--paper-1)",
        flexShrink: 0,
        borderTop: "1px solid var(--rule-line)",
      }}
    >
      <div
        className="input-container"
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          background: "var(--paper-0)",
          border: "1px solid var(--ink-200)",
          borderRadius: "var(--radius-md)",
          padding: "12px 14px",
          transition: "border-color 180ms ease, box-shadow 180ms ease",
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
            fontSize: 14,
            fontFamily: "var(--font-body)",
            lineHeight: 1.65,
            resize: "none",
            outline: "none",
            maxHeight: 120,
            minHeight: 22,
          }}
        />
        <button
          className="btn btn-icon"
          onClick={handleSend}
          disabled={disabled || !hasText}
          style={{
            width: 34,
            height: 34,
            flexShrink: 0,
            borderRadius: 999,
            background: hasText && !disabled
              ? "var(--vermilion-600)"
              : "var(--vermilion-100)",
            color: hasText && !disabled
              ? "#FFFFFF"
              : "var(--vermilion-600)",
            boxShadow: hasText && !disabled
              ? "0 4px 14px rgba(46, 111, 235, 0.28)"
              : "none",
            transition: "background 180ms ease, box-shadow 180ms ease, transform 120ms ease",
          }}
        >
          <Icon name="send-horizontal" size="sm" accent color="currentColor" />
        </button>
      </div>
      {text.length > MAX_CHARS * 0.8 && (
        <div
          className="text-mono"
          style={{
            textAlign: "right",
            marginTop: 6,
            color:
              text.length >= MAX_CHARS
                ? "var(--seal-red)"
                : "var(--text-muted)",
            fontSize: 11,
            letterSpacing: "-0.01em",
          }}
        >
          {text.length}/{MAX_CHARS}
        </div>
      )}
    </div>
  );
}

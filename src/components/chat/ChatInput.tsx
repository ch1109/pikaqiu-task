import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Icon from "@/components/shared/Icon";
import SkillAutocomplete from "@/components/chat/SkillAutocomplete";
import { useSkillStore } from "@/stores/useSkillStore";
import { extractSkillQuery, matchSkillsByPrefix } from "@/services/skillParser";
import type { Skill } from "@/types/skill";

const MAX_CHARS = 2000;

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = "问我任何问题，或描述今天的任务…",
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [autocompleteSuppressed, setAutocompleteSuppressed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { skills, loadAll } = useSkillStore();

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // 当前补全查询
  const skillQuery = useMemo(() => extractSkillQuery(text), [text]);
  const autocompleteOpen =
    !autocompleteSuppressed && skillQuery !== null && !disabled;

  // 当前匹配结果（仅用来判断键盘事件是否应该拦截）
  const matched = useMemo<Skill[]>(() => {
    if (!autocompleteOpen) return [];
    return matchSkillsByPrefix(skillQuery ?? "", skills, 6);
  }, [autocompleteOpen, skillQuery, skills]);

  // query 变化时重置索引；text 离开 `/` 开头时解除 suppress
  useEffect(() => {
    setActiveIndex(0);
  }, [skillQuery]);

  useEffect(() => {
    if (!text.startsWith("/")) setAutocompleteSuppressed(false);
  }, [text]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSend]);

  const fillSkill = useCallback((skill: Skill) => {
    const next = `/${skill.name} `;
    setText(next);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(next.length, next.length);
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    });
    setAutocompleteSuppressed(true); // 填充后关闭补全，避免继续弹
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 补全打开时的键盘分支优先
    if (autocompleteOpen && matched.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % matched.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + matched.length) % matched.length);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        fillSkill(matched[activeIndex]);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        fillSkill(matched[activeIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setAutocompleteSuppressed(true);
        return;
      }
    }
    // 常规发送
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
          position: "relative", // autocomplete absolute 定位的锚点
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
        {autocompleteOpen && (
          <SkillAutocomplete
            query={skillQuery ?? ""}
            skills={skills}
            activeIndex={activeIndex}
            onActiveChange={setActiveIndex}
            onSelect={fillSkill}
          />
        )}
        <textarea
          ref={textareaRef}
          className="chat-input-textarea"
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

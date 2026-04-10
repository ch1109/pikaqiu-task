import { useRef, useState, KeyboardEvent } from "react";
import Icon from "@/components/shared/Icon";

interface QuickAddInputProps {
  onAdd: (name: string) => void | Promise<void>;
  /** 自动聚焦（用于空列表态） */
  autoFocus?: boolean;
}

/**
 * 苹果提醒事项风格的快速添加行：
 * 左侧虚线圆圈占位，右侧单行输入框；
 * Enter 提交并清空保持聚焦，Esc 失焦。
 */
export default function QuickAddInput({ onAdd, autoFocus }: QuickAddInputProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setValue("");
    await onAdd(trimmed);
    // 提交后保持聚焦以继续输入
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      inputRef.current?.blur();
    }
  };

  return (
    <div
      className="quick-add"
      onClick={() => inputRef.current?.focus()}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 18px",
        background: "var(--paper-0)",
        border: focused
          ? "1px solid var(--vermilion-600)"
          : "1px solid var(--ink-200)",
        borderRadius: "var(--radius-md)",
        cursor: "text",
        transition:
          "border-color 180ms ease, box-shadow 200ms ease",
        boxShadow: focused
          ? "0 0 0 3px var(--vermilion-200)"
          : "var(--shadow-paper-low)",
      }}
    >
      {/* 圆形占位标记 */}
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 999,
          border: focused
            ? "1.5px solid var(--vermilion-600)"
            : "1.5px dashed var(--ink-300)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "border-color 180ms ease",
          color: "var(--vermilion-600)",
        }}
      >
        {focused && (
          <Icon name="plus" size={12} color="var(--vermilion-600)" />
        )}
      </div>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        placeholder="添加任务……回车继续"
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          fontSize: 14,
          lineHeight: 1.5,
          fontFamily: "var(--font-body)",
          color: "var(--text-primary)",
          padding: 0,
          minWidth: 0,
        }}
      />

      {value.trim().length > 0 && (
        <span
          style={{
            display: "inline-flex",
            color: "var(--ink-500)",
            opacity: 0.85,
            flexShrink: 0,
          }}
        >
          <Icon name="corner-down-left" size={12} color="var(--ink-500)" />
        </span>
      )}
    </div>
  );
}

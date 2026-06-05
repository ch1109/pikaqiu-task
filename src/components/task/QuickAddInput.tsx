import { useRef, useState, KeyboardEvent } from "react";
import Icon from "@/components/shared/Icon";

interface QuickAddInputProps {
  onAdd: (name: string) => void | Promise<void>;
  /** 自动聚焦（用于空列表态） */
  autoFocus?: boolean;
}

/**
 * 高级简约 · 快速添加行：
 * 圆角矩形容器，左侧 ＋ 图标，单行输入；Enter 提交并清空保持聚焦，Esc 失焦。
 * 说明：本输入仅创建任务（不解析 /命令/技能，那是对话面板的能力），占位文案据此如实书写。
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
        gap: 10,
        padding: "9px 14px",
        background: "var(--surface-card)",
        border: focused
          ? "1px solid var(--brand-600)"
          : "1px solid var(--surface-edge)",
        borderRadius: 12,
        cursor: "text",
        transition: "border-color 180ms ease, box-shadow 200ms ease",
        boxShadow: focused ? "var(--focus-ring)" : "var(--shadow-sm)",
      }}
    >
      {/* ＋ 图标 —— 聚焦时点亮为宝蓝 */}
      <span
        style={{
          display: "inline-flex",
          flexShrink: 0,
          color: focused ? "var(--brand-600)" : "var(--ink-400)",
          transition: "color 180ms ease",
        }}
      >
        <Icon name="plus" size={16} />
      </span>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        placeholder="添加一个任务……回车确认"
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          fontSize: 13,
          lineHeight: 1.4,
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
          <Icon name="corner-down-left" size={11} color="var(--ink-500)" />
        </span>
      )}
    </div>
  );
}

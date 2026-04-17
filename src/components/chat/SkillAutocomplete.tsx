import { useMemo, useEffect, useRef } from "react";
import type { Skill } from "@/types/skill";
import { matchSkillsByPrefix } from "@/services/skillParser";
import Icon, { type IconName } from "@/components/shared/Icon";

interface SkillAutocompleteProps {
  query: string;
  skills: Skill[];
  activeIndex: number;
  onSelect: (skill: Skill) => void;
  onActiveChange: (idx: number) => void;
  onHoverAsActive?: boolean;
}

/**
 * `/` 触发后弹出的命令补全下拉。
 *
 * 布局：absolute 定位，贴在父容器（ChatInput 的 input-container）顶部上方。
 * 父需 position:relative 才能正确定位。
 */
export default function SkillAutocomplete({
  query,
  skills,
  activeIndex,
  onSelect,
  onActiveChange,
  onHoverAsActive = true,
}: SkillAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const matched = useMemo(() => matchSkillsByPrefix(query, skills, 6), [query, skills]);

  // activeIndex 变化时滚动到可视区
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>(
      `[data-idx="${activeIndex}"]`
    );
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (matched.length === 0) {
    return (
      <div
        style={{
          position: "absolute",
          bottom: "100%",
          left: 0,
          right: 0,
          marginBottom: 8,
          background: "var(--paper-0)",
          border: "1px solid var(--rule-line)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-paper-lift)",
          padding: "10px 14px",
          fontSize: 12,
          color: "var(--ink-400)",
          zIndex: 50,
        }}
      >
        无匹配命令 · <kbd style={kbdStyle}>Enter</kbd> 作为普通消息发送 · <kbd style={kbdStyle}>Esc</kbd> 关闭补全
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      style={{
        position: "absolute",
        bottom: "100%",
        left: 0,
        right: 0,
        marginBottom: 8,
        background: "var(--paper-0)",
        border: "1px solid var(--rule-line)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-paper-lift)",
        maxHeight: 190,
        overflowY: "auto",
        zIndex: 50,
        // 视觉小 tag
        padding: 4,
      }}
    >
      <div
        style={{
          padding: "4px 10px 6px",
          fontSize: 10,
          color: "var(--ink-400)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontFamily: "var(--font-mono)",
          borderBottom: "1px solid var(--rule-line)",
          marginBottom: 4,
        }}
      >
        skill · ↑↓ 选择 · enter 填充 · esc 关闭
      </div>
      {matched.map((s, idx) => {
        const active = idx === activeIndex;
        const iconName: IconName = isKnownIcon(s.icon) ? (s.icon as IconName) : "wand-2";
        return (
          <button
            key={s.id}
            data-idx={idx}
            onMouseDown={(e) => {
              // 用 mousedown 避免 textarea blur 后 click 失效
              e.preventDefault();
              onSelect(s);
            }}
            onMouseEnter={() => onHoverAsActive && onActiveChange(idx)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              background: active ? "var(--vermilion-100)" : "transparent",
              border: "none",
              textAlign: "left",
              cursor: "pointer",
              transition: "background 120ms ease",
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "var(--radius-sm)",
                background: active ? "var(--paper-0)" : "var(--paper-1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon name={iconName} size="xs" color="var(--vermilion-600)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  whiteSpace: "nowrap",
                }}
              >
                <code
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: active ? "var(--vermilion-600)" : "var(--ink-800)",
                    fontWeight: 600,
                  }}
                >
                  /{s.name}
                </code>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--ink-600)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.display_name}
                </span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--ink-400)",
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.description}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  padding: "1px 5px",
  borderRadius: 3,
  background: "var(--paper-1)",
  border: "1px solid var(--rule-line)",
  color: "var(--ink-600)",
  margin: "0 2px",
};

/** 防止 DB 中存入无效 icon 名导致 TS 报错 —— 简单白名单 */
const KNOWN_ICONS: ReadonlyArray<IconName> = [
  "wand-2",
  "calendar-days",
  "scroll-text",
  "target",
  "list-todo",
  "sparkles",
  "pen-line",
  "lightbulb",
  "heart",
  "briefcase",
  "notebook-pen",
  "book-open-text",
  "send-horizontal",
];
function isKnownIcon(name: string): boolean {
  return (KNOWN_ICONS as ReadonlyArray<string>).includes(name);
}

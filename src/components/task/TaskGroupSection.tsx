import { useState } from "react";
import Icon from "@/components/shared/Icon";

interface TaskGroupSectionProps {
  title: string;
  count: number;
  accentColor: string;
  /** 仅在首次挂载生效，不随外部改变强制切换 */
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

/**
 * 任务列表分组容器
 * ┌─────────────────────────────────────┐
 * │ 正在做  2                         ⌄ │  ← 小章节标题，点击折叠
 * └─────────────────────────────────────┘
 *   [卡片 1]
 *   [卡片 2]
 *
 * count === 0 时整块不渲染。
 */
export default function TaskGroupSection({
  title,
  count,
  accentColor,
  defaultExpanded = true,
  children,
}: TaskGroupSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (count === 0) return null;

  return (
    <section style={{ marginBottom: 14 }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "4px 2px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: accentColor,
          textAlign: "left",
          userSelect: "none",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            lineHeight: 1.2,
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 10,
            fontWeight: 600,
            padding: "1px 7px",
            borderRadius: 999,
            background: "var(--ink-100)",
            color: "var(--ink-500)",
            lineHeight: 1.4,
          }}
        >
          {count}
        </span>

        <span
          aria-hidden="true"
          style={{
            flex: 1,
            height: 1,
            background: "var(--rule-line)",
            marginLeft: 4,
          }}
        />

        <span
          style={{
            display: "inline-flex",
            color: "var(--ink-400)",
            transform: expanded ? "rotate(90deg)" : "rotate(0)",
            transition: "transform 200ms ease",
          }}
        >
          <Icon name="chevron-right" size="xs" color="var(--ink-400)" />
        </span>
      </button>

      {expanded && (
        <div
          className="animate-fade-in"
          style={{
            marginTop: 8,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {children}
        </div>
      )}
    </section>
  );
}

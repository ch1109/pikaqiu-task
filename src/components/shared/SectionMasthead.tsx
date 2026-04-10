/**
 * SectionMasthead — WildCard 风章节头
 *
 * ┌──────────────────────────────────────┐
 * │  今日               12 任务          │  ← 大标题 + 右侧计数胶囊
 * │  六个任务，已排四个                   │  ← 副题
 * └──────────────────────────────────────┘
 */
interface SectionMastheadProps {
  variant: "today" | "schedule" | "review" | "dialogue" | "settings";
  /** 可选计数（如任务数） */
  count?: number;
  /** 副题 */
  subtitle?: string;
}

const VARIANT_META: Record<
  SectionMastheadProps["variant"],
  {
    title: string;
    defaultSubtitle: (count?: number) => string;
  }
> = {
  today: {
    title: "今日",
    defaultSubtitle: (count) =>
      count !== undefined ? `共 ${count} 项任务` : "手写你今天的安排",
  },
  schedule: {
    title: "日程",
    defaultSubtitle: (count) =>
      count !== undefined ? `${count} 个时间块` : "按顺序展开一天",
  },
  review: {
    title: "复盘",
    defaultSubtitle: () => "回看今天发生了什么",
  },
  dialogue: {
    title: "对话",
    defaultSubtitle: () => "像讲故事一样告诉我",
  },
  settings: {
    title: "设置",
    defaultSubtitle: () => "微调运行参数",
  },
};

export default function SectionMasthead({
  variant,
  count,
  subtitle,
}: SectionMastheadProps) {
  const meta = VARIANT_META[variant];

  return (
    <div
      className="stagger-child"
      style={{
        "--stagger-index": 0,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      } as React.CSSProperties}
    >
      {/* 第一行：大标题 + 可选计数胶囊 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h2
          className="heading-display"
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: "var(--ink-900)",
            letterSpacing: "-0.015em",
            lineHeight: 1.15,
            margin: 0,
          }}
        >
          {meta.title}
        </h2>
        {count !== undefined && (
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 12,
              fontWeight: 500,
              padding: "4px 12px",
              borderRadius: 999,
              background: "var(--vermilion-100)",
              color: "var(--vermilion-600)",
              lineHeight: 1.4,
              flexShrink: 0,
            }}
          >
            {count} 项
          </span>
        )}
      </div>

      {/* 第二行：副题 */}
      <span
        style={{
          fontSize: 13,
          color: "var(--ink-500)",
          fontFamily: "var(--font-display)",
          lineHeight: 1.5,
        }}
      >
        {subtitle ?? meta.defaultSubtitle(count)}
      </span>
    </div>
  );
}

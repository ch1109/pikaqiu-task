import { useState, useEffect, useMemo } from "react";
import type { Task } from "@/types/task";
import ProgressRing from "@/components/shared/ProgressRing";
import SectionMasthead from "@/components/shared/SectionMasthead";
import { generateReview, type DailyReviewData } from "@/services/review";

interface DailyReviewProps {
  planId: number | null;
  tasks: Task[];
}

export default function DailyReview({ planId, tasks }: DailyReviewProps) {
  const [review, setReview] = useState<DailyReviewData | null>(null);

  useEffect(() => {
    if (planId && tasks.length > 0) {
      generateReview(planId).then(setReview);
    }
  }, [planId, tasks]);

  const stats = useMemo(() => {
    if (!review) return null;
    return {
      percent:
        review.total_tasks > 0
          ? (review.completed_tasks / review.total_tasks) * 100
          : 0,
      ...review,
    };
  }, [review]);

  // 用于柱状图的任务数据（有实际耗时的任务）
  const barData = useMemo(() => {
    return tasks
      .filter((t) => t.status === "completed" && t.actual_mins)
      .map((t) => ({
        name: t.name.length > 8 ? t.name.slice(0, 8) + "…" : t.name,
        estimated: t.estimated_mins,
        actual: t.actual_mins!,
        overtime: t.actual_mins! > t.estimated_mins,
      }));
  }, [tasks]);

  if (!stats || tasks.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-start",
          gap: 20,
          padding: "26px 28px 32px",
        }}
      >
        <SectionMasthead variant="review" subtitle="今天还没有数据" />
        <div
          style={{
            maxWidth: 260,
            fontSize: 14,
            lineHeight: 1.65,
            color: "var(--ink-500)",
          }}
        >
          完成今天的任务后,这里会出现一份完成度报告。
        </div>
      </div>
    );
  }

  const isHit = stats.percent >= 100;

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "26px 28px 32px",
        display: "flex",
        flexDirection: "column",
        gap: 26,
      }}
    >
      {/* 章节刊头 */}
      <SectionMasthead
        variant="review"
        subtitle={
          stats.percent >= 100
            ? "圆满完成了今天的全部任务"
            : "今天走过一半,剩下的明天继续"
        }
      />

      {/* 主数据 —— 大号百分比 */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          padding: "20px 22px",
          background: "var(--paper-0)",
          border: "1px solid var(--rule-line)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-paper-low)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="smallcaps"
            style={{
              marginBottom: 6,
              fontSize: 11,
              color: "var(--ink-500)",
            }}
          >
            完成度
          </div>
          <div
            className="display-number animate-ink"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 72,
              fontWeight: 600,
              color: isHit ? "var(--moss-600)" : "var(--ink-900)",
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
            }}
          >
            {Math.round(stats.percent)}
            <span
              style={{
                fontSize: 28,
                verticalAlign: "top",
                marginLeft: 4,
                color: "var(--vermilion-600)",
                fontWeight: 500,
              }}
            >
              %
            </span>
          </div>
        </div>

        {/* 右侧：小进度环 */}
        <div style={{ flexShrink: 0 }}>
          <ProgressRing
            percent={stats.percent}
            size={72}
            strokeWidth={5}
            color={isHit ? "var(--moss-600)" : "var(--vermilion-600)"}
          />
        </div>
      </div>

      {/* 统计四宫格 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
        }}
      >
        <Stat label="总计" value={stats.total_tasks} />
        <Stat
          label="已完成"
          value={stats.completed_tasks}
          color="var(--moss-600)"
        />
        <Stat
          label="已跳过"
          value={stats.skipped_tasks}
          color="var(--ink-500)"
        />
        <Stat
          label="估 / 实"
          value={`${stats.total_estimated_mins}′/${stats.total_actual_mins}′`}
          color={
            stats.total_actual_mins > stats.total_estimated_mins
              ? "var(--amber-600)"
              : "var(--ink-800)"
          }
          small
        />
      </div>

      {/* 耗时对比柱状图 */}
      {barData.length > 0 && (
        <div
          style={{
            padding: "20px 22px",
            background: "var(--paper-0)",
            border: "1px solid var(--rule-line)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-paper-low)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--ink-900)",
                letterSpacing: "-0.01em",
              }}
            >
              估时 vs 实耗
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--ink-400)",
              }}
            >
              按任务
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {barData.map((d, i) => {
              const maxVal = Math.max(d.estimated, d.actual);
              return (
                <div key={i}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      marginBottom: 5,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--ink-800)",
                        fontWeight: 500,
                      }}
                    >
                      {d.name}
                    </span>
                    <span
                      className="text-mono"
                      style={{
                        fontSize: 11,
                        color: d.overtime
                          ? "var(--amber-600)"
                          : "var(--ink-500)",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {d.actual}′ / {d.estimated}′
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        height: 6,
                        width: `${(d.estimated / maxVal) * 100}%`,
                        minWidth: 6,
                        background: "var(--vermilion-200)",
                        borderRadius: 999,
                      }}
                    />
                    <div
                      style={{
                        height: 6,
                        width: `${(d.actual / maxVal) * 100}%`,
                        minWidth: 6,
                        background: d.overtime
                          ? "var(--amber-600)"
                          : "var(--moss-600)",
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 图例 */}
          <div
            style={{
              display: "flex",
              gap: 16,
              justifyContent: "flex-start",
              marginTop: 16,
              paddingTop: 12,
              borderTop: "1px solid var(--rule-line)",
            }}
          >
            <LegendDot color="var(--vermilion-600)" label="估时" />
            <LegendDot color="var(--moss-600)" label="实耗" />
            <LegendDot color="var(--amber-600)" label="超时" />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color = "var(--ink-800)",
  small = false,
}: {
  label: string;
  value: string | number;
  color?: string;
  small?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "16px 18px",
        background: "var(--paper-0)",
        border: "1px solid var(--rule-line)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-paper-low)",
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: "var(--ink-500)",
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <span
        className="text-mono"
        style={{
          fontSize: small ? 17 : 26,
          fontWeight: 600,
          color,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        color: "var(--ink-500)",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 14,
          height: 3,
          background: color,
          borderRadius: 999,
        }}
      />
      {label}
    </span>
  );
}

import { useState, useEffect, useMemo } from "react";
import type { Task } from "@/types/task";
import ProgressRing from "@/components/shared/ProgressRing";
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
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          color: "var(--text-muted)",
        }}
      >
        <div style={{ fontSize: 28 }}>📊</div>
        <div style={{ fontSize: 12 }}>暂无数据 — 完成任务后查看复盘</div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
      }}
    >
      {/* 完成率进度环 */}
      <ProgressRing
        percent={stats.percent}
        size={100}
        strokeWidth={6}
        color={stats.percent >= 100 ? "var(--neon-green)" : "var(--cyan-glow)"}
      />

      {/* 统计卡片 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          width: "100%",
          maxWidth: 380,
        }}
      >
        <StatBox label="总任务" value={`${stats.total_tasks}`} color="var(--cyan-glow)" />
        <StatBox label="已完成" value={`${stats.completed_tasks}`} color="var(--neon-green)" />
        <StatBox label="已跳过" value={`${stats.skipped_tasks}`} color="var(--text-muted)" />
        <StatBox
          label="预估 / 实际"
          value={`${stats.total_estimated_mins}m / ${stats.total_actual_mins}m`}
          color={
            stats.total_actual_mins > stats.total_estimated_mins
              ? "var(--amber-glow)"
              : "var(--cyan-glow)"
          }
        />
      </div>

      {/* 耗时对比柱状图 */}
      {barData.length > 0 && (
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div
            className="heading-display"
            style={{
              fontSize: 11,
              color: "var(--text-secondary)",
              letterSpacing: "0.08em",
              marginBottom: 10,
            }}
          >
            预估 vs 实际耗时
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {barData.map((d, i) => {
              const maxVal = Math.max(d.estimated, d.actual);
              return (
                <div key={i}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-primary)",
                      marginBottom: 3,
                    }}
                  >
                    {d.name}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {/* 预估 */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div
                        style={{
                          height: 6,
                          width: `${(d.estimated / maxVal) * 100}%`,
                          minWidth: 4,
                          background: "var(--cyan-dim)",
                          borderRadius: 3,
                          transition: "width 600ms ease",
                        }}
                      />
                      <span className="text-mono" style={{ fontSize: 9, color: "var(--text-muted)" }}>
                        {d.estimated}m
                      </span>
                    </div>
                    {/* 实际 */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div
                        style={{
                          height: 6,
                          width: `${(d.actual / maxVal) * 100}%`,
                          minWidth: 4,
                          background: d.overtime
                            ? "var(--amber-glow)"
                            : "var(--neon-green)",
                          borderRadius: 3,
                          transition: "width 600ms ease",
                          boxShadow: d.overtime
                            ? "var(--glow-amber)"
                            : "var(--glow-green)",
                        }}
                      />
                      <span className="text-mono" style={{ fontSize: 9, color: "var(--text-muted)" }}>
                        {d.actual}m
                      </span>
                    </div>
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
              justifyContent: "center",
              marginTop: 10,
              fontSize: 10,
              color: "var(--text-muted)",
            }}
          >
            <span>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--cyan-dim)", marginRight: 4 }} />
              预估
            </span>
            <span>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--neon-green)", marginRight: 4 }} />
              实际
            </span>
            <span>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--amber-glow)", marginRight: 4 }} />
              超时
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "var(--border-glass)",
        borderRadius: "var(--radius-sm)",
        padding: "10px 12px",
        textAlign: "center",
      }}
    >
      <div
        className="text-mono"
        style={{ fontSize: 18, fontWeight: 600, color }}
      >
        {value}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

import dayjs from "dayjs";
import type { ScheduledBlock } from "@/types/task";

interface TaskTimelineProps {
  blocks: ScheduledBlock[];
  workStart: string;
  workEnd: string;
}

export default function TaskTimeline({
  blocks,
  workStart,
  workEnd,
}: TaskTimelineProps) {
  const today = dayjs().format("YYYY-MM-DD");
  const start = dayjs(`${today} ${workStart}`);
  const end = dayjs(`${today} ${workEnd}`);
  const totalMins = end.diff(start, "minute");
  const now = dayjs();
  const nowOffset = now.diff(start, "minute");
  const nowPercent = Math.max(0, Math.min(100, (nowOffset / totalMins) * 100));

  // 生成小时刻度
  const hours: string[] = [];
  let cursor = start.startOf("hour");
  if (cursor.isBefore(start)) cursor = cursor.add(1, "hour");
  while (cursor.isBefore(end) || cursor.isSame(end)) {
    hours.push(cursor.format("HH:mm"));
    cursor = cursor.add(1, "hour");
  }

  return (
    <div
      style={{
        position: "relative",
        padding: "12px 12px 12px 50px",
        minHeight: 200,
      }}
    >
      {/* 时间轴竖线 */}
      <div
        style={{
          position: "absolute",
          left: 42,
          top: 12,
          bottom: 12,
          width: 2,
          background:
            "linear-gradient(180deg, rgba(0,240,255,0.3) 0%, rgba(0,240,255,0.05) 100%)",
          borderRadius: 1,
        }}
      />

      {/* 当前时间指示线 */}
      {nowPercent > 0 && nowPercent < 100 && (
        <div
          style={{
            position: "absolute",
            left: 36,
            top: `calc(12px + ${nowPercent}% * (100% - 24px) / 100)`,
            right: 12,
            height: 2,
            background: "var(--magenta-glow)",
            boxShadow: "var(--glow-magenta)",
            borderRadius: 1,
            zIndex: 5,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: -4,
              top: -3,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--magenta-glow)",
            }}
          />
        </div>
      )}

      {/* 小时刻度 */}
      {hours.map((h) => {
        const offset = dayjs(`${today} ${h}`).diff(start, "minute");
        const percent = (offset / totalMins) * 100;
        return (
          <div
            key={h}
            style={{
              position: "absolute",
              left: 0,
              top: `calc(12px + ${percent}%)`,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span
              className="text-mono"
              style={{ fontSize: 9, color: "var(--text-muted)", width: 34, textAlign: "right" }}
            >
              {h}
            </span>
            <div
              style={{
                width: 8,
                height: 1,
                background: "rgba(0, 240, 255, 0.15)",
              }}
            />
          </div>
        );
      })}

      {/* 时间块 */}
      {blocks.map((block) => {
        const blockStart = dayjs(`${today} ${block.start}`).diff(
          start,
          "minute"
        );
        const blockEnd = dayjs(`${today} ${block.end}`).diff(
          start,
          "minute"
        );
        const top = (blockStart / totalMins) * 100;
        const height = ((blockEnd - blockStart) / totalMins) * 100;
        const isCompleted = block.subtask.status === "completed";
        const isActive = block.subtask.status === "active";

        return (
          <div
            key={block.subtask.id}
            style={{
              position: "absolute",
              left: 54,
              right: 12,
              top: `calc(12px + ${top}%)`,
              height: `${Math.max(height, 2)}%`,
              minHeight: 20,
              background: isCompleted
                ? "rgba(57, 255, 20, 0.08)"
                : isActive
                  ? "rgba(0, 240, 255, 0.1)"
                  : "rgba(0, 240, 255, 0.04)",
              border: isActive
                ? "1px solid rgba(0, 240, 255, 0.25)"
                : "1px solid rgba(255,255,255,0.04)",
              borderRadius: "var(--radius-sm)",
              padding: "3px 8px",
              fontSize: 11,
              color: isCompleted
                ? "var(--text-muted)"
                : "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              transition: "var(--transition-fast)",
            }}
          >
            <span className="text-mono" style={{ fontSize: 9, color: "var(--cyan-dim)" }}>
              {block.start}
            </span>{" "}
            {block.subtask.name}
          </div>
        );
      })}

      {blocks.length === 0 && (
        <div
          style={{
            padding: "40px 0",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: 12,
          }}
        >
          暂无排程 — 先在对话面板输入今日计划
        </div>
      )}
    </div>
  );
}

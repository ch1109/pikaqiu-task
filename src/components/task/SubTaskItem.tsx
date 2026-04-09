import type { SubTask } from "@/types/task";

interface SubTaskItemProps {
  subtask: SubTask;
  scheduledTime?: string;
  onStart: (id: number) => void;
  onComplete: (id: number) => void;
  onSkip: (id: number) => void;
}

export default function SubTaskItem({
  subtask,
  scheduledTime,
  onStart,
  onComplete,
  onSkip,
}: SubTaskItemProps) {
  const isCompleted = subtask.status === "completed";
  const isActive = subtask.status === "active";
  const isSkipped = subtask.status === "skipped";
  const isDone = isCompleted || isSkipped;

  return (
    <div
      className={isCompleted ? "animate-complete" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 8px",
        borderRadius: "var(--radius-sm)",
        background: isActive
          ? "rgba(0, 240, 255, 0.06)"
          : "transparent",
        opacity: isDone ? 0.5 : 1,
        transition: "var(--transition-fast)",
      }}
    >
      {/* 状态指示点 */}
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          flexShrink: 0,
          background: isCompleted
            ? "var(--neon-green)"
            : isActive
              ? "var(--cyan-glow)"
              : isSkipped
                ? "var(--text-muted)"
                : "rgba(0, 240, 255, 0.3)",
          boxShadow: isActive ? "var(--glow-cyan)" : "none",
        }}
      />

      {/* 时间标签 */}
      {scheduledTime && (
        <span
          className="text-mono"
          style={{
            fontSize: 10,
            color: "var(--cyan-dim)",
            flexShrink: 0,
            width: 40,
          }}
        >
          {scheduledTime}
        </span>
      )}

      {/* 名称 */}
      <span
        style={{
          flex: 1,
          fontSize: 12,
          color: isDone ? "var(--text-muted)" : "var(--text-primary)",
          textDecoration: isCompleted ? "line-through" : "none",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {subtask.name}
      </span>

      {/* 耗时 */}
      <span
        className="text-mono"
        style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}
      >
        {subtask.estimated_mins}m
      </span>

      {/* 操作按钮 */}
      {!isDone && (
        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
          {subtask.status === "pending" && (
            <button
              onClick={() => onStart(subtask.id)}
              title="开始"
              style={miniBtn("var(--cyan-glow)", "rgba(0, 240, 255, 0.12)")}
            >
              ▶
            </button>
          )}
          {isActive && (
            <button
              onClick={() => onComplete(subtask.id)}
              title="完成"
              style={miniBtn("var(--neon-green)", "rgba(57, 255, 20, 0.12)")}
            >
              ✓
            </button>
          )}
          <button
            onClick={() => onSkip(subtask.id)}
            title="跳过"
            style={miniBtn("var(--text-muted)", "rgba(74, 80, 104, 0.15)")}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function miniBtn(
  color: string,
  bg: string
): React.CSSProperties {
  return {
    width: 20,
    height: 20,
    border: "none",
    borderRadius: 4,
    background: bg,
    color,
    fontSize: 10,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "var(--transition-fast)",
  };
}

import type { SubTask } from "@/types/task";
import Icon from "@/components/shared/Icon";

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
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: "var(--radius-md)",
        background: isActive
          ? "var(--vermilion-100)"
          : "transparent",
        opacity: isDone ? 0.5 : 1,
        transition: "var(--transition-fast)",
      }}
    >
      {/* 状态指示点 */}
      <div
        style={{
          width: 8,
          height: 8,
          flexShrink: 0,
          borderRadius: 999,
          background: isCompleted
            ? "var(--moss-600)"
            : isActive
              ? "var(--vermilion-600)"
              : isSkipped
                ? "var(--ink-300)"
                : "var(--ink-200)",
          boxShadow: isActive
            ? "0 0 0 3px var(--vermilion-200)"
            : "none",
        }}
      />

      {/* 时间标签 */}
      {scheduledTime && (
        <span
          className="text-mono"
          style={{
            fontSize: 10,
            color: "var(--text-secondary)",
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
          fontSize: 13,
          lineHeight: 1.45,
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
        style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}
      >
        {subtask.estimated_mins}m
      </span>

      {/* 操作按钮 */}
      {!isDone && (
        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
          {subtask.status === "pending" && (
            <button
              className="btn btn-icon"
              onClick={() => onStart(subtask.id)}
              title="开始"
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                background: "transparent",
                color: "var(--ink-700)",
              }}
            >
              <Icon name="play" size={10} fill color="currentColor" />
            </button>
          )}
          {isActive && (
            <button
              className="btn btn-icon"
              onClick={() => onComplete(subtask.id)}
              title="完成"
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                background: "var(--ink-50)",
                color: "var(--ink-800)",
              }}
            >
              <Icon name="check" size={10} accent color="currentColor" />
            </button>
          )}
          <button
            className="btn btn-icon"
            onClick={() => onSkip(subtask.id)}
            title="跳过"
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              background: "transparent",
              color: "var(--ink-400)",
            }}
          >
            <Icon name="minus" size={10} color="currentColor" />
          </button>
        </div>
      )}
    </div>
  );
}


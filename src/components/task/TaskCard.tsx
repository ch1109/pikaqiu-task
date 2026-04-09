import { useState } from "react";
import type { Task, SubTask, ScheduledBlock } from "@/types/task";
import SubTaskItem from "./SubTaskItem";

const priorityColors: Record<number, string> = {
  1: "var(--coral-warn)",
  2: "var(--magenta-glow)",
  3: "var(--cyan-glow)",
  4: "var(--lavender)",
  5: "var(--text-muted)",
};

const categoryLabels: Record<string, string> = {
  work: "工作",
  study: "学习",
  life: "生活",
  general: "通用",
};

interface TaskCardProps {
  task: Task;
  subtasks: SubTask[];
  schedule: ScheduledBlock[];
  index: number;
  onStartTask: (id: number) => void;
  onCompleteTask: (id: number) => void;
  onStartSubtask: (id: number) => void;
  onCompleteSubtask: (id: number) => void;
  onSkipSubtask: (id: number) => void;
}

export default function TaskCard({
  task,
  subtasks,
  schedule,
  index,
  onStartTask,
  onCompleteTask,
  onStartSubtask,
  onCompleteSubtask,
  onSkipSubtask,
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(
    task.status === "active" || task.status === "pending"
  );

  const completedCount = subtasks.filter(
    (s) => s.status === "completed"
  ).length;
  const totalCount = subtasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isCompleted = task.status === "completed";
  const isActive = task.status === "active";
  const priorityColor = priorityColors[task.priority] || "var(--cyan-glow)";

  // 为子任务匹配排程时间
  const scheduleMap = new Map(
    schedule.map((b) => [b.subtask.id, b.start])
  );

  return (
    <div
      className="animate-card-enter"
      style={{
        "--i": index,
        background: "var(--bg-card)",
        border: isActive
          ? "1px solid rgba(0, 240, 255, 0.25)"
          : "var(--border-glass)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        opacity: isCompleted ? 0.6 : 1,
        transition: "var(--transition-normal)",
      } as React.CSSProperties}
    >
      {/* 卡片头部 */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          cursor: "pointer",
        }}
      >
        {/* 优先级标记 */}
        <div
          style={{
            width: 3,
            height: 28,
            borderRadius: 2,
            background: priorityColor,
            flexShrink: 0,
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: isCompleted
                  ? "var(--text-muted)"
                  : "var(--text-primary)",
                textDecoration: isCompleted ? "line-through" : "none",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {task.name}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 2,
            }}
          >
            <span
              className="text-mono"
              style={{ fontSize: 10, color: "var(--text-muted)" }}
            >
              {categoryLabels[task.category] || task.category}
            </span>
            {task.deadline && (
              <span
                className="text-mono"
                style={{ fontSize: 10, color: "var(--amber-glow)" }}
              >
                DDL {task.deadline}
              </span>
            )}
            <span
              className="text-mono"
              style={{ fontSize: 10, color: "var(--text-muted)" }}
            >
              {task.estimated_mins}m
            </span>
          </div>
        </div>

        {/* 进度条 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div
            style={{
              width: 40,
              height: 3,
              borderRadius: 2,
              background: "rgba(255,255,255,0.06)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                borderRadius: 2,
                background:
                  progress >= 100
                    ? "var(--neon-green)"
                    : "var(--cyan-glow)",
                transition: "width 400ms ease",
              }}
            />
          </div>
          <span
            className="text-mono"
            style={{
              fontSize: 10,
              color:
                progress >= 100 ? "var(--neon-green)" : "var(--text-muted)",
            }}
          >
            {completedCount}/{totalCount}
          </span>
        </div>

        {/* 操作按钮 */}
        {!isCompleted && (
          <div
            style={{ display: "flex", gap: 4, flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {task.status === "pending" && (
              <button
                onClick={() => onStartTask(task.id)}
                style={actionBtn("var(--cyan-glow)", "rgba(0, 240, 255, 0.12)")}
                title="开始任务"
              >
                ▶
              </button>
            )}
            {isActive && (
              <button
                onClick={() => onCompleteTask(task.id)}
                style={actionBtn(
                  "var(--neon-green)",
                  "rgba(57, 255, 20, 0.12)"
                )}
                title="完成任务"
              >
                ✓
              </button>
            )}
          </div>
        )}

        {/* 展开/折叠 */}
        <span
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            transform: expanded ? "rotate(90deg)" : "rotate(0)",
            transition: "transform 200ms ease",
          }}
        >
          ▶
        </span>
      </div>

      {/* 子任务列表 */}
      {expanded && subtasks.length > 0 && (
        <div
          style={{
            padding: "0 12px 8px 23px",
            borderTop: "1px solid rgba(255,255,255,0.03)",
          }}
        >
          {subtasks.map((sub) => (
            <SubTaskItem
              key={sub.id}
              subtask={sub}
              scheduledTime={scheduleMap.get(sub.id)}
              onStart={onStartSubtask}
              onComplete={onCompleteSubtask}
              onSkip={onSkipSubtask}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function actionBtn(color: string, bg: string): React.CSSProperties {
  return {
    width: 24,
    height: 24,
    border: "none",
    borderRadius: "var(--radius-sm)",
    background: bg,
    color,
    fontSize: 11,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "var(--transition-fast)",
  };
}

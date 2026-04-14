import { useEffect, useRef, useState } from "react";
import type { Task, SubTask, ScheduledBlock, TaskCategory } from "@/types/task";
import SubTaskItem from "./SubTaskItem";
import TaskDetailsPopover from "./TaskDetailsPopover";
import TaskActionButton from "./TaskActionButton";
import { priorityColors, categoryLabels } from "./taskMeta";
import { useTaskDecompose } from "@/hooks/useTaskDecompose";
import Icon from "@/components/shared/Icon";

interface TaskCardProps {
  task: Task;
  subtasks: SubTask[];
  schedule: ScheduledBlock[];
  index: number;
  onStartTask: (id: number) => void;
  onCompleteTask: (id: number) => void;
  onDeleteTask: (id: number) => void;
  onRenameTask: (id: number, name: string) => void;
  onUpdateFields: (
    id: number,
    fields: {
      priority?: number;
      category?: TaskCategory;
      deadline?: string | null;
      estimated_mins?: number;
      planned_start_time?: string | null;
      planned_end_time?: string | null;
    }
  ) => void;
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
  onDeleteTask,
  onRenameTask,
  onUpdateFields,
  onStartSubtask,
  onCompleteSubtask,
  onSkipSubtask,
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(task.status === "active");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(task.name);
  const [decomposeError, setDecomposeError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const decomposer = useTaskDecompose(task);

  useEffect(() => {
    if (editingName) {
      setDraftName(task.name);
      // 下一帧再聚焦与全选，避免初次 render 未完成
      requestAnimationFrame(() => {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      });
    }
  }, [editingName, task.name]);

  const completedCount = subtasks.filter((s) => s.status === "completed").length;
  const totalCount = subtasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isCompleted = task.status === "completed";
  const isActive = task.status === "active";
  const priorityColor = priorityColors[task.priority] || "var(--accent-primary)";

  const scheduleMap = new Map(schedule.map((b) => [b.subtask.id, b.start]));
  const catInfo = categoryLabels[task.category] || categoryLabels.general;
  const hasSubtasks = totalCount > 0;

  const commitName = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== task.name) {
      onRenameTask(task.id, trimmed);
    }
    setEditingName(false);
  };

  const cancelEditName = () => {
    setDraftName(task.name);
    setEditingName(false);
  };

  const handleDecompose = async () => {
    setDecomposeError(null);
    try {
      await decomposer.decompose();
      setExpanded(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "拆解失败";
      setDecomposeError(msg);
      setTimeout(() => setDecomposeError(null), 3000);
    }
  };

  return (
    <div
      className="animate-card-enter neon-hover-cyan"
      style={{
        "--i": index,
        position: "relative",
        background: "var(--paper-0)",
        border: isActive
          ? "1px solid var(--accent-primary)"
          : "1px solid var(--rule-line)",
        borderLeft: isActive
          ? "3px solid var(--accent-primary)"
          : `3px solid ${priorityColor}`,
        borderRadius: "var(--radius-lg)",
        overflow: detailsOpen ? "visible" : "hidden",
        opacity: isCompleted ? 0.55 : 1,
        transition: "var(--transition-normal)",
        cursor: "default",
        boxShadow: "var(--shadow-paper-low)",
      } as React.CSSProperties}
    >
      {/* 卡片头部 */}
      <div
        onClick={() => {
          if (!editingName && !detailsOpen) setExpanded(!expanded);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "16px 18px",
          cursor: editingName ? "text" : "pointer",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            onClick={(e) => {
              if (editingName) e.stopPropagation();
            }}
          >
            {editingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitName();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEditName();
                  }
                }}
                onBlur={commitName}
                onClick={(e) => e.stopPropagation()}
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "var(--font-body)",
                  color: "var(--text-primary)",
                  background: "var(--accent-primary-softer)",
                  border: "none",
                  borderBottom: "1px solid var(--accent-primary)",
                  outline: "none",
                  padding: "1px 4px",
                  minWidth: 0,
                }}
              />
            ) : (
              <span
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingName(true);
                }}
                title="双击编辑"
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1.45,
                  color: isCompleted
                    ? "var(--text-muted)"
                    : "var(--text-primary)",
                  textDecoration: isCompleted ? "line-through" : "none",
                  wordBreak: "break-word",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {task.name}
              </span>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 5,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                color: catInfo.color,
                background: catInfo.bg,
                padding: "4px 10px 4px 8px",
                borderRadius: 999,
                letterSpacing: "0.02em",
              }}
            >
              <Icon name={catInfo.icon} size="xs" color={catInfo.color} />
              {catInfo.text}
            </span>
            {task.deadline && (
              <>
                <span
                  aria-hidden="true"
                  style={{
                    width: 1,
                    height: 10,
                    background: "var(--rule-line)",
                    display: "inline-block",
                  }}
                />
                <span
                  className="text-mono"
                  style={{ fontSize: 11, color: "var(--amber-600)", letterSpacing: "-0.01em" }}
                >
                  DDL {task.deadline}
                </span>
              </>
            )}
            {task.planned_start_time && task.planned_end_time && (
              <>
                <span
                  aria-hidden="true"
                  style={{
                    width: 1,
                    height: 10,
                    background: "var(--rule-line)",
                    display: "inline-block",
                  }}
                />
                <span
                  className="text-mono"
                  style={{
                    fontSize: 11,
                    color: "var(--accent-primary)",
                    letterSpacing: "-0.01em",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                  title="时间锚点"
                >
                  <Icon name="clock" size="xs" color="var(--accent-primary)" />
                  {task.planned_start_time}–{task.planned_end_time}
                </span>
              </>
            )}
            <span
              aria-hidden="true"
              style={{
                width: 1,
                height: 10,
                background: "var(--rule-line)",
                display: "inline-block",
              }}
            />
            <span
              className="text-mono"
              style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "-0.01em" }}
            >
              {task.estimated_mins}m
            </span>
            {decomposeError && (
              <span
                className="text-mono"
                style={{
                  fontSize: 11,
                  color: "var(--seal-red)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Icon name="alert-triangle" size="xs" color="var(--seal-red)" />
                {decomposeError}
              </span>
            )}
          </div>
        </div>

        {/* 进度条 */}
        {hasSubtasks && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 52,
                height: 4,
                background: "var(--ink-100)",
                overflow: "hidden",
                borderRadius: 999,
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  background:
                    progress >= 100
                      ? "var(--moss-600)"
                      : "var(--vermilion-600)",
                  transition: "width 400ms ease",
                  borderRadius: 999,
                }}
              />
            </div>
            <span
              className="text-mono"
              style={{
                fontSize: 11,
                letterSpacing: "-0.01em",
                color:
                  progress >= 100 ? "var(--moss-600)" : "var(--ink-500)",
              }}
            >
              {completedCount}/{totalCount}
            </span>
          </div>
        )}

        {/* 操作按钮组 */}
        <div
          style={{ display: "flex", gap: 4, flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 开始/完成 */}
          {!isCompleted && task.status === "pending" && (
            <TaskActionButton
              icon="play"
              label="开始"
              variant="primary"
              onClick={() => onStartTask(task.id)}
            />
          )}
          {!isCompleted && isActive && (
            <TaskActionButton
              icon="check"
              label="完成"
              variant="primary"
              onClick={() => onCompleteTask(task.id)}
            />
          )}

          {/* 详情按钮 */}
          {!isCompleted && (
            <button
              className="btn btn-icon btn-ghost"
              onClick={() => setDetailsOpen((v) => !v)}
              style={{
                width: 24,
                height: 24,
                borderRadius: "var(--radius-sm)",
              }}
              title="详情"
            >
              <Icon name="more-horizontal" size="sm" color="var(--ink-500)" />
            </button>
          )}
        </div>

        {/* 展开/折叠指示 */}
        {hasSubtasks && (
          <span
            style={{
              display: "inline-flex",
              color: "var(--ink-400)",
              transform: expanded ? "rotate(90deg)" : "rotate(0)",
              transition: "transform 200ms ease",
              flexShrink: 0,
              marginLeft: 2,
            }}
          >
            <Icon name="chevron-right" size="xs" color="var(--ink-400)" />
          </span>
        )}
      </div>

      {/* 详情弹层 */}
      {detailsOpen && (
        <TaskDetailsPopover
          task={task}
          hasSubtasks={hasSubtasks}
          decomposing={decomposer.loading}
          onUpdate={(fields) => onUpdateFields(task.id, fields)}
          onDecompose={handleDecompose}
          onDelete={() => onDeleteTask(task.id)}
          onClose={() => setDetailsOpen(false)}
        />
      )}

      {/* 子任务列表 */}
      {expanded && hasSubtasks && (
        <div
          style={{
            padding: "10px 18px 14px 28px",
            background: "var(--paper-1)",
            borderTop: "1px solid var(--rule-line)",
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

import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
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
  onAddSubtask: (taskId: number, name: string) => void | Promise<void>;
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
  onAddSubtask,
}: TaskCardProps) {
  // 默认折叠：5+ 任务的 active 自动展开会挤掉窗口；改由用户主动点击头部展开
  const [expanded, setExpanded] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(task.name);
  const [decomposeError, setDecomposeError] = useState<string | null>(null);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [draftSubtask, setDraftSubtask] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  const submittingSubtaskRef = useRef(false);
  const detailsAnchorRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    if (addingSubtask) {
      requestAnimationFrame(() => subtaskInputRef.current?.focus());
    }
  }, [addingSubtask]);

  const completedCount = subtasks.filter((s) => s.status === "completed").length;
  const totalCount = subtasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isCompleted = task.status === "completed";
  const isActive = task.status === "active";
  const priorityColor = priorityColors[task.priority] || "var(--accent-primary)";

  // 不用 useMemo：isOvertime 依赖当前时钟 dayjs()，即便 task 字段不变，
  // 跨过 end_time 的那一刻也必须重算。useMemo 依赖不变就缓存会导致
  // 时间已过但卡片仍显示为"待开始"。
  // 触发 re-render 的机制：taskAlarm 在 end 到点时 emit "tasks-changed"，
  // TaskPanel 监听后 loadToday → tasks 数组新引用 → 子组件 re-render。
  const isOvertime = (() => {
    if (isCompleted || task.status === "skipped") return false;
    if (!task.planned_end_time) return false;
    const [h, m] = task.planned_end_time.split(":").map(Number);
    const end = dayjs().hour(h).minute(m).second(0).millisecond(0);
    return dayjs().isAfter(end);
  })();

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

  const commitSubtask = async () => {
    // 防止 Enter 后 setAddingSubtask(false) 卸载 input，
    // 触发 onBlur 二次调用导致同一名字插入两条子任务
    if (submittingSubtaskRef.current) return;
    const trimmed = draftSubtask.trim();
    if (!trimmed) {
      setDraftSubtask("");
      setAddingSubtask(false);
      return;
    }
    submittingSubtaskRef.current = true;
    try {
      await onAddSubtask(task.id, trimmed);
    } finally {
      submittingSubtaskRef.current = false;
      setDraftSubtask("");
      setAddingSubtask(false);
    }
  };

  const cancelSubtask = () => {
    setDraftSubtask("");
    setAddingSubtask(false);
  };

  const stateClass = isOvertime
    ? "task-overtime-glow"
    : isActive
      ? "task-active-glow"
      : "";

  return (
    <div
      className={`animate-card-enter neon-hover-cyan ${stateClass}`.trim()}
      style={{
        "--i": index,
        position: "relative",
        // active/overtime 的底/边框交给 className 管理（双层 background 渐变 + 动态边框）
        // 普通态仍用内联 paper-0 + 尺线
        background: isActive || isOvertime ? undefined : "var(--paper-0)",
        border:
          isActive || isOvertime ? undefined : "1px solid var(--rule-line)",
        borderLeft: isActive
          ? "3px solid var(--accent-primary)"
          : isOvertime
            ? "3px solid var(--amber-600)"
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
          gap: 8,
          padding: "10px 14px",
          cursor: editingName ? "text" : "pointer",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              minWidth: 0,
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
                title={task.name}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: 1.35,
                  color: isCompleted
                    ? "var(--text-muted)"
                    : "var(--text-primary)",
                  textDecoration: isCompleted ? "line-through" : "none",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
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
              gap: 8,
              marginTop: 4,
              flexWrap: "wrap",
              rowGap: 4,
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
            {task.planned_start_time && (
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
                    color: isOvertime
                      ? "var(--amber-600)"
                      : "var(--accent-primary)",
                    letterSpacing: "-0.01em",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                  title="时间锚点"
                >
                  <Icon
                    name="clock"
                    size="xs"
                    color={
                      isOvertime ? "var(--amber-600)" : "var(--accent-primary)"
                    }
                  />
                  {task.planned_end_time
                    ? `${task.planned_start_time}–${task.planned_end_time}`
                    : `${task.planned_start_time} 起`}
                </span>
              </>
            )}
            {isOvertime && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  color: "var(--amber-600)",
                  background: "var(--amber-100)",
                  padding: "3px 9px",
                  borderRadius: 999,
                  letterSpacing: "0.02em",
                }}
                title="已过结束时间，未确认完成"
              >
                <Icon name="alert-triangle" size="xs" color="var(--amber-600)" />
                已超时
              </span>
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
              variant="success"
              onClick={() => onCompleteTask(task.id)}
            />
          )}

          {/* 详情按钮 */}
          {!isCompleted && (
            <button
              ref={detailsAnchorRef}
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

        {/* 展开/折叠指示：未完成任务总显示，用以展开子任务区（含手动添加） */}
        {!isCompleted && (
          <span
            style={{
              display: "inline-flex",
              color: "var(--ink-400)",
              transform: expanded ? "rotate(90deg)" : "rotate(0)",
              transition: "transform 200ms ease",
              flexShrink: 0,
              marginLeft: 0,
            }}
          >
            <Icon name="chevron-right" size="xs" color="var(--ink-400)" />
          </span>
        )}
      </div>

      {/* 详情弹层（Portal 渲染至 body，避免被后续卡片遮挡） */}
      {detailsOpen && (
        <TaskDetailsPopover
          task={task}
          hasSubtasks={hasSubtasks}
          decomposing={decomposer.loading}
          anchorRef={detailsAnchorRef}
          onUpdate={(fields) => onUpdateFields(task.id, fields)}
          onDecompose={handleDecompose}
          onDelete={() => onDeleteTask(task.id)}
          onClose={() => setDetailsOpen(false)}
        />
      )}

      {/* 子任务区：展开后始终渲染，未拆分的任务也能通过"+ 添加子任务"直接创建 */}
      {expanded && !isCompleted && (
        <div
          style={{
            padding: "8px 16px 12px 24px",
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

          {addingSubtask ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: "var(--radius-md)",
                background: "var(--accent-primary-softer)",
                border: "1px dashed var(--accent-primary)",
                marginTop: hasSubtasks ? 4 : 0,
              }}
            >
              <Icon name="plus" size="xs" color="var(--accent-primary)" />
              <input
                ref={subtaskInputRef}
                type="text"
                value={draftSubtask}
                placeholder="写下一个小步骤……"
                onChange={(e) => setDraftSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitSubtask();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelSubtask();
                  }
                }}
                onBlur={commitSubtask}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 13,
                  fontFamily: "var(--font-body)",
                  color: "var(--text-primary)",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  padding: "2px 0",
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingSubtask(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "8px 12px",
                borderRadius: "var(--radius-md)",
                background: "transparent",
                border: "1px dashed var(--rule-line)",
                color: "var(--text-muted)",
                fontSize: 12,
                fontFamily: "var(--font-body)",
                cursor: "pointer",
                transition: "var(--transition-fast)",
                marginTop: hasSubtasks ? 4 : 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent-primary)";
                e.currentTarget.style.color = "var(--accent-primary)";
                e.currentTarget.style.background = "var(--accent-primary-softer)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--rule-line)";
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <Icon name="plus" size="xs" color="currentColor" />
              添加子任务
            </button>
          )}
        </div>
      )}
    </div>
  );
}

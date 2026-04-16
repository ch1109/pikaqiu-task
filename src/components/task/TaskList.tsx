import { useMemo } from "react";
import type { Task, SubTask, ScheduledBlock } from "@/types/task";
import TaskCard from "./TaskCard";
import TaskGroupSection from "./TaskGroupSection";
import QuickAddInput from "./QuickAddInput";
import Icon from "@/components/shared/Icon";

interface TaskListProps {
  tasks: Task[];
  subtasks: Record<number, SubTask[]>;
  schedule: ScheduledBlock[];
  onStartTask: (id: number) => void;
  onCompleteTask: (id: number) => void;
  onDeleteTask: (id: number) => void;
  onRenameTask: (id: number, name: string) => void;
  onUpdateTaskFields: (
    id: number,
    fields: {
      deadline?: string | null;
      priority?: number;
      estimated_mins?: number;
      category?: Task["category"];
      planned_start_time?: string | null;
      planned_end_time?: string | null;
    }
  ) => void;
  onStartSubtask: (id: number) => void;
  onCompleteSubtask: (id: number) => void;
  onSkipSubtask: (id: number) => void;
  onAddSubtask: (taskId: number, name: string) => void | Promise<void>;
  onQuickAdd: (name: string) => void | Promise<void>;
}

export default function TaskList({
  tasks,
  subtasks,
  schedule,
  onStartTask,
  onCompleteTask,
  onDeleteTask,
  onRenameTask,
  onUpdateTaskFields,
  onStartSubtask,
  onCompleteSubtask,
  onSkipSubtask,
  onAddSubtask,
  onQuickAdd,
}: TaskListProps) {
  // 为每个任务整理其子任务的排程
  const taskScheduleMap = new Map<number, ScheduledBlock[]>();
  for (const block of schedule) {
    const taskId = block.subtask.task_id;
    if (!taskScheduleMap.has(taskId)) {
      taskScheduleMap.set(taskId, []);
    }
    taskScheduleMap.get(taskId)!.push(block);
  }

  // 按状态分组：active 置顶引导视线，pending 主体，completed/skipped 默认折叠
  const groups = useMemo(() => {
    const active: Task[] = [];
    const pending: Task[] = [];
    const completed: Task[] = [];
    for (const t of tasks) {
      if (t.status === "active") active.push(t);
      else if (t.status === "pending") pending.push(t);
      else completed.push(t); // "completed" | "skipped"
    }
    return { active, pending, completed };
  }, [tasks]);

  const isEmpty = tasks.length === 0;
  // 一张一张展开的入场序号，跨组连号，避免组间节奏断裂
  const activeOffset = 0;
  const pendingOffset = groups.active.length;
  const completedOffset = pendingOffset + groups.pending.length;

  const renderCard = (task: Task, indexOffset: number, localIndex: number) => (
    <TaskCard
      key={task.id}
      task={task}
      subtasks={subtasks[task.id] || []}
      schedule={taskScheduleMap.get(task.id) || []}
      index={indexOffset + localIndex}
      onStartTask={onStartTask}
      onCompleteTask={onCompleteTask}
      onDeleteTask={onDeleteTask}
      onRenameTask={onRenameTask}
      onUpdateFields={onUpdateTaskFields}
      onStartSubtask={onStartSubtask}
      onCompleteSubtask={onCompleteSubtask}
      onSkipSubtask={onSkipSubtask}
      onAddSubtask={onAddSubtask}
    />
  );

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* sticky 头：单行紧凑布局 — 标题+计数 | 输入框 */}
      <div
        style={{
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
          background: "var(--paper-1)",
          borderBottom: "1px solid var(--rule-line)",
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 5,
            flexShrink: 0,
          }}
        >
          <h2
            className="heading-display"
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--ink-900)",
              letterSpacing: "-0.015em",
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            今日
          </h2>
          {tasks.length > 0 && (
            <span
              className="text-mono"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--accent-primary)",
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              {tasks.length}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <QuickAddInput onAdd={onQuickAdd} autoFocus={isEmpty} />
        </div>
      </div>

      {/* 滚动区 */}
      <div
        className="list-fade-mask"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 20px 20px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {isEmpty && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
              padding: "26px 16px 12px",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                color: "var(--vermilion-600)",
                opacity: 0.7,
                animation: "hint-bounce 2.2s var(--ease-in-out-quint) infinite",
              }}
            >
              <Icon name="arrow-up" size={16} color="var(--vermilion-600)" accent />
            </div>

            <div
              style={{
                maxWidth: 240,
                fontSize: 14,
                textAlign: "center",
                color: "var(--text-secondary)",
                lineHeight: 1.55,
              }}
            >
              写下第一件事 —— 哪怕只是"喝口水"
            </div>

            <div style={{ width: 28, height: 1, background: "var(--rule-line)" }} />

            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.06em",
                color: "var(--text-muted)",
                textAlign: "center",
              }}
            >
              或去对话面板,整段让 AI 规划
            </div>
          </div>
        )}

        {!isEmpty && (
          <>
            <TaskGroupSection
              title="正在做"
              count={groups.active.length}
              accentColor="var(--accent-primary)"
              defaultExpanded
            >
              {groups.active.map((t, i) => renderCard(t, activeOffset, i))}
            </TaskGroupSection>

            <TaskGroupSection
              title="待开始"
              count={groups.pending.length}
              accentColor="var(--ink-500)"
              defaultExpanded
            >
              {groups.pending.map((t, i) => renderCard(t, pendingOffset, i))}
            </TaskGroupSection>

            <TaskGroupSection
              title="已完成"
              count={groups.completed.length}
              accentColor="var(--moss-600)"
              defaultExpanded={false}
            >
              {groups.completed.map((t, i) => renderCard(t, completedOffset, i))}
            </TaskGroupSection>
          </>
        )}
      </div>
    </div>
  );
}

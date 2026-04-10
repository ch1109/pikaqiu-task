import type { Task, SubTask, ScheduledBlock } from "@/types/task";
import TaskCard from "./TaskCard";
import QuickAddInput from "./QuickAddInput";
import Icon from "@/components/shared/Icon";
import SectionMasthead from "@/components/shared/SectionMasthead";

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
    }
  ) => void;
  onStartSubtask: (id: number) => void;
  onCompleteSubtask: (id: number) => void;
  onSkipSubtask: (id: number) => void;
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

  const isEmpty = tasks.length === 0;

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "22px 24px 28px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* 章节刊头 */}
      <SectionMasthead variant="today" count={tasks.length || undefined} />

      {/* 顶部快速添加 */}
      <QuickAddInput onAdd={onQuickAdd} autoFocus={isEmpty} />

      {/* 空态提示 */}
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

      {/* 任务卡片 */}
      {tasks.map((task, i) => (
        <TaskCard
          key={task.id}
          task={task}
          subtasks={subtasks[task.id] || []}
          schedule={taskScheduleMap.get(task.id) || []}
          index={i}
          onStartTask={onStartTask}
          onCompleteTask={onCompleteTask}
          onDeleteTask={onDeleteTask}
          onRenameTask={onRenameTask}
          onUpdateFields={onUpdateTaskFields}
          onStartSubtask={onStartSubtask}
          onCompleteSubtask={onCompleteSubtask}
          onSkipSubtask={onSkipSubtask}
        />
      ))}
    </div>
  );
}

import type { Task, SubTask, ScheduledBlock } from "@/types/task";
import TaskCard from "./TaskCard";

interface TaskListProps {
  tasks: Task[];
  subtasks: Record<number, SubTask[]>;
  schedule: ScheduledBlock[];
  onStartTask: (id: number) => void;
  onCompleteTask: (id: number) => void;
  onStartSubtask: (id: number) => void;
  onCompleteSubtask: (id: number) => void;
  onSkipSubtask: (id: number) => void;
}

export default function TaskList({
  tasks,
  subtasks,
  schedule,
  onStartTask,
  onCompleteTask,
  onStartSubtask,
  onCompleteSubtask,
  onSkipSubtask,
}: TaskListProps) {
  if (tasks.length === 0) {
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
        <div style={{ fontSize: 28 }}>📋</div>
        <div style={{ fontSize: 12, textAlign: "center" }}>
          还没有任务
          <br />
          <span style={{ fontSize: 11 }}>在对话面板输入今日计划来开始</span>
        </div>
      </div>
    );
  }

  // 为每个任务整理其子任务的排程
  const taskScheduleMap = new Map<number, ScheduledBlock[]>();
  for (const block of schedule) {
    const taskId = block.subtask.task_id;
    if (!taskScheduleMap.has(taskId)) {
      taskScheduleMap.set(taskId, []);
    }
    taskScheduleMap.get(taskId)!.push(block);
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "8px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {tasks.map((task, i) => (
        <TaskCard
          key={task.id}
          task={task}
          subtasks={subtasks[task.id] || []}
          schedule={taskScheduleMap.get(task.id) || []}
          index={i}
          onStartTask={onStartTask}
          onCompleteTask={onCompleteTask}
          onStartSubtask={onStartSubtask}
          onCompleteSubtask={onCompleteSubtask}
          onSkipSubtask={onSkipSubtask}
        />
      ))}
    </div>
  );
}

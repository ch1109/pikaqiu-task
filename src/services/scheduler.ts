import dayjs from "dayjs";
import type { Task, SubTask, ScheduleResult, ScheduleConflict, ScheduledBlock } from "@/types/task";

interface SchedulerInput {
  tasks: Task[];
  subtasks: Record<number, SubTask[]>;
  dependencies: Record<number, number[]>;
  workStart: string; // "HH:mm"
  workEnd: string;   // "HH:mm"
  breakMins: number;
}

/**
 * 拓扑排序任务（根据依赖关系 DAG）
 * 在拓扑序内按 deadline ASC NULLS LAST, priority ASC 排序
 */
function topologicalSort(
  tasks: Task[],
  deps: Record<number, number[]>
): Task[] | null {
  const inDegree = new Map<number, number>();
  const adj = new Map<number, number[]>();
  const taskMap = new Map<number, Task>();

  for (const t of tasks) {
    taskMap.set(t.id, t);
    inDegree.set(t.id, 0);
    adj.set(t.id, []);
  }

  for (const [taskId, depIds] of Object.entries(deps)) {
    const tid = Number(taskId);
    for (const depId of depIds) {
      if (taskMap.has(depId) && taskMap.has(tid)) {
        adj.get(depId)!.push(tid);
        inDegree.set(tid, (inDegree.get(tid) || 0) + 1);
      }
    }
  }

  // BFS 按优先级和 deadline 排列
  const queue: Task[] = [];
  for (const t of tasks) {
    if (inDegree.get(t.id) === 0) queue.push(t);
  }
  queue.sort(taskSortCompare);

  const result: Task[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    for (const next of adj.get(current.id) || []) {
      const newDeg = (inDegree.get(next) || 1) - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) {
        queue.push(taskMap.get(next)!);
        queue.sort(taskSortCompare);
      }
    }
  }

  // 检测环
  if (result.length !== tasks.length) return null;
  return result;
}

function taskSortCompare(a: Task, b: Task): number {
  // deadline ASC NULLS LAST
  if (a.deadline && b.deadline) {
    if (a.deadline < b.deadline) return -1;
    if (a.deadline > b.deadline) return 1;
  } else if (a.deadline && !b.deadline) return -1;
  else if (!a.deadline && b.deadline) return 1;

  // priority ASC (1 最高)
  return a.priority - b.priority;
}

/**
 * 贪心排布：遍历排序后任务的子任务，分配到可用时间段
 */
export function scheduleDay(input: SchedulerInput): ScheduleResult {
  const { tasks, subtasks, dependencies, workStart, workEnd, breakMins } = input;
  const today = dayjs().format("YYYY-MM-DD");

  // 只排布 pending/active 的任务
  const activeTasks = tasks.filter(
    (t) => t.status === "pending" || t.status === "active"
  );

  const sorted = topologicalSort(activeTasks, dependencies);
  if (!sorted) {
    return {
      blocks: [],
      conflicts: [
        {
          type: "overflow",
          task_id: 0,
          message: "任务之间存在循环依赖，请检查依赖关系",
        },
      ],
    };
  }

  // 计算可用工作时间（分钟）
  const startTime = dayjs(`${today} ${workStart}`);
  const endTime = dayjs(`${today} ${workEnd}`);
  const totalAvailMins = endTime.diff(startTime, "minute");

  const blocks: ScheduledBlock[] = [];
  const conflicts: ScheduleConflict[] = [];
  let cursor = startTime;
  let workSinceBreak = 0;

  for (const task of sorted) {
    const subs = subtasks[task.id] || [];
    const activeSubs = subs.filter(
      (s) => s.status === "pending" || s.status === "active"
    );

    for (const sub of activeSubs) {
      // 检查是否需要插入休息
      if (breakMins > 0 && workSinceBreak >= 50) {
        cursor = cursor.add(breakMins, "minute");
        workSinceBreak = 0;
      }

      const blockStart = cursor;
      const blockEnd = cursor.add(sub.estimated_mins, "minute");

      blocks.push({
        subtask: sub,
        start: blockStart.format("HH:mm"),
        end: blockEnd.format("HH:mm"),
      });

      cursor = blockEnd;
      workSinceBreak += sub.estimated_mins;

      // deadline 冲突检测
      if (task.deadline) {
        const deadlineTime = dayjs(`${today} ${task.deadline}`);
        if (blockEnd.isAfter(deadlineTime)) {
          conflicts.push({
            type: "deadline",
            task_id: task.id,
            message: `"${task.name}" 预计在 ${blockEnd.format("HH:mm")} 完成，超过截止时间 ${task.deadline}`,
          });
        }
      }
    }
  }

  // 容量溢出检测
  const totalScheduledMins = cursor.diff(startTime, "minute");
  if (totalScheduledMins > totalAvailMins) {
    conflicts.push({
      type: "overflow",
      task_id: 0,
      message: `总计划时间 ${totalScheduledMins} 分钟，超出可用时间 ${totalAvailMins} 分钟`,
    });
  }

  return { blocks, conflicts };
}

import dayjs from "dayjs";
import type {
  Task,
  SubTask,
  ScheduleResult,
  ScheduleConflict,
  ScheduledBlock,
} from "@/types/task";

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

  if (result.length !== tasks.length) return null;
  return result;
}

function taskSortCompare(a: Task, b: Task): number {
  if (a.deadline && b.deadline) {
    if (a.deadline < b.deadline) return -1;
    if (a.deadline > b.deadline) return 1;
  } else if (a.deadline && !b.deadline) return -1;
  else if (!a.deadline && b.deadline) return 1;

  return a.priority - b.priority;
}

interface AnchorRange {
  taskId: number;
  start: dayjs.Dayjs;
  end: dayjs.Dayjs;
}

/**
 * 贪心排布：锚定任务固定在用户指定时段，浮动任务绕开锚点按 topo+贪心 排
 */
export function scheduleDay(input: SchedulerInput): ScheduleResult {
  const { tasks, subtasks, dependencies, workStart, workEnd, breakMins } = input;
  const today = dayjs().format("YYYY-MM-DD");

  const activeTasks = tasks.filter(
    (t) => t.status === "pending" || t.status === "active"
  );

  const blocks: ScheduledBlock[] = [];
  const conflicts: ScheduleConflict[] = [];

  const workStartTime = dayjs(`${today} ${workStart}`);
  const workEndTime = dayjs(`${today} ${workEnd}`);
  const totalAvailMins = workEndTime.diff(workStartTime, "minute");

  // 1) 分离锚定 vs 浮动
  const anchoredTasks = activeTasks.filter(
    (t) => t.planned_start_time && t.planned_end_time
  );
  const floatingTasks = activeTasks.filter(
    (t) => !t.planned_start_time || !t.planned_end_time
  );

  // 2) 锚定任务：先按起点排序再校验 + 生成 blocks
  const anchoredRanges: AnchorRange[] = [];
  anchoredTasks.sort(
    (a, b) =>
      (a.planned_start_time ?? "").localeCompare(b.planned_start_time ?? "")
  );

  for (const t of anchoredTasks) {
    const start = dayjs(`${today} ${t.planned_start_time}`);
    const end = dayjs(`${today} ${t.planned_end_time}`);

    // 越界工作时间
    if (start.isBefore(workStartTime) || end.isAfter(workEndTime)) {
      conflicts.push({
        type: "anchor_out_of_work",
        task_id: t.id,
        message: `"${t.name}" 锚定时段 ${t.planned_start_time}–${t.planned_end_time} 超出工作时间 ${workStart}–${workEnd}`,
      });
    }

    // 与已接受的锚定区间重叠
    const overlap = anchoredRanges.find(
      (r) => start.isBefore(r.end) && end.isAfter(r.start)
    );
    if (overlap) {
      conflicts.push({
        type: "anchor_overlap",
        task_id: t.id,
        message: `"${t.name}" 锚定时段与其他锚定任务重叠`,
      });
      continue; // 跳过，不占区间
    }

    anchoredRanges.push({ taskId: t.id, start, end });

    // 生成 blocks：若有子任务按顺序填充到锚定段内，否则整段当一个块
    const subs = (subtasks[t.id] || []).filter(
      (s) => s.status === "pending" || s.status === "active"
    );
    if (subs.length === 0) {
      blocks.push({
        subtask: {
          id: -t.id,
          task_id: t.id,
          name: t.name,
          description: null,
          sort_order: 0,
          estimated_mins: end.diff(start, "minute"),
          actual_mins: null,
          status: t.status,
          scheduled_start: start.format("HH:mm"),
          scheduled_end: end.format("HH:mm"),
          started_at: null,
          completed_at: null,
          created_at: t.created_at,
        },
        start: start.format("HH:mm"),
        end: end.format("HH:mm"),
      });
    } else {
      let cursor = start;
      for (const sub of subs) {
        const bEnd = cursor.add(sub.estimated_mins, "minute");
        const clampedEnd = bEnd.isAfter(end) ? end : bEnd;
        blocks.push({
          subtask: sub,
          start: cursor.format("HH:mm"),
          end: clampedEnd.format("HH:mm"),
        });
        cursor = clampedEnd;
        if (!cursor.isBefore(end)) break;
      }
    }
  }

  // 3) 浮动任务：拓扑排序 + 贪心，cursor 推进跳过锚定区间
  const sorted = topologicalSort(floatingTasks, dependencies);
  if (!sorted) {
    conflicts.push({
      type: "overflow",
      task_id: 0,
      message: "任务之间存在循环依赖，请检查依赖关系",
    });
  } else {
    const skipAnchors = (c: dayjs.Dayjs): dayjs.Dayjs => {
      // 多个锚点可能首尾相连，需迭代跳出
      let cur = c;
      let moved = true;
      while (moved) {
        moved = false;
        for (const a of anchoredRanges) {
          if (!cur.isBefore(a.start) && cur.isBefore(a.end)) {
            cur = a.end;
            moved = true;
            break;
          }
        }
      }
      return cur;
    };

    let cursor = workStartTime;
    let workSinceBreak = 0;

    for (const task of sorted) {
      const subs = (subtasks[task.id] || []).filter(
        (s) => s.status === "pending" || s.status === "active"
      );

      for (const sub of subs) {
        if (breakMins > 0 && workSinceBreak >= 50) {
          cursor = cursor.add(breakMins, "minute");
          workSinceBreak = 0;
        }

        cursor = skipAnchors(cursor);
        const before = cursor;
        let blockEnd = cursor.add(sub.estimated_mins, "minute");

        // 若当前块会跨入锚定段，推迟到锚定段后再排
        const crossing = anchoredRanges.find(
          (a) => cursor.isBefore(a.start) && blockEnd.isAfter(a.start)
        );
        if (crossing) {
          cursor = crossing.end;
          workSinceBreak = 0;
          cursor = skipAnchors(cursor);
          blockEnd = cursor.add(sub.estimated_mins, "minute");
        }

        blocks.push({
          subtask: sub,
          start: cursor.format("HH:mm"),
          end: blockEnd.format("HH:mm"),
        });

        cursor = blockEnd;
        workSinceBreak += blockEnd.diff(before, "minute");

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

    // 容量溢出：浮动 cursor 超过 workEnd
    if (cursor.isAfter(workEndTime)) {
      const overMins = cursor.diff(workStartTime, "minute");
      conflicts.push({
        type: "overflow",
        task_id: 0,
        message: `总计划时间 ${overMins} 分钟，超出可用时间 ${totalAvailMins} 分钟`,
      });
    }
  }

  // 按 start 时间排序 blocks，输出更直观
  blocks.sort((a, b) => a.start.localeCompare(b.start));

  return { blocks, conflicts };
}

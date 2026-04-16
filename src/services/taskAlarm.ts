/**
 * 任务时间锚点定时器
 *
 * 扫描所有 planned_start_time / planned_end_time，到点 emit 可交互气泡：
 *   - pending 任务 + start → "XX 该开始了"（按钮：现在开始 / 稍后 5 分钟）
 *   - 未完成任务 + end   → "XX 时间到了"（按钮：已完成 / 还没完成）
 *
 * 仅排 24h 内到期的条目，避免 setTimeout 超长 delay 精度问题。
 * 已触发的 end 告警使用 sessionStorage 去重，避免同一天内因 CRUD 重排重复弹窗。
 */

import { emit } from "@tauri-apps/api/event";
import dayjs from "dayjs";
import type { Task } from "@/types/task";

const WINDOW_MS = 24 * 60 * 60 * 1000;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

type AlarmKind = "start" | "end";

function keyOf(taskId: number, kind: AlarmKind): string {
  return `${taskId}:${kind}`;
}

function dedupKey(taskId: number, kind: AlarmKind): string {
  return `taskAlarm:${taskId}:${kind}:${dayjs().format("YYYY-MM-DD")}`;
}

/** 把 HH:MM 的时间锚点解析为今天的时间戳（毫秒） */
function parseTodayAnchor(hhmm: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return dayjs()
    .hour(h)
    .minute(m)
    .second(0)
    .millisecond(0)
    .valueOf();
}

/** 是否已弹过（仅 end 需去重，start 过去就算错过不再弹） */
function isFired(taskId: number, kind: AlarmKind): boolean {
  try {
    return sessionStorage.getItem(dedupKey(taskId, kind)) === "1";
  } catch {
    return false;
  }
}

function markFired(taskId: number, kind: AlarmKind): void {
  try {
    sessionStorage.setItem(dedupKey(taskId, kind), "1");
  } catch {
    // sessionStorage 不可用时 fallback 为允许重弹
  }
}

/** 清除去重标记，用于"顺延时间"后让告警可以再次触发 */
export function clearAlarmDedup(taskId: number, kind: AlarmKind): void {
  try {
    sessionStorage.removeItem(dedupKey(taskId, kind));
  } catch {
    // ignore
  }
}

export function setupTaskAlarms(tasks: Task[]): void {
  clearTaskAlarms();
  const now = Date.now();

  for (const task of tasks) {
    if (task.status === "completed" || task.status === "skipped") continue;

    // start alarm：仅当还在 pending（未开始）时才提醒
    if (task.planned_start_time && task.status === "pending") {
      const fireAt = parseTodayAnchor(task.planned_start_time);
      if (fireAt !== null) {
        const delay = fireAt - now;
        if (delay >= 0 && delay <= WINDOW_MS && !isFired(task.id, "start")) {
          scheduleAlarm(task, "start", delay);
        }
      }
    }

    // end alarm：任意未完成状态均提醒"时间到"
    if (task.planned_end_time) {
      const fireAt = parseTodayAnchor(task.planned_end_time);
      if (fireAt !== null) {
        const delay = fireAt - now;
        // 未过期：正常排
        if (delay >= 0 && delay <= WINDOW_MS && !isFired(task.id, "end")) {
          scheduleAlarm(task, "end", delay);
        }
        // 今日已过期但未触发过：立即补弹一次（例如 app 刚启动时发现已超时）
        else if (delay < 0 && delay > -WINDOW_MS && !isFired(task.id, "end")) {
          scheduleAlarm(task, "end", 0);
        }
      }
    }
  }
}

function scheduleAlarm(task: Task, kind: AlarmKind, delay: number): void {
  const key = keyOf(task.id, kind);
  const timer = setTimeout(() => {
    timers.delete(key);
    markFired(task.id, kind);

    if (kind === "start") {
      emit("pet-bubble", {
        kind: "task-start",
        text: `该开始「${task.name}」了`,
        taskId: task.id,
      });
    } else {
      emit("pet-bubble", {
        kind: "task-end",
        text: `「${task.name}」时间到了，完成了吗？`,
        taskId: task.id,
      });
      // 让 TaskPanel loadToday → 所有 TaskCard re-render → isOvertime 内联重算
      // 显示琥珀色超时态，即使用户没点气泡按钮也能同步视觉
      emit("tasks-changed");
    }
    emit("pet-state", { state: "reminding" });
  }, delay);

  timers.set(key, timer);
}

export function clearTaskAlarms(): void {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
}

export function getScheduledTaskAlarmCount(): number {
  return timers.size;
}

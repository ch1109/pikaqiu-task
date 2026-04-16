import { emit } from "@tauri-apps/api/event";
import type { ScheduledBlock } from "@/types/task";

let timers: ReturnType<typeof setTimeout>[] = [];

/**
 * 根据排程设置提醒定时器
 * 到点时发送事件通知桌宠和任务面板
 */
export function setupReminders(blocks: ScheduledBlock[]) {
  clearReminders();

  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  for (const block of blocks) {
    if (block.subtask.status === "completed" || block.subtask.status === "skipped") {
      continue;
    }

    // 开始提醒
    const startTime = new Date(`${today}T${block.start}:00`).getTime();
    const startDelay = startTime - now;
    if (startDelay > 0) {
      const timer = setTimeout(() => {
        emit("reminder", {
          type: "start",
          subtaskId: block.subtask.id,
          subtaskName: block.subtask.name,
          message: `该开始「${block.subtask.name}」了`,
        });
        emit("pet-state", { state: "encourage" });
      }, startDelay);
      timers.push(timer);
    }

    // 超时提醒（150% 预估时间）
    const estimatedMs = block.subtask.estimated_mins * 60 * 1000;
    const overtimeDelay = startDelay + estimatedMs * 1.5;
    if (overtimeDelay > 0) {
      const timer = setTimeout(() => {
        emit("reminder", {
          type: "overtime",
          subtaskId: block.subtask.id,
          subtaskName: block.subtask.name,
          message: `「${block.subtask.name}」已超时，要继续还是跳过？`,
        });
        emit("pet-state", { state: "sulking" });
      }, overtimeDelay);
      timers.push(timer);
    }
  }
}

export function clearReminders() {
  for (const t of timers) clearTimeout(t);
  timers = [];
}

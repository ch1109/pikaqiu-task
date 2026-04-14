/**
 * 自定义定时提醒调度器
 *
 * 职责单一：维护 Map<id, Timeout>，到点 emit 气泡事件。
 * 不碰 DB、不感知 store —— 由调用方（PetWindow）负责：
 *   1) 初次加载 list 后调 setupCustomReminders
 *   2) 监听 "reminders-changed" 事件后重排
 *   3) 响应用户气泡按钮（看到了 / 稍后）调 advance / snooze
 *
 * 为什么不合并到 services/reminder.ts：
 *   reminder.ts 绑定 ScheduledBlock 数据结构、每日按排程重建；
 *   本调度器管理跨天持久化的自定义条目，数据源与生命周期均不同。
 */

import { emit } from "@tauri-apps/api/event";
import dayjs from "dayjs";
import type { Reminder } from "@/types/reminder";
import { pickPhrase } from "@/data/reminderPhrases";

/** 只排 24h 内到期的 timer，避免 setTimeout 超长 delay 精度问题 */
const WINDOW_MS = 24 * 60 * 60 * 1000;

const timers = new Map<number, ReturnType<typeof setTimeout>>();

export function setupCustomReminders(list: Reminder[]) {
  clearCustomReminders();
  const now = Date.now();

  for (const r of list) {
    if (!r.enabled) continue;
    const fireAt = dayjs(r.next_trigger_at).valueOf();
    const delay = fireAt - now;
    // 过期条目应在 load 阶段由 store 自动补偿（推进或禁用），这里不处理
    if (delay < 0 || delay > WINDOW_MS) continue;

    const timer = setTimeout(() => {
      timers.delete(r.id);
      emit("pet-bubble", {
        text: pickPhrase(r.title),
        reminderId: r.id,
        requireAck: true,
      });
      emit("pet-state", { state: "reminding" });
      emit("reminder-fired", { id: r.id });
    }, delay);

    timers.set(r.id, timer);
  }
}

export function clearCustomReminders() {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
}

export function getScheduledCount(): number {
  return timers.size;
}

/**
 * 基于 next_trigger_at 的时分秒，寻找"严格大于现在"的下一次命中。
 * repeat_kind='none' 或 weekdays 模式下 weekdays 为空 → 返回 null（调用方视为禁用）
 */
export function computeNextTrigger(r: Reminder): string | null {
  if (r.repeat_kind === "none") return null;

  const base = dayjs(r.next_trigger_at);
  const h = base.hour();
  const m = base.minute();
  const s = base.second();
  const now = dayjs();

  if (r.repeat_kind === "daily") {
    let cand = now.hour(h).minute(m).second(s).millisecond(0);
    if (!cand.isAfter(now)) cand = cand.add(1, "day");
    return cand.format("YYYY-MM-DDTHH:mm:ss");
  }

  if (r.repeat_kind === "weekdays") {
    const days = r.weekdays ?? [];
    if (days.length === 0) return null;
    for (let i = 0; i <= 8; i++) {
      const cand = now
        .add(i, "day")
        .hour(h)
        .minute(m)
        .second(s)
        .millisecond(0);
      if (cand.isAfter(now) && (days as number[]).includes(cand.day())) {
        return cand.format("YYYY-MM-DDTHH:mm:ss");
      }
    }
    return null;
  }

  if (r.repeat_kind === "interval") {
    const intervalMin = r.interval_minutes;
    const winStart = r.window_start;
    const winEnd = r.window_end;
    if (!intervalMin || intervalMin <= 0 || !winStart || !winEnd) return null;

    const [wsh, wsm] = winStart.split(":").map(Number);
    const [weh, wem] = winEnd.split(":").map(Number);
    const allowed = r.weekdays;

    const isDayAllowed = (d: dayjs.Dayjs) =>
      !allowed || allowed.length === 0 || (allowed as number[]).includes(d.day());

    const windowStartOf = (d: dayjs.Dayjs) =>
      d.hour(wsh).minute(wsm).second(0).millisecond(0);
    const windowEndOf = (d: dayjs.Dayjs) =>
      d.hour(weh).minute(wem).second(0).millisecond(0);

    // 起点：从"首次触发时刻"开始按间隔推进，找到第一个同时满足
    //   > now && inWindow(candidate) && isDayAllowed(candidate)
    // 的候选。若当天窗口已过或日不合法，直接跳到下一个合法日的 window_start。
    let cand = base.second(s).millisecond(0);
    const MAX_ITER = 5000; // 保护：1 分钟间隔 + 每天 10 分钟窗口最多需要 ~365*10 = 3650 步

    for (let i = 0; i < MAX_ITER; i++) {
      const ws = windowStartOf(cand);
      const we = windowEndOf(cand);

      // 非法日 / 已过当天窗口 → 跳到下一合法日的窗口起点
      if (!isDayAllowed(cand) || cand.isAfter(we)) {
        let next = cand.add(1, "day").startOf("day");
        for (let j = 0; j < 14; j++) {
          if (isDayAllowed(next)) break;
          next = next.add(1, "day");
        }
        cand = windowStartOf(next);
        continue;
      }

      // 早于当天窗口起点 → 推进到窗口起点
      if (cand.isBefore(ws)) {
        cand = ws;
        continue;
      }

      // 在窗口内且日合法
      if (cand.isAfter(now)) {
        return cand.format("YYYY-MM-DDTHH:mm:ss");
      }

      cand = cand.add(intervalMin, "minute");
    }
    return null;
  }

  return null;
}

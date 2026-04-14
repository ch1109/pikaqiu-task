/**
 * 自定义定时提醒 —— 与 ScheduledBlock（日程子任务）正交。
 * 由用户在 TaskPanel 的「提醒」Tab 中 CRUD，存于 SQLite `reminders` 表。
 */

export type RepeatKind = "none" | "daily" | "weekdays" | "interval";

/** 0=周日, 1=周一, ..., 6=周六（与 dayjs().day() 对齐） */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Reminder {
  id: number;
  title: string;
  /** ISO local: YYYY-MM-DDTHH:mm:ss —— interval 模式下表示首次触发时刻 */
  next_trigger_at: string;
  repeat_kind: RepeatKind;
  /** weekdays 模式必填；interval 模式可选（null 视为每天）；其余为 null */
  weekdays: Weekday[] | null;
  /** 仅 interval 模式使用：间隔分钟数 */
  interval_minutes: number | null;
  /** 仅 interval 模式使用：HH:mm */
  window_start: string | null;
  window_end: string | null;
  enabled: boolean;
  last_fired_at: string | null;
  created_at: string;
  updated_at: string;
}

/** DB 原始行 —— weekdays 为逗号分隔字符串，enabled 为 0/1 */
export interface ReminderRow {
  id: number;
  title: string;
  next_trigger_at: string;
  repeat_kind: RepeatKind;
  weekdays: string | null;
  interval_minutes: number | null;
  window_start: string | null;
  window_end: string | null;
  enabled: number;
  last_fired_at: string | null;
  created_at: string;
  updated_at: string;
}

export function fromRow(row: ReminderRow): Reminder {
  return {
    id: row.id,
    title: row.title,
    next_trigger_at: row.next_trigger_at,
    repeat_kind: row.repeat_kind,
    weekdays: row.weekdays
      ? (row.weekdays.split(",").map(Number).filter((n) => n >= 0 && n <= 6) as Weekday[])
      : null,
    interval_minutes: row.interval_minutes,
    window_start: row.window_start,
    window_end: row.window_end,
    enabled: row.enabled === 1,
    last_fired_at: row.last_fired_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function weekdaysToStr(days: Weekday[] | null): string | null {
  if (!days || days.length === 0) return null;
  return [...days].sort().join(",");
}

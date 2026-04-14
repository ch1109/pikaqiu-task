import { create } from "zustand";
import { emit } from "@tauri-apps/api/event";
import dayjs from "dayjs";
import { getDB } from "@/services/db";
import {
  type Reminder,
  type ReminderRow,
  type RepeatKind,
  type Weekday,
  fromRow,
  weekdaysToStr,
} from "@/types/reminder";
import { computeNextTrigger } from "@/services/customReminder";

interface ReminderInput {
  title: string;
  next_trigger_at: string;
  repeat_kind: RepeatKind;
  weekdays: Weekday[] | null;
  interval_minutes: number | null;
  window_start: string | null;
  window_end: string | null;
}

interface ReminderStore {
  reminders: Reminder[];
  loading: boolean;

  load: () => Promise<Reminder[]>;
  create: (input: ReminderInput) => Promise<Reminder>;
  update: (id: number, input: ReminderInput) => Promise<void>;
  remove: (id: number) => Promise<void>;
  toggle: (id: number, enabled: boolean) => Promise<void>;
  /** 触发后调用：推进到下一次，或禁用单次提醒 */
  advance: (id: number) => Promise<void>;
  /** 稍后提醒：把 next_trigger_at 改为 now + minutes，不动 enabled / last_fired_at */
  snooze: (id: number, minutes: number) => Promise<void>;
}

const NOW = () => dayjs().format("YYYY-MM-DD HH:mm:ss");

async function broadcast() {
  await emit("reminders-changed");
}

export const useReminderStore = create<ReminderStore>((set, get) => ({
  reminders: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    const db = await getDB();
    const rows = await db.select<ReminderRow[]>(
      "SELECT * FROM reminders ORDER BY enabled DESC, next_trigger_at ASC"
    );
    const list = rows.map(fromRow);

    // 过期补偿：将过期条目推进到未来（repeat 类型）或禁用（单次）
    const now = dayjs();
    for (const r of list) {
      if (!r.enabled) continue;
      if (!dayjs(r.next_trigger_at).isBefore(now)) continue;

      if (r.repeat_kind === "none") {
        await db.execute(
          "UPDATE reminders SET enabled = 0, updated_at = $1 WHERE id = $2",
          [NOW(), r.id]
        );
        r.enabled = false;
      } else {
        const next = computeNextTrigger(r);
        if (next) {
          await db.execute(
            "UPDATE reminders SET next_trigger_at = $1, updated_at = $2 WHERE id = $3",
            [next, NOW(), r.id]
          );
          r.next_trigger_at = next;
        } else {
          // weekdays 空集合等无法算下次 → 禁用
          await db.execute(
            "UPDATE reminders SET enabled = 0, updated_at = $1 WHERE id = $2",
            [NOW(), r.id]
          );
          r.enabled = false;
        }
      }
    }

    set({ reminders: list, loading: false });
    return list;
  },

  create: async (input) => {
    const db = await getDB();
    const result = await db.execute(
      `INSERT INTO reminders
        (title, next_trigger_at, repeat_kind, weekdays, interval_minutes, window_start, window_end, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1)`,
      [
        input.title,
        input.next_trigger_at,
        input.repeat_kind,
        weekdaysToStr(input.weekdays),
        input.interval_minutes,
        input.window_start,
        input.window_end,
      ]
    );
    const rows = await db.select<ReminderRow[]>(
      "SELECT * FROM reminders WHERE id = $1",
      [result.lastInsertId]
    );
    const created = fromRow(rows[0]);
    set((s) => ({
      reminders: [...s.reminders, created].sort(sortReminders),
    }));
    await broadcast();
    return created;
  },

  update: async (id, input) => {
    const db = await getDB();
    await db.execute(
      `UPDATE reminders
       SET title = $1, next_trigger_at = $2, repeat_kind = $3, weekdays = $4,
           interval_minutes = $5, window_start = $6, window_end = $7, updated_at = $8
       WHERE id = $9`,
      [
        input.title,
        input.next_trigger_at,
        input.repeat_kind,
        weekdaysToStr(input.weekdays),
        input.interval_minutes,
        input.window_start,
        input.window_end,
        NOW(),
        id,
      ]
    );
    set((s) => ({
      reminders: s.reminders
        .map((r) =>
          r.id === id
            ? {
                ...r,
                title: input.title,
                next_trigger_at: input.next_trigger_at,
                repeat_kind: input.repeat_kind,
                weekdays: input.weekdays,
                interval_minutes: input.interval_minutes,
                window_start: input.window_start,
                window_end: input.window_end,
              }
            : r
        )
        .sort(sortReminders),
    }));
    await broadcast();
  },

  remove: async (id) => {
    const db = await getDB();
    await db.execute("DELETE FROM reminders WHERE id = $1", [id]);
    set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) }));
    await broadcast();
  },

  toggle: async (id, enabled) => {
    const db = await getDB();
    await db.execute(
      "UPDATE reminders SET enabled = $1, updated_at = $2 WHERE id = $3",
      [enabled ? 1 : 0, NOW(), id]
    );
    set((s) => ({
      reminders: s.reminders
        .map((r) => (r.id === id ? { ...r, enabled } : r))
        .sort(sortReminders),
    }));
    await broadcast();
  },

  advance: async (id) => {
    const target = get().reminders.find((r) => r.id === id);
    if (!target) return;
    const db = await getDB();
    const now = NOW();
    const next = computeNextTrigger(target);

    if (next) {
      await db.execute(
        `UPDATE reminders
         SET next_trigger_at = $1, last_fired_at = $2, updated_at = $3
         WHERE id = $4`,
        [next, now, now, id]
      );
      set((s) => ({
        reminders: s.reminders
          .map((r) =>
            r.id === id
              ? { ...r, next_trigger_at: next, last_fired_at: now }
              : r
          )
          .sort(sortReminders),
      }));
    } else {
      await db.execute(
        "UPDATE reminders SET enabled = 0, last_fired_at = $1, updated_at = $1 WHERE id = $2",
        [now, id]
      );
      set((s) => ({
        reminders: s.reminders
          .map((r) =>
            r.id === id
              ? { ...r, enabled: false, last_fired_at: now }
              : r
          )
          .sort(sortReminders),
      }));
    }
    await broadcast();
  },

  snooze: async (id, minutes) => {
    const target = get().reminders.find((r) => r.id === id);
    if (!target) return;
    const db = await getDB();
    const next = dayjs().add(minutes, "minute").format("YYYY-MM-DDTHH:mm:ss");
    await db.execute(
      "UPDATE reminders SET next_trigger_at = $1, updated_at = $2 WHERE id = $3",
      [next, NOW(), id]
    );
    set((s) => ({
      reminders: s.reminders
        .map((r) => (r.id === id ? { ...r, next_trigger_at: next } : r))
        .sort(sortReminders),
    }));
    await broadcast();
  },
}));

/** enabled 优先，其次按触发时间升序 */
function sortReminders(a: Reminder, b: Reminder): number {
  if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
  return a.next_trigger_at.localeCompare(b.next_trigger_at);
}

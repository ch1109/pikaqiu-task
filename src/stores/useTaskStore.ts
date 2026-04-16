import { create } from "zustand";
import { emit } from "@tauri-apps/api/event";
import { getDB } from "@/services/db";
import type {
  DailyPlan,
  Task,
  SubTask,
  TaskStatus,
  TaskCategory,
} from "@/types/task";
import dayjs from "dayjs";

interface TaskStore {
  currentPlan: DailyPlan | null;
  tasks: Task[];
  subtasks: Record<number, SubTask[]>;
  loading: boolean;

  loadToday: () => Promise<void>;
  createPlan: (rawInput: string) => Promise<DailyPlan>;
  updatePlanStatus: (
    planId: number,
    status: DailyPlan["status"]
  ) => Promise<void>;

  addTask: (
    planId: number,
    task: {
      name: string;
      deadline?: string | null;
      priority?: number;
      category?: TaskCategory;
      estimated_mins?: number;
      sort_order?: number;
    }
  ) => Promise<Task>;
  updateTaskStatus: (taskId: number, status: TaskStatus) => Promise<void>;
  startTask: (taskId: number) => Promise<void>;
  completeTask: (taskId: number) => Promise<void>;

  addSubtask: (
    taskId: number,
    subtask: {
      name: string;
      description?: string | null;
      estimated_mins?: number;
      sort_order?: number;
      scheduled_start?: string | null;
      scheduled_end?: string | null;
    }
  ) => Promise<SubTask>;
  updateSubtaskStatus: (
    subtaskId: number,
    status: TaskStatus
  ) => Promise<void>;
  startSubtask: (subtaskId: number) => Promise<void>;
  completeSubtask: (subtaskId: number) => Promise<void>;

  deleteTask: (taskId: number) => Promise<void>;
  updateTaskFields: (
    taskId: number,
    fields: {
      name?: string;
      deadline?: string | null;
      priority?: number;
      category?: TaskCategory;
      estimated_mins?: number;
      planned_start_time?: string | null;
      planned_end_time?: string | null;
    }
  ) => Promise<void>;
  clearSubtasks: (taskId: number) => Promise<void>;

  addDependency: (taskId: number, dependsOnId: number) => Promise<void>;
  getDependencies: (taskId: number) => Promise<number[]>;

  loadHistory: (
    days: number
  ) => Promise<Array<{ date: string; completed: number }>>;

  /**
   * 按本地日期（YYYY-MM-DD）拉取当日所有已完成任务明细 + 对应子任务。
   * 不进 zustand state：复盘回看场景只读，避免污染 tasks/subtasks 的"今日"语义。
   */
  loadCompletedByDate: (
    date: string
  ) => Promise<{ tasks: Task[]; subtasksByTask: Record<number, SubTask[]> }>;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  currentPlan: null,
  tasks: [],
  subtasks: {},
  loading: false,

  loadToday: async () => {
    set({ loading: true });
    const db = await getDB();
    const today = dayjs().format("YYYY-MM-DD");

    const plans = await db.select<DailyPlan[]>(
      "SELECT * FROM daily_plans WHERE date = $1",
      [today]
    );

    if (plans.length === 0) {
      set({ currentPlan: null, tasks: [], subtasks: {}, loading: false });
      return;
    }

    const plan = plans[0];
    const tasks = await db.select<Task[]>(
      "SELECT * FROM tasks WHERE plan_id = $1 ORDER BY sort_order, priority",
      [plan.id]
    );

    const subtaskMap: Record<number, SubTask[]> = {};
    for (const task of tasks) {
      const subs = await db.select<SubTask[]>(
        "SELECT * FROM subtasks WHERE task_id = $1 ORDER BY sort_order",
        [task.id]
      );
      subtaskMap[task.id] = subs;
    }

    set({ currentPlan: plan, tasks, subtasks: subtaskMap, loading: false });
  },

  createPlan: async (rawInput) => {
    const db = await getDB();
    const today = dayjs().format("YYYY-MM-DD");

    const result = await db.execute(
      "INSERT INTO daily_plans (date, raw_input) VALUES ($1, $2)",
      [today, rawInput]
    );

    const plans = await db.select<DailyPlan[]>(
      "SELECT * FROM daily_plans WHERE id = $1",
      [result.lastInsertId]
    );
    const plan = plans[0];
    set({ currentPlan: plan, tasks: [], subtasks: {} });
    return plan;
  },

  updatePlanStatus: async (planId, status) => {
    const db = await getDB();
    await db.execute(
      "UPDATE daily_plans SET status = $1, updated_at = datetime('now','localtime') WHERE id = $2",
      [status, planId]
    );
    const { currentPlan } = get();
    if (currentPlan?.id === planId) {
      set({ currentPlan: { ...currentPlan, status } });
    }
  },

  addTask: async (planId, taskData) => {
    const db = await getDB();
    const result = await db.execute(
      `INSERT INTO tasks (plan_id, name, deadline, priority, category, estimated_mins, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        planId,
        taskData.name,
        taskData.deadline ?? null,
        taskData.priority ?? 3,
        taskData.category ?? "general",
        taskData.estimated_mins ?? 60,
        taskData.sort_order ?? 0,
      ]
    );

    const tasks = await db.select<Task[]>(
      "SELECT * FROM tasks WHERE id = $1",
      [result.lastInsertId]
    );
    const task = tasks[0];

    set((s) => ({
      tasks: [...s.tasks, task],
      subtasks: { ...s.subtasks, [task.id]: [] },
    }));
    emit("tasks-changed");
    return task;
  },

  updateTaskStatus: async (taskId, status) => {
    const db = await getDB();
    await db.execute("UPDATE tasks SET status = $1 WHERE id = $2", [
      status,
      taskId,
    ]);
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)),
    }));
    emit("tasks-changed");
  },

  startTask: async (taskId) => {
    const db = await getDB();
    const now = dayjs().format("YYYY-MM-DD HH:mm:ss");
    await db.execute(
      "UPDATE tasks SET status = 'active', started_at = $1 WHERE id = $2",
      [now, taskId]
    );
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, status: "active" as const, started_at: now } : t
      ),
    }));
    emit("tasks-changed");
  },

  completeTask: async (taskId) => {
    const db = await getDB();
    const now = dayjs().format("YYYY-MM-DD HH:mm:ss");
    const task = get().tasks.find((t) => t.id === taskId);
    const actualMins = task?.started_at
      ? dayjs(now).diff(dayjs(task.started_at), "minute")
      : null;

    await db.execute(
      "UPDATE tasks SET status = 'completed', completed_at = $1, actual_mins = $2 WHERE id = $3",
      [now, actualMins, taskId]
    );
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? { ...t, status: "completed" as const, completed_at: now, actual_mins: actualMins }
          : t
      ),
    }));
    emit("tasks-changed");
  },

  addSubtask: async (taskId, subtaskData) => {
    const db = await getDB();
    const result = await db.execute(
      `INSERT INTO subtasks (task_id, name, description, estimated_mins, sort_order, scheduled_start, scheduled_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        taskId,
        subtaskData.name,
        subtaskData.description ?? null,
        subtaskData.estimated_mins ?? 15,
        subtaskData.sort_order ?? 0,
        subtaskData.scheduled_start ?? null,
        subtaskData.scheduled_end ?? null,
      ]
    );

    const subs = await db.select<SubTask[]>(
      "SELECT * FROM subtasks WHERE id = $1",
      [result.lastInsertId]
    );
    const subtask = subs[0];

    set((s) => ({
      subtasks: {
        ...s.subtasks,
        [taskId]: [...(s.subtasks[taskId] || []), subtask],
      },
    }));
    return subtask;
  },

  updateSubtaskStatus: async (subtaskId, status) => {
    const db = await getDB();
    await db.execute("UPDATE subtasks SET status = $1 WHERE id = $2", [
      status,
      subtaskId,
    ]);
    set((s) => {
      const newSubtasks = { ...s.subtasks };
      for (const taskId in newSubtasks) {
        newSubtasks[taskId] = newSubtasks[taskId].map((st) =>
          st.id === subtaskId ? { ...st, status } : st
        );
      }
      return { subtasks: newSubtasks };
    });
  },

  startSubtask: async (subtaskId) => {
    const db = await getDB();
    const now = dayjs().format("YYYY-MM-DD HH:mm:ss");
    await db.execute(
      "UPDATE subtasks SET status = 'active', started_at = $1 WHERE id = $2",
      [now, subtaskId]
    );
    set((s) => {
      const newSubtasks = { ...s.subtasks };
      for (const taskId in newSubtasks) {
        newSubtasks[taskId] = newSubtasks[taskId].map((st) =>
          st.id === subtaskId
            ? { ...st, status: "active" as const, started_at: now }
            : st
        );
      }
      return { subtasks: newSubtasks };
    });
  },

  completeSubtask: async (subtaskId) => {
    const db = await getDB();
    const now = dayjs().format("YYYY-MM-DD HH:mm:ss");

    let actualMins: number | null = null;
    const { subtasks } = get();
    for (const taskId in subtasks) {
      const st = subtasks[taskId].find((s) => s.id === subtaskId);
      if (st?.started_at) {
        actualMins = dayjs(now).diff(dayjs(st.started_at), "minute");
        break;
      }
    }

    await db.execute(
      "UPDATE subtasks SET status = 'completed', completed_at = $1, actual_mins = $2 WHERE id = $3",
      [now, actualMins, subtaskId]
    );
    set((s) => {
      const newSubtasks = { ...s.subtasks };
      for (const taskId in newSubtasks) {
        newSubtasks[taskId] = newSubtasks[taskId].map((st) =>
          st.id === subtaskId
            ? { ...st, status: "completed" as const, completed_at: now, actual_mins: actualMins }
            : st
        );
      }
      return { subtasks: newSubtasks };
    });

    // 根据完成度选择桌宠形态：全部完成 → 庆祝；否则 → 鼓励。
    // 自动回 idle 由 usePetStore 的 TTL 机制处理（celebrating 4s / encourage 2.5s）
    const { subtasks: allSubs } = get();
    let completed = 0;
    let total = 0;
    for (const taskId in allSubs) {
      for (const st of allSubs[taskId]) {
        total++;
        if (st.status === "completed") completed++;
      }
    }
    const allDone = total > 0 && completed === total;
    if (allDone) {
      emit("pet-state", { state: "celebrating" });
      emit("pet-bubble", { text: `🎉 今天全部完成！辛苦啦！` });
    } else {
      emit("pet-state", { state: "encourage" });
      emit("pet-bubble", { text: `${completed}/${total} 已完成！加油！` });
    }
  },

  deleteTask: async (taskId) => {
    const db = await getDB();
    await db.execute("DELETE FROM subtasks WHERE task_id = $1", [taskId]);
    await db.execute("DELETE FROM tasks WHERE id = $1", [taskId]);
    set((s) => {
      const newSubtasks = { ...s.subtasks };
      delete newSubtasks[taskId];
      return {
        tasks: s.tasks.filter((t) => t.id !== taskId),
        subtasks: newSubtasks,
      };
    });
    emit("tasks-changed");
  },

  updateTaskFields: async (taskId, fields) => {
    const db = await getDB();
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (fields.name !== undefined) {
      sets.push(`name = $${idx++}`);
      vals.push(fields.name);
    }
    if (fields.deadline !== undefined) {
      sets.push(`deadline = $${idx++}`);
      vals.push(fields.deadline);
    }
    if (fields.priority !== undefined) {
      sets.push(`priority = $${idx++}`);
      vals.push(fields.priority);
    }
    if (fields.category !== undefined) {
      sets.push(`category = $${idx++}`);
      vals.push(fields.category);
    }
    if (fields.estimated_mins !== undefined) {
      sets.push(`estimated_mins = $${idx++}`);
      vals.push(fields.estimated_mins);
    }
    if (fields.planned_start_time !== undefined) {
      sets.push(`planned_start_time = $${idx++}`);
      vals.push(fields.planned_start_time);
    }
    if (fields.planned_end_time !== undefined) {
      sets.push(`planned_end_time = $${idx++}`);
      vals.push(fields.planned_end_time);
    }
    if (sets.length > 0) {
      vals.push(taskId);
      await db.execute(
        `UPDATE tasks SET ${sets.join(", ")} WHERE id = $${idx}`,
        vals
      );
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId ? { ...t, ...fields } : t
        ),
      }));
      // 时间锚点等字段变更可能影响 alarm 排程，广播让 PetWindow 重排
      emit("tasks-changed");
    }
  },

  clearSubtasks: async (taskId) => {
    const db = await getDB();
    await db.execute("DELETE FROM subtasks WHERE task_id = $1", [taskId]);
    set((s) => ({
      subtasks: { ...s.subtasks, [taskId]: [] },
    }));
  },

  addDependency: async (taskId, dependsOnId) => {
    const db = await getDB();
    await db.execute(
      "INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id) VALUES ($1, $2)",
      [taskId, dependsOnId]
    );
  },

  getDependencies: async (taskId) => {
    const db = await getDB();
    const rows = await db.select<{ depends_on_id: number }[]>(
      "SELECT depends_on_id FROM task_dependencies WHERE task_id = $1",
      [taskId]
    );
    return rows.map((r) => r.depends_on_id);
  },

  loadCompletedByDate: async (date) => {
    const db = await getDB();
    const tasks = await db.select<Task[]>(
      `SELECT * FROM tasks
       WHERE status = 'completed'
         AND completed_at IS NOT NULL
         AND DATE(completed_at) = $1
       ORDER BY completed_at DESC`,
      [date]
    );
    if (tasks.length === 0) {
      return { tasks: [], subtasksByTask: {} };
    }
    const ids = tasks.map((t) => t.id);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const subs = await db.select<SubTask[]>(
      `SELECT * FROM subtasks WHERE task_id IN (${placeholders}) ORDER BY sort_order ASC, id ASC`,
      ids
    );
    const subtasksByTask: Record<number, SubTask[]> = {};
    for (const s of subs) {
      (subtasksByTask[s.task_id] ||= []).push(s);
    }
    return { tasks, subtasksByTask };
  },

  loadHistory: async (days) => {
    const db = await getDB();
    const rows = await db.select<{ date: string; completed: number }[]>(
      `SELECT DATE(completed_at) AS date, COUNT(*) AS completed
       FROM tasks
       WHERE status = 'completed' AND completed_at IS NOT NULL
         AND DATE(completed_at) >= DATE('now','localtime',$1)
       GROUP BY DATE(completed_at)
       ORDER BY date DESC`,
      [`-${days - 1} days`]
    );

    // 补齐缺失日期为 0，保证图表连续
    const map = new Map(rows.map((r) => [r.date, Number(r.completed)]));
    const today = dayjs();
    const filled: Array<{ date: string; completed: number }> = [];
    for (let i = 0; i < days; i++) {
      const d = today.subtract(i, "day").format("YYYY-MM-DD");
      filled.push({ date: d, completed: map.get(d) ?? 0 });
    }
    return filled;
  },
}));

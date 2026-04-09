import { getDB } from "@/services/db";
import type { Task } from "@/types/task";

export interface DailyReviewData {
  plan_id: number;
  total_tasks: number;
  completed_tasks: number;
  skipped_tasks: number;
  total_estimated_mins: number;
  total_actual_mins: number;
  overtime_task_ids: number[];
}

/**
 * 聚合当日复盘数据并写入 daily_reviews 表
 */
export async function generateReview(planId: number): Promise<DailyReviewData> {
  const db = await getDB();

  const tasks = await db.select<Task[]>(
    "SELECT * FROM tasks WHERE plan_id = $1",
    [planId]
  );

  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const skipped = tasks.filter((t) => t.status === "skipped").length;
  const totalEstimated = tasks.reduce((s, t) => s + t.estimated_mins, 0);
  const totalActual = tasks.reduce((s, t) => s + (t.actual_mins || 0), 0);

  // 超时任务：实际耗时 > 预估耗时
  const overtimeIds = tasks
    .filter((t) => t.actual_mins && t.actual_mins > t.estimated_mins)
    .map((t) => t.id);

  const data: DailyReviewData = {
    plan_id: planId,
    total_tasks: total,
    completed_tasks: completed,
    skipped_tasks: skipped,
    total_estimated_mins: totalEstimated,
    total_actual_mins: totalActual,
    overtime_task_ids: overtimeIds,
  };

  // 写入或更新 daily_reviews
  await db.execute(
    `INSERT INTO daily_reviews (plan_id, total_tasks, completed_tasks, skipped_tasks, total_estimated_mins, total_actual_mins, overtime_task_ids)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT(plan_id) DO UPDATE SET
       total_tasks = $2,
       completed_tasks = $3,
       skipped_tasks = $4,
       total_estimated_mins = $5,
       total_actual_mins = $6,
       overtime_task_ids = $7`,
    [
      data.plan_id,
      data.total_tasks,
      data.completed_tasks,
      data.skipped_tasks,
      data.total_estimated_mins,
      data.total_actual_mins,
      JSON.stringify(data.overtime_task_ids),
    ]
  );

  return data;
}

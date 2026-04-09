export type TaskStatus = "pending" | "active" | "completed" | "skipped";
export type PlanStatus = "active" | "completed" | "abandoned";
export type TaskCategory = "work" | "study" | "life" | "general";

export interface DailyPlan {
  id: number;
  date: string;
  raw_input: string;
  status: PlanStatus;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  plan_id: number;
  name: string;
  deadline: string | null;
  priority: number;
  category: TaskCategory;
  status: TaskStatus;
  sort_order: number;
  estimated_mins: number;
  actual_mins: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface TaskDependency {
  task_id: number;
  depends_on_id: number;
}

export interface SubTask {
  id: number;
  task_id: number;
  name: string;
  description: string | null;
  sort_order: number;
  estimated_mins: number;
  actual_mins: number | null;
  status: TaskStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ScheduledBlock {
  subtask: SubTask;
  start: string;
  end: string;
}

export interface ScheduleConflict {
  type: "deadline" | "overflow";
  task_id: number;
  message: string;
}

export interface ScheduleResult {
  blocks: ScheduledBlock[];
  conflicts: ScheduleConflict[];
}

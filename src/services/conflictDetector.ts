import type { ScheduleConflict } from "@/types/task";

export interface ConflictSuggestion {
  conflict: ScheduleConflict;
  suggestion: string;
}

export function analyzeConflicts(
  conflicts: ScheduleConflict[]
): ConflictSuggestion[] {
  return conflicts.map((conflict) => {
    let suggestion: string;

    switch (conflict.type) {
      case "deadline":
        suggestion =
          "建议调整任务优先级，或减少该任务的子任务数量以缩短耗时";
        break;
      case "overflow":
        suggestion =
          "今日任务量过大，建议跳过低优先级任务或延长工作时间";
        break;
    }

    return { conflict, suggestion };
  });
}

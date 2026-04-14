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
      case "anchor_overlap":
        suggestion =
          "两条锚定任务时间段重叠，建议错开其中一个的开始时间";
        break;
      case "anchor_out_of_work":
        suggestion =
          "锚定时段落在工作时间之外，建议调整锚点或放宽工作时段";
        break;
    }

    return { conflict, suggestion };
  });
}

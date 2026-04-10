import { z } from "zod";

// 意图解析输出 schema
const ExtractedTaskSchema = z.object({
  task_name: z.string(),
  deadline: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  priority: z.number().int().min(1).max(5),
  category: z.enum(["work", "study", "life", "general"]),
  estimated_mins: z.number().int().positive(),
  dependencies: z.array(z.string()),
});

const TaskExtractResultSchema = z.object({
  tasks: z.array(ExtractedTaskSchema),
});

export type ExtractedTask = z.infer<typeof ExtractedTaskSchema>;
export type TaskExtractResult = z.infer<typeof TaskExtractResultSchema>;

// 任务拆解输出 schema
const DecomposedSubtaskSchema = z.object({
  name: z.string(),
  estimated_mins: z.number().int().positive(),
  description: z.string(),
});

const TaskDecomposeResultSchema = z.object({
  subtasks: z.array(DecomposedSubtaskSchema).min(2).max(7),
  best_approach: z.string(),
});

export type DecomposedSubtask = z.infer<typeof DecomposedSubtaskSchema>;
export type TaskDecomposeResult = z.infer<typeof TaskDecomposeResultSchema>;

/**
 * 从 LLM 原始文本中提取 JSON
 * 策略：先直接解析 → 失败则正则提取 JSON 块
 */
function extractJSON(raw: string): unknown {
  const trimmed = raw.trim();

  // 直接尝试解析
  try {
    return JSON.parse(trimmed);
  } catch {
    // 尝试提取 ```json ... ``` 代码块
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch {
        // 继续尝试
      }
    }

    // 尝试提取第一个 { ... } 块
    const braceMatch = trimmed.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      return JSON.parse(braceMatch[0]);
    }

    throw new Error("无法从 LLM 输出中提取有效 JSON");
  }
}

export function parseTaskExtractResult(raw: string): TaskExtractResult {
  const json = extractJSON(raw);
  return TaskExtractResultSchema.parse(json);
}

export function parseTaskDecomposeResult(raw: string): TaskDecomposeResult {
  const json = extractJSON(raw);
  return TaskDecomposeResultSchema.parse(json);
}

// 任务修改意图 schema
const TaskModifyResultSchema = z.object({
  intent: z.enum(["add", "delete", "modify", "redecompose"]),
  target_task: z.string().nullable(),
  new_tasks_description: z.string().nullable().optional(),
  changes: z.object({
    deadline: z.string().nullable().optional(),
    priority: z.number().int().min(1).max(5).nullable().optional(),
    estimated_mins: z.number().int().positive().nullable().optional(),
  }).nullable().optional(),
  redecompose_instruction: z.string().nullable().optional(),
});

export type TaskModifyResult = z.infer<typeof TaskModifyResultSchema>;

export function parseTaskModifyResult(raw: string): TaskModifyResult {
  const json = extractJSON(raw);
  return TaskModifyResultSchema.parse(json);
}

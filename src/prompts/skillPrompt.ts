import dayjs from "dayjs";
import type { ChatMessage } from "@/services/llm/types";
import type { SkillInvocation } from "@/types/skill";
import type { Task } from "@/types/task";

interface SkillPromptContext {
  tasks: Task[];
  history: Array<{ role: "user" | "assistant"; content: string }>;
  petName?: string;
}

/** 把占位符替换为实际值 */
function fillTemplate(prompt: string, vars: Record<string, string>): string {
  let filled = prompt;
  for (const [key, val] of Object.entries(vars)) {
    filled = filled.split(`{{${key}}}`).join(val);
  }
  return filled;
}

/** 当前任务列表格式化为编号字符串 */
function formatTaskList(tasks: Task[]): string {
  if (tasks.length === 0) return "（暂无任务）";
  return tasks
    .map((t, i) => {
      const status =
        t.status === "completed"
          ? "✓"
          : t.status === "active"
          ? "▶"
          : t.status === "skipped"
          ? "⏭"
          : "○";
      const dl = t.deadline ? ` · DDL ${t.deadline}` : "";
      return `${i + 1}. ${status} ${t.name} (${t.estimated_mins}min${dl})`;
    })
    .join("\n");
}

/**
 * 构造技能调用的 LLM messages。
 *
 * - 不走 chatRouter（避免强制 JSON 输出污染自然语言）
 * - system 为模板填充后的 prompt
 * - 带入最近 6 条历史，保留基本上下文
 * - user 为 args；无参数时用占位提示
 */
export function buildSkillMessages(
  invocation: SkillInvocation,
  ctx: SkillPromptContext
): ChatMessage[] {
  const now = dayjs().format("YYYY-MM-DD HH:mm");
  const system = fillTemplate(invocation.skill.prompt, {
    args: invocation.args || "（无）",
    now,
    current_tasks: formatTaskList(ctx.tasks),
    pet_name: ctx.petName ?? "赛博桌宠",
  });

  const recentHistory: ChatMessage[] = ctx.history.slice(-6).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const userContent =
    invocation.args.trim() ||
    `请按 /${invocation.skill.name} 技能的工作流为我回复。`;

  return [
    { role: "system", content: system },
    ...recentHistory,
    { role: "user", content: userContent },
  ];
}

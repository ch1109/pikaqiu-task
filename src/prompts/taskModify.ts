import type { ChatMessage } from "@/services/llm/types";

const SYSTEM_PROMPT = `你是一个任务修改助手。用户已有一份任务列表，现在通过自然语言指令修改。

判断用户意图并输出 JSON，不包含任何额外文字或 markdown 代码块标记。

可能的意图：
1. "add" — 新增任务（用户描述了新的待办事项）
2. "delete" — 删除任务（用户要求移除某个任务）
3. "modify" — 修改任务属性（时间、优先级等）
4. "redecompose" — 重新拆解某个任务（用户要求拆得更细/合并/调整子任务）

输出格式：
{
  "intent": "add" | "delete" | "modify" | "redecompose",
  "target_task": "匹配的任务名（delete/modify/redecompose 时必填，add 时为 null）",
  "new_tasks_description": "新任务的自然语言描述（仅 add 时填写）",
  "changes": {
    "deadline": "HH:MM 或 null（仅 modify 时）",
    "priority": "1-5（仅 modify 时）",
    "estimated_mins": "数字（仅 modify 时）"
  },
  "redecompose_instruction": "重新拆解的指令（仅 redecompose 时，如'拆得更细一点'）"
}`;

export function buildTaskModifyMessages(
  userInput: string,
  existingTasks: string[]
): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `当前任务列表：\n${existingTasks.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\n用户指令：${userInput}`,
    },
  ];
}

import type { ChatMessage } from "@/services/llm/types";

const SYSTEM_PROMPT = `你是一个任务拆解专家。将给定的主任务拆解为可直接执行的子任务。

输出要求：
- 严格返回 JSON，不包含任何额外文字或 markdown 代码块标记
- 格式：{ "subtasks": [{ "name": "...", "estimated_mins": 数字, "description": "一句话描述具体做什么" }], "best_approach": "一句话最佳执行路径建议" }
- 子任务数量：2-7 个
- 各子任务 estimated_mins 之和应约等于主任务的总预估耗时
- 按执行顺序排列
- 每个子任务应足够具体，可以立即开始执行`;

export function buildTaskDecomposeMessages(
  taskName: string,
  estimatedMins: number,
  category: string
): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `请拆解以下任务：
任务名称：${taskName}
预估总耗时：${estimatedMins} 分钟
类别：${category}`,
    },
  ];
}

import type { ChatMessage } from "@/services/llm/types";

const SYSTEM_PROMPT = `你是一个高效的任务规划助手。从用户的自然语言描述中提取结构化任务列表。

输出要求：
- 严格返回 JSON，不包含任何额外文字或 markdown 代码块标记
- 格式：{ "tasks": [{ "task_name": "...", "deadline": "HH:MM" 或 null, "priority": 1-5（1最高）, "category": "work"|"study"|"life"|"general", "estimated_mins": 数字, "dependencies": [] }] }
- deadline 只接受 "HH:MM" 24小时制或 null
- estimated_mins 根据任务复杂度合理估算
- dependencies 为任务名数组，表示依赖关系（空数组表示无依赖）
- 按照执行的逻辑顺序排列任务`;

export function buildTaskExtractMessages(userInput: string): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userInput },
  ];
}

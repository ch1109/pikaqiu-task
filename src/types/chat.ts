export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: number;
  /** 对话归属的 session；migration 010 之后所有新记录都非 null，历史 legacy 兜底可能为 null */
  session_id: number | null;
  /** 保留以兼容旧读路径；新代码请用 session_id */
  plan_id: number | null;
  role: ChatRole;
  content: string;
  created_at: string;
}

/**
 * 聊天会话 —— 一段连续对话的边界容器，和 `daily_plans` 正交。
 * `date` 固定为创建当日，不随续聊改变；`updated_at` 追踪最后消息时间。
 */
export interface ChatSession {
  id: number;
  title: string;
  date: string;
  created_at: string;
  updated_at: string;
}

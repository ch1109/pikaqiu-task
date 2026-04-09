export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: number;
  plan_id: number | null;
  role: ChatRole;
  content: string;
  created_at: string;
}

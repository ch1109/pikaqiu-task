/**
 * 桌宠气泡事件负载 —— pet-bubble Tauri 事件的统一载荷。
 * 历史上 reminder 走简单 text + requireAck；新增 task-start / task-end
 * 后统一收束成判别联合，方便 PetWindow 的 listener 分发。
 */
export type BubblePayload =
  | { kind?: undefined; text: string; reminderId?: number; requireAck?: boolean }
  | { kind: "task-start"; text: string; taskId: number }
  | { kind: "task-end"; text: string; taskId: number };

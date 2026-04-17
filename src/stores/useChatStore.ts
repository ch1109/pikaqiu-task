import { create } from "zustand";
import dayjs from "dayjs";
import { getDB } from "@/services/db";
import type { ChatMessage, ChatRole, ChatSession } from "@/types/chat";
import { useChatSessionStore } from "@/stores/useChatSessionStore";

/**
 * 聊天 store —— 以 session 为边界容器。
 *
 * - messages: 仅包含当前 currentSessionId 下的消息（切会话 / 新对话都会重置）
 * - currentSessionId: 懒创建，首次 addMessage 时若无 session 则建一条 date=today 的
 * - 历史上下文（LLM 的 getHistory）基于 messages slice —— session 切换自然重置上下文
 */
interface ChatStore {
  messages: ChatMessage[];
  currentSessionId: number | null;
  loading: boolean;

  /** 启动入口：找当日最新 session 恢复；找不到则空态等待用户触发首条消息 */
  resumeOrStartToday: () => Promise<void>;

  /** 点击历史会话时切换 —— 加载该 session 全部消息 */
  loadSession: (sessionId: number) => Promise<void>;

  /**
   * 用户点「新对话」—— 仅重置前端状态，不落库。
   * 真实 session 在用户发首条消息时由 addMessage 懒建，避免留下无消息的空壳。
   */
  startNewSession: () => Promise<void>;

  /** 新增消息；若当前无 session 会懒建一个 date=today 的 */
  addMessage: (
    role: ChatRole,
    content: string,
    planId?: number | null
  ) => Promise<ChatMessage>;

  /** 仅清空内存 messages（不动 currentSessionId，主要用于 UI 过场） */
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  currentSessionId: null,
  loading: false,

  resumeOrStartToday: async () => {
    set({ loading: true });
    const db = await getDB();
    // 启动时清理无消息的空 session（来自旧版"点开就建库"逻辑或异常中断），
    // 避免抽屉里堆积"新对话"脏条目
    await db.execute(
      "DELETE FROM chat_sessions WHERE id NOT IN (SELECT DISTINCT session_id FROM chat_messages WHERE session_id IS NOT NULL)"
    );
    const today = dayjs().format("YYYY-MM-DD");
    const rows = await db.select<ChatSession[]>(
      "SELECT * FROM chat_sessions WHERE date = $1 ORDER BY updated_at DESC LIMIT 1",
      [today]
    );
    if (rows.length === 0) {
      set({ messages: [], currentSessionId: null, loading: false });
      return;
    }
    const session = rows[0];
    const messages = await db.select<ChatMessage[]>(
      "SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at, id",
      [session.id]
    );
    set({ messages, currentSessionId: session.id, loading: false });
  },

  loadSession: async (sessionId) => {
    set({ loading: true });
    const db = await getDB();
    const messages = await db.select<ChatMessage[]>(
      "SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at, id",
      [sessionId]
    );
    set({ messages, currentSessionId: sessionId, loading: false });
  },

  startNewSession: async () => {
    // 仅重置前端状态，不创建 DB 记录。
    // 这样用户点"+"后若未发消息就关闭/切走，不会在历史抽屉里留下空会话。
    set({ messages: [], currentSessionId: null });
  },

  addMessage: async (role, content, planId = null) => {
    const db = await getDB();
    let sid = get().currentSessionId;
    if (!sid) {
      // 懒建 session：用户发首条消息时才真正入库
      const today = dayjs().format("YYYY-MM-DD");
      const insert = await db.execute(
        "INSERT INTO chat_sessions (title, date) VALUES ('新对话', $1)",
        [today]
      );
      sid = insert.lastInsertId as number;
      set({ currentSessionId: sid });
      // 新 session 入库后刷新列表缓存，抽屉打开就能看到
      await useChatSessionStore.getState().loadAll();
    }

    const result = await db.execute(
      "INSERT INTO chat_messages (session_id, plan_id, role, content) VALUES ($1, $2, $3, $4)",
      [sid, planId, role, content]
    );
    const rows = await db.select<ChatMessage[]>(
      "SELECT * FROM chat_messages WHERE id = $1",
      [result.lastInsertId]
    );
    const message = rows[0];

    // 首条用户消息自动作标题；每次 addMessage bump updated_at 驱动会话列表排序
    if (role === "user") {
      await useChatSessionStore.getState().autoTitleIfDefault(sid, content);
    }
    await useChatSessionStore.getState().touch(sid);

    set((s) => ({ messages: [...s.messages, message] }));
    return message;
  },

  clearMessages: () => set({ messages: [] }),
}));

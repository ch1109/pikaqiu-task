import { create } from "zustand";
import { getDB } from "@/services/db";
import type { ChatSession } from "@/types/chat";

/** 默认标题，autoTitleIfDefault 判定用 */
const DEFAULT_TITLE = "新对话";

/**
 * Chat sessions store —— 管理所有会话的元数据（不含消息）。
 *
 * - loadAll: 供历史抽屉使用的完整列表
 * - autoTitleIfDefault: 首条 user 消息触发一次标题自动化，之后不再覆盖
 * - touch: 每次新消息后 bump updated_at，驱动抽屉列表「最近在前」
 *
 * rename / remove 预留未接 UI；MVP 不暴露给用户。
 */
interface ChatSessionStore {
  sessions: ChatSession[];
  loaded: boolean;

  loadAll: () => Promise<void>;
  autoTitleIfDefault: (id: number, firstUserContent: string) => Promise<void>;
  touch: (id: number) => Promise<void>;
  rename: (id: number, title: string) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

/** 取前 20 字作标题；去换行、压缩空白，避免标题内包含 \n 导致列表行高异常 */
function deriveTitle(content: string): string {
  const cleaned = content.replace(/\s+/g, " ").trim();
  if (!cleaned) return DEFAULT_TITLE;
  return cleaned.length <= 20 ? cleaned : cleaned.slice(0, 20);
}

export const useChatSessionStore = create<ChatSessionStore>((set) => ({
  sessions: [],
  loaded: false,

  loadAll: async () => {
    const db = await getDB();
    const sessions = await db.select<ChatSession[]>(
      "SELECT * FROM chat_sessions ORDER BY date DESC, updated_at DESC"
    );
    set({ sessions, loaded: true });
  },

  autoTitleIfDefault: async (id, firstUserContent) => {
    const db = await getDB();
    // 只在当前标题还是默认值时替换，避免覆盖用户手动/迁移保留的历史标题
    const rows = await db.select<{ title: string }[]>(
      "SELECT title FROM chat_sessions WHERE id = $1",
      [id]
    );
    if (rows.length === 0) return;
    if (rows[0].title !== DEFAULT_TITLE) return;
    const title = deriveTitle(firstUserContent);
    await db.execute("UPDATE chat_sessions SET title = $1 WHERE id = $2", [
      title,
      id,
    ]);
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, title } : sess
      ),
    }));
  },

  touch: async (id) => {
    const db = await getDB();
    await db.execute(
      "UPDATE chat_sessions SET updated_at = datetime('now','localtime') WHERE id = $1",
      [id]
    );
    // 刷新内存：仅更新目标项 + 重新按 date/updated_at 排序
    const rows = await db.select<ChatSession[]>(
      "SELECT * FROM chat_sessions WHERE id = $1",
      [id]
    );
    if (rows.length === 0) return;
    const updated = rows[0];
    set((s) => {
      const exists = s.sessions.some((sess) => sess.id === id);
      const merged = exists
        ? s.sessions.map((sess) => (sess.id === id ? updated : sess))
        : [updated, ...s.sessions];
      merged.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.updated_at.localeCompare(a.updated_at);
      });
      return { sessions: merged };
    });
  },

  rename: async (id, title) => {
    const clean = title.trim() || DEFAULT_TITLE;
    const db = await getDB();
    await db.execute("UPDATE chat_sessions SET title = $1 WHERE id = $2", [
      clean,
      id,
    ]);
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, title: clean } : sess
      ),
    }));
  },

  remove: async (id) => {
    const db = await getDB();
    // 没建 FK，应用层手动级联
    await db.execute("DELETE FROM chat_messages WHERE session_id = $1", [id]);
    await db.execute("DELETE FROM chat_sessions WHERE id = $1", [id]);
    set((s) => ({ sessions: s.sessions.filter((sess) => sess.id !== id) }));
    // 调用方若当前 session 被删，负责重置 useChatStore —— 这里不跨 store 副作用
  },
}));

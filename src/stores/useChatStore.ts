import { create } from "zustand";
import { getDB } from "@/services/db";
import type { ChatMessage, ChatRole } from "@/types/chat";

interface ChatStore {
  messages: ChatMessage[];
  loading: boolean;

  loadByPlan: (planId: number) => Promise<void>;
  loadAll: () => Promise<void>;
  addMessage: (
    role: ChatRole,
    content: string,
    planId?: number | null
  ) => Promise<ChatMessage>;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  loading: false,

  loadByPlan: async (planId) => {
    set({ loading: true });
    const db = await getDB();
    const messages = await db.select<ChatMessage[]>(
      "SELECT * FROM chat_messages WHERE plan_id = $1 ORDER BY created_at",
      [planId]
    );
    set({ messages, loading: false });
  },

  loadAll: async () => {
    set({ loading: true });
    const db = await getDB();
    const messages = await db.select<ChatMessage[]>(
      "SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 100"
    );
    set({ messages: messages.reverse(), loading: false });
  },

  addMessage: async (role, content, planId = null) => {
    const db = await getDB();
    const result = await db.execute(
      "INSERT INTO chat_messages (plan_id, role, content) VALUES ($1, $2, $3)",
      [planId, role, content]
    );

    const rows = await db.select<ChatMessage[]>(
      "SELECT * FROM chat_messages WHERE id = $1",
      [result.lastInsertId]
    );
    const message = rows[0];

    set((s) => ({ messages: [...s.messages, message] }));
    return message;
  },

  clearMessages: () => set({ messages: [] }),
}));

import { create } from "zustand";
import { emit } from "@tauri-apps/api/event";
import { getDB } from "@/services/db";
import type { Settings } from "@/types/settings";

interface SettingsStore {
  settings: Settings | null;
  loading: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Omit<Settings, "id" | "created_at" | "updated_at">>) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: null,
  loading: false,

  load: async () => {
    set({ loading: true });
    const db = await getDB();
    const rows = await db.select<Settings[]>(
      "SELECT * FROM settings WHERE id = 1"
    );
    set({ settings: rows[0] ?? null, loading: false });
  },

  update: async (patch) => {
    const db = await getDB();
    const entries = Object.entries(patch).filter(
      ([, v]) => v !== undefined
    );
    if (entries.length === 0) return;

    const setClauses = entries.map(([key], i) => `${key} = $${i + 1}`);
    setClauses.push(`updated_at = datetime('now','localtime')`);
    const values = entries.map(([, v]) => v);

    await db.execute(
      `UPDATE settings SET ${setClauses.join(", ")} WHERE id = 1`,
      values
    );

    const rows = await db.select<Settings[]>(
      "SELECT * FROM settings WHERE id = 1"
    );
    set({ settings: rows[0] });
    // 跨窗口广播：PetWindow 独立 zustand 实例需要手动 reload
    await emit("settings-changed");
  },
}));

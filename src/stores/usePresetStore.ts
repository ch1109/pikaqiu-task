import { create } from "zustand";
import { getDB } from "@/services/db";
import type { PresetPrompt } from "@/types/preset";

interface PresetStore {
  presets: PresetPrompt[];
  loaded: boolean;

  loadAll: () => Promise<void>;
  addPreset: (name: string, content: string, icon?: string) => Promise<void>;
  updatePreset: (id: number, patch: { name?: string; content?: string; icon?: string }) => Promise<void>;
  deletePreset: (id: number) => Promise<void>;
}

export const usePresetStore = create<PresetStore>((set, get) => ({
  presets: [],
  loaded: false,

  loadAll: async () => {
    if (get().loaded) return;
    const db = await getDB();
    const rows = await db.select<PresetPrompt[]>(
      "SELECT * FROM preset_prompts ORDER BY sort_order, id"
    );
    set({ presets: rows, loaded: true });
  },

  addPreset: async (name, content, icon = "sparkles") => {
    const db = await getDB();
    const maxOrder = get().presets.reduce((m, p) => Math.max(m, p.sort_order), 0);
    await db.execute(
      "INSERT INTO preset_prompts (name, content, icon, sort_order, is_builtin) VALUES ($1, $2, $3, $4, 0)",
      [name, content, icon, maxOrder + 1]
    );
    set({ loaded: false });
    await get().loadAll();
  },

  updatePreset: async (id, patch) => {
    const db = await getDB();
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (patch.name !== undefined) { sets.push(`name = $${idx++}`); vals.push(patch.name); }
    if (patch.content !== undefined) { sets.push(`content = $${idx++}`); vals.push(patch.content); }
    if (patch.icon !== undefined) { sets.push(`icon = $${idx++}`); vals.push(patch.icon); }
    if (sets.length === 0) return;
    vals.push(id);
    await db.execute(`UPDATE preset_prompts SET ${sets.join(", ")} WHERE id = $${idx}`, vals);
    set({ loaded: false });
    await get().loadAll();
  },

  deletePreset: async (id) => {
    const preset = get().presets.find((p) => p.id === id);
    if (!preset || preset.is_builtin) return;
    const db = await getDB();
    await db.execute("DELETE FROM preset_prompts WHERE id = $1 AND is_builtin = 0", [id]);
    set({ loaded: false });
    await get().loadAll();
  },
}));

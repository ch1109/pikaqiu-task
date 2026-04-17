import { create } from "zustand";
import { getDB } from "@/services/db";
import type { Skill } from "@/types/skill";

export interface SkillCreateInput {
  name: string;
  display_name: string;
  description: string;
  when_to_use?: string;
  prompt: string;
  icon?: string;
  action_key?: string | null;
  model?: string | null;
}

export interface SkillPatch {
  display_name?: string;
  description?: string;
  when_to_use?: string;
  prompt?: string;
  icon?: string;
  action_key?: string | null;
  model?: string | null;
  enabled?: number;
  sort_order?: number;
}

interface SkillStore {
  skills: Skill[];
  loaded: boolean;

  loadAll: () => Promise<void>;
  reload: () => Promise<void>;
  addSkill: (input: SkillCreateInput) => Promise<void>;
  updateSkill: (id: number, patch: SkillPatch) => Promise<void>;
  deleteSkill: (id: number) => Promise<void>;
  /** 在当前排序中把 skill 向上/下移动一位（by display order） */
  moveSkill: (id: number, direction: "up" | "down") => Promise<void>;
}

/** 规范化命令名：小写 + 仅保留 [a-z0-9-] */
export function normalizeSkillName(raw: string): string {
  return raw.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * 校验技能命令名的合法性，返回 { valid, normalized, hint }。
 * - valid=true：normalized 可直接用
 * - valid=false：hint 说明问题、可能附带建议命令名
 */
export function validateSkillName(raw: string): {
  valid: boolean;
  normalized: string;
  hint?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, normalized: "", hint: "请填写命令名" };
  }
  const normalized = normalizeSkillName(trimmed);
  // 含中文/日文/韩文等 CJK 字符
  const hasCJK = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(trimmed);
  if (!normalized) {
    if (hasCJK) {
      return {
        valid: false,
        normalized: "",
        hint: "命令名不支持中文，请改用英文或拼音，例如 my-skill",
      };
    }
    return {
      valid: false,
      normalized: "",
      hint: "命令名至少包含一个字母或数字",
    };
  }
  // 用户输入大致合法但包含非法字符被转换：提示差异
  if (normalized !== trimmed.toLowerCase()) {
    return {
      valid: true,
      normalized,
      hint: `将保存为 /${normalized}（仅支持小写字母、数字、连字符）`,
    };
  }
  return { valid: true, normalized };
}

export const useSkillStore = create<SkillStore>((set, get) => ({
  skills: [],
  loaded: false,

  loadAll: async () => {
    if (get().loaded) return;
    const db = await getDB();
    const rows = await db.select<Skill[]>(
      "SELECT * FROM skills ORDER BY sort_order, id"
    );
    set({ skills: rows, loaded: true });
  },

  reload: async () => {
    const db = await getDB();
    const rows = await db.select<Skill[]>(
      "SELECT * FROM skills ORDER BY sort_order, id"
    );
    set({ skills: rows, loaded: true });
  },

  addSkill: async (input) => {
    const name = normalizeSkillName(input.name);
    if (!name) throw new Error("技能命令名不能为空");
    const db = await getDB();
    const maxOrder = get().skills.reduce((m, s) => Math.max(m, s.sort_order), 0);
    await db.execute(
      `INSERT INTO skills
        (name, display_name, description, when_to_use, prompt, icon, action_key, model, sort_order, is_builtin, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 1)`,
      [
        name,
        input.display_name.trim() || name,
        input.description.trim(),
        (input.when_to_use ?? "").trim(),
        input.prompt,
        input.icon ?? "wand-2",
        input.action_key ?? null,
        input.model ?? null,
        maxOrder + 1,
      ]
    );
    await get().reload();
  },

  updateSkill: async (id, patch) => {
    const target = get().skills.find((s) => s.id === id);
    if (!target) return;
    // 内置技能：仅允许切 enabled / sort_order / description / when_to_use / prompt / icon / action_key / model
    // name 与 display_name 对内置技能锁定（避免破坏命令名约定）
    const db = await getDB();
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    const allow = (key: keyof SkillPatch): boolean => {
      if (!target.is_builtin) return true;
      // 内置禁止改 display_name 以保持一致的文案；其他字段允许
      return key !== "display_name";
    };

    for (const key of Object.keys(patch) as (keyof SkillPatch)[]) {
      if (!allow(key)) continue;
      const v = patch[key];
      if (v === undefined) continue;
      sets.push(`${key} = $${idx++}`);
      vals.push(v);
    }
    if (sets.length === 0) return;
    vals.push(id);
    await db.execute(`UPDATE skills SET ${sets.join(", ")} WHERE id = $${idx}`, vals);
    await get().reload();
  },

  deleteSkill: async (id) => {
    const target = get().skills.find((s) => s.id === id);
    if (!target || target.is_builtin) return;
    const db = await getDB();
    await db.execute("DELETE FROM skills WHERE id = $1 AND is_builtin = 0", [id]);
    await get().reload();
  },

  moveSkill: async (id, direction) => {
    const sorted = [...get().skills].sort(
      (a, b) => a.sort_order - b.sort_order || a.id - b.id
    );
    const idx = sorted.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const a = sorted[idx];
    const b = sorted[swapIdx];
    // 交换 sort_order
    const db = await getDB();
    await db.execute("UPDATE skills SET sort_order = $1 WHERE id = $2", [b.sort_order, a.id]);
    await db.execute("UPDATE skills SET sort_order = $1 WHERE id = $2", [a.sort_order, b.id]);
    await get().reload();
  },
}));

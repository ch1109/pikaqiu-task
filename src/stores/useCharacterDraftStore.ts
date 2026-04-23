import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { getDB } from "@/services/db";
import type {
  CharacterDraft,
  DraftPayload,
  WizardStep,
} from "@/types/character";

interface DraftRow {
  id: string;
  step: number;
  payload: string;
  created_at: string;
  updated_at: string;
}

function emptyPayload(): DraftPayload {
  return {
    name: "",
    description: "",
    refined_prompt: "",
    base_image_b64: null,
    base_image_candidates: [],
    base_image_seed: null,
    base_image_provider: "",
    actions: [],
    frames: {},
    frames_done: {},
  };
}

function parseDraft(row: DraftRow): CharacterDraft {
  return {
    id: row.id,
    step: Math.max(1, Math.min(5, row.step)) as WizardStep,
    payload: JSON.parse(row.payload),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

interface DraftStore {
  draft: CharacterDraft | null;
  loaded: boolean;

  /** 读取最新的一条草稿（若多条取 updated_at 最大） */
  loadLatest: () => Promise<CharacterDraft | null>;

  /** 新建一条空草稿（覆盖当前 draft）。返回生成的 draft */
  createNew: () => Promise<CharacterDraft>;

  /** 合并更新 payload；自动写回 DB */
  updatePayload: (patch: Partial<DraftPayload>) => Promise<void>;

  setStep: (step: WizardStep) => Promise<void>;

  /** 丢弃当前草稿（DB + 本地 + Rust 文件夹） */
  discard: () => Promise<void>;
}

export const useCharacterDraftStore = create<DraftStore>((set, get) => ({
  draft: null,
  loaded: false,

  loadLatest: async () => {
    const db = await getDB();
    const rows = await db.select<DraftRow[]>(
      "SELECT * FROM character_drafts ORDER BY updated_at DESC LIMIT 1"
    );
    const draft = rows[0] ? parseDraft(rows[0]) : null;
    set({ draft, loaded: true });
    return draft;
  },

  createNew: async () => {
    const db = await getDB();
    const id = crypto.randomUUID();
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    const payload = emptyPayload();
    await db.execute(
      `INSERT INTO character_drafts (id, step, payload, created_at, updated_at)
       VALUES ($1, 1, $2, $3, $3)`,
      [id, JSON.stringify(payload), now]
    );
    const draft: CharacterDraft = {
      id,
      step: 1,
      payload,
      created_at: now,
      updated_at: now,
    };
    set({ draft, loaded: true });
    return draft;
  },

  updatePayload: async (patch) => {
    const cur = get().draft;
    if (!cur) return;
    const next: CharacterDraft = {
      ...cur,
      payload: { ...cur.payload, ...patch },
      updated_at: new Date().toISOString().slice(0, 19).replace("T", " "),
    };
    const db = await getDB();
    await db.execute(
      `UPDATE character_drafts SET payload = $1, updated_at = $2 WHERE id = $3`,
      [JSON.stringify(next.payload), next.updated_at, next.id]
    );
    set({ draft: next });
  },

  setStep: async (step) => {
    const cur = get().draft;
    if (!cur) return;
    const db = await getDB();
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    await db.execute(
      `UPDATE character_drafts SET step = $1, updated_at = $2 WHERE id = $3`,
      [step, now, cur.id]
    );
    set({ draft: { ...cur, step, updated_at: now } });
  },

  discard: async () => {
    const cur = get().draft;
    if (!cur) return;
    const db = await getDB();
    await db.execute("DELETE FROM character_drafts WHERE id = $1", [cur.id]);
    try {
      await invoke("draft_delete_dir", { draftId: cur.id });
    } catch {
      // 目录可能尚未创建
    }
    set({ draft: null });
  },
}));

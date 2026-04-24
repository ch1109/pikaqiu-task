import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { getDB } from "./db";
import type {
  CustomCharacter,
  CharacterAnimation,
  ActionSpec,
  LoopMode,
} from "@/types/character";
import type { PetState } from "@/types/pet";

/** 事件：角色被激活/删除/创建后广播，所有窗口刷新 */
export const CHARACTER_CHANGED = "character-changed";

export async function listCharacters(): Promise<CustomCharacter[]> {
  const db = await getDB();
  return db.select<CustomCharacter[]>(
    "SELECT * FROM custom_characters ORDER BY updated_at DESC"
  );
}

export async function getActiveCharacter(): Promise<CustomCharacter | null> {
  const db = await getDB();
  const rows = await db.select<CustomCharacter[]>(
    "SELECT * FROM custom_characters WHERE is_active = 1 LIMIT 1"
  );
  return rows[0] ?? null;
}

export async function getCharacter(
  id: string
): Promise<CustomCharacter | null> {
  const db = await getDB();
  const rows = await db.select<CustomCharacter[]>(
    "SELECT * FROM custom_characters WHERE id = $1",
    [id]
  );
  return rows[0] ?? null;
}

export async function listAnimations(
  characterId: string
): Promise<CharacterAnimation[]> {
  const db = await getDB();
  return db.select<CharacterAnimation[]>(
    "SELECT * FROM character_animations WHERE character_id = $1 ORDER BY created_at",
    [characterId]
  );
}

/** 激活角色（全局只允许一个 is_active=1，其余置 0）；不存在 id 时 → 清空激活 */
export async function setActiveCharacter(
  characterId: string | null
): Promise<void> {
  const db = await getDB();
  await db.execute("UPDATE custom_characters SET is_active = 0");
  if (characterId) {
    await db.execute(
      "UPDATE custom_characters SET is_active = 1 WHERE id = $1",
      [characterId]
    );
  }
  await emit(CHARACTER_CHANGED);
}

export async function deleteCharacter(id: string): Promise<void> {
  const db = await getDB();
  await db.execute("DELETE FROM custom_characters WHERE id = $1", [id]);
  try {
    await invoke("character_delete_dir", { characterId: id });
  } catch {
    // 文件夹可能已不存在，忽略
  }
  await emit(CHARACTER_CHANGED);
}

/**
 * 创建角色主记录 + 批量插入 animations。
 *
 * 设计：调用方（characterGenerator）已完成所有帧落盘后再调这个函数，
 * 让 DB 写入成为事务里"最后一步"—— 失败时草稿仍在可恢复。
 */
export async function createCharacterWithAnimations(input: {
  id: string;
  name: string;
  description: string;
  ref_prompt: string;
  base_image_path: string;
  seed: number | null;
  provider_used: string;
  cost_total: number;
  animations: Array<{
    action_name: string;
    pet_state_binding: PetState | null;
    prompt_delta: string;
    frames_dir: string;
    frame_count: number;
    fps: number;
    loop_mode: LoopMode;
    /** 迁移 013：可选视频字段 */
    video_path?: string | null;
    video_provider?: string | null;
    video_duration_s?: number | null;
    /** 迁移 014：动作级色键参数（本地导入时用） */
    chroma_key_color?: string | null;
    chroma_key_tolerance?: number | null;
  }>;
}): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  await db.execute(
    `INSERT INTO custom_characters
     (id, name, description, ref_prompt, base_image_path, seed, provider_used,
      cost_total, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $9)`,
    [
      input.id,
      input.name,
      input.description,
      input.ref_prompt,
      input.base_image_path,
      input.seed,
      input.provider_used,
      input.cost_total,
      now,
    ]
  );
  for (const a of input.animations) {
    await db.execute(
      `INSERT INTO character_animations
       (id, character_id, action_name, pet_state_binding, prompt_delta,
        frames_dir, frame_count, fps, loop_mode,
        video_path, video_provider, video_duration_s,
        chroma_key_color, chroma_key_tolerance, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        crypto.randomUUID(),
        input.id,
        a.action_name,
        a.pet_state_binding,
        a.prompt_delta,
        a.frames_dir,
        a.frame_count,
        a.fps,
        a.loop_mode,
        a.video_path ?? null,
        a.video_provider ?? null,
        a.video_duration_s ?? null,
        a.chroma_key_color ?? null,
        a.chroma_key_tolerance ?? null,
        now,
      ]
    );
  }
}

/** 给已存在的动作补/改视频 —— 后期从"动作管理"UI 追加视频时使用 */
export async function updateAnimationVideo(input: {
  characterId: string;
  actionName: string;
  videoPath: string | null;
  videoProvider: string | null;
  videoDurationS: number | null;
}): Promise<void> {
  const db = await getDB();
  await db.execute(
    `UPDATE character_animations
     SET video_path = $1, video_provider = $2, video_duration_s = $3
     WHERE character_id = $4 AND action_name = $5`,
    [
      input.videoPath,
      input.videoProvider,
      input.videoDurationS,
      input.characterId,
      input.actionName,
    ]
  );
  await emit(CHARACTER_CHANGED);
}

/** 把动作规格换算为"调用成本估算"（即梦按张计，ComfyUI 本地 = 0） */
export function estimateActionsCost(
  actions: ActionSpec[],
  unitCostCNY: number
): { totalCalls: number; totalCost: number } {
  const totalCalls = actions.reduce((n, a) => n + a.frame_count, 0);
  return { totalCalls, totalCost: totalCalls * unitCostCNY };
}

/** 从 Rust 端批量读取某动作的帧 data URL 列表（按文件名排序） */
export async function listFramesAsDataUrls(
  characterId: string,
  actionName: string
): Promise<string[]> {
  return invoke<string[]>("character_list_frames", {
    characterId,
    actionName,
  });
}

/**
 * 读取角色根目录 base.png 为 data URL。
 *
 * 实现技巧：character_list_frames 的 action_name 传空串时，
 * 会落到 `characters/<id>/` 根目录，过滤出所有 png —— 约定中只有 base.png 在这层。
 */
export async function readCharacterBaseImage(
  characterId: string
): Promise<string | null> {
  const frames = await listFramesAsDataUrls(characterId, "").catch(() => []);
  return frames[0] ?? null;
}

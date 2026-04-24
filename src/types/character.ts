import type { PetState } from "./pet";

/** 自定义角色主记录（custom_characters 表映射） */
export interface CustomCharacter {
  id: string;
  name: string;
  description: string;
  ref_prompt: string;
  base_image_path: string;
  seed: number | null;
  provider_used: string;
  cost_total: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export type LoopMode = "loop" | "once" | "pingpong";

/** 单个动作的帧集合（character_animations 表映射） */
export interface CharacterAnimation {
  id: string;
  character_id: string;
  action_name: string;
  pet_state_binding: PetState | null;
  prompt_delta: string;
  frames_dir: string;
  frame_count: number;
  fps: number;
  loop_mode: LoopMode;
  /** 迁移 013：抠图后的 WebM 相对路径，如 "<action>/video.webm"；存在则优先播放视频 */
  video_path: string | null;
  video_provider: string | null;
  video_duration_s: number | null;
  /** 迁移 014：动作级色键参数（本地导入时可定制；NULL 走运行时默认 #00FF00 / 80） */
  chroma_key_color: string | null;
  chroma_key_tolerance: number | null;
  created_at: string;
}

/** 向导中一个动作的规格（尚未落库） */
export interface ActionSpec {
  action_name: string;
  pet_state_binding: PetState | null;
  prompt_delta: string;
  frame_count: number;
  fps: number;
  loop_mode: LoopMode;
  /** 是否额外生成 Veo 视频；默认关闭，核心 idle/thinking 可默认开 */
  video_enabled?: boolean;
  /** 视频时长（秒），默认 4 */
  video_duration_s?: number;
}

/** 向导的各个步骤 */
export type WizardStep = 1 | 2 | 3 | 4 | 5;

/** 向导草稿 payload（JSON 序列化存入 character_drafts.payload） */
export interface DraftPayload {
  /** Step 1 */
  name: string;
  description: string;
  refined_prompt: string;
  /** Step 2 */
  base_image_b64: string | null;
  base_image_candidates: string[];
  base_image_seed: number | null;
  base_image_provider: string;
  /** Step 3 */
  actions: ActionSpec[];
  /** Step 4 */
  frames: Record<string, string[]>;
  /** 当前进度（已完成帧数，便于恢复） */
  frames_done: Record<string, number>;
  /** Step 4b（视频）：每个动作的 WebM 相对路径；未生成则不存在 */
  videos?: Record<string, string>;
}

export interface CharacterDraft {
  id: string;
  step: WizardStep;
  payload: DraftPayload;
  created_at: string;
  updated_at: string;
}

/** 内置核心动作映射（新建角色时默认勾选） */
export const CORE_ACTION_BINDINGS: Array<{
  state: PetState;
  default_prompt: string;
}> = [
  { state: "idle", default_prompt: "standing still, gentle breathing, relaxed neutral expression" },
  { state: "thinking", default_prompt: "tilting head slightly, finger on chin, thoughtful expression" },
  { state: "encourage", default_prompt: "cheerful thumbs up, bright smile, encouraging pose" },
  { state: "rest", default_prompt: "eyes closed, peaceful sleeping face, slight nod forward" },
  { state: "reminding", default_prompt: "raising one hand, attentive expression, subtle alert gesture" },
  { state: "celebrating", default_prompt: "arms raised high, wide joyful smile, sparkles around" },
  { state: "coquette", default_prompt: "playful wink, slight head tilt, mischievous smile" },
];

import { invoke } from "@tauri-apps/api/core";
import { chatWithLLM } from "@/services/llm";
import { generateImage } from "@/services/image";
import {
  blobToBase64,
  chromaKeyRemove,
  dataUrlToBlob,
  type ChromaKeyOptions,
} from "@/services/image/chromaKey";
import {
  BASE_IMAGE_NEGATIVE_PROMPT,
  BASE_IMAGE_PROMPT_TEMPLATE,
  ACTION_NEGATIVE_PROMPT,
  buildActionPrompt,
  buildRefineMessages,
} from "@/prompts/characterPrompt";
import type { ActionSpec } from "@/types/character";
import type { Settings } from "@/types/settings";
import {
  createCharacterWithAnimations,
  updateAnimationVideo,
} from "@/services/character";
import { consumeQuota } from "@/services/imageQuota";
import {
  generateActionVideo,
  type VideoProgress,
} from "@/services/video";

/** 无前缀 base64 → 带 data URL 前缀 */
export function b64ToDataUrl(b64: string): string {
  return `data:image/png;base64,${b64}`;
}

/**
 * LLM 润色用户的一句话描述 → 可直接喂给生图的英文 prompt。
 * 失败时兜底返回模板替换结果，保证不中断向导。
 */
export async function refineDescription(userInput: string): Promise<string> {
  if (!userInput.trim()) return "";
  try {
    const msgs = buildRefineMessages(userInput);
    const out = await chatWithLLM(msgs, { temperature: 0.7 });
    return out.trim().replace(/^["']|["']$/g, "");
  } catch {
    // 兜底：直接把用户输入塞到模板里
    return BASE_IMAGE_PROMPT_TEMPLATE.replace("{{DESCRIPTION}}", userInput);
  }
}

/** 把 refined prompt 补齐成最终基准图 prompt（若用户跳过润色，直接用模板填充） */
export function finalizeBasePrompt(refinedOrRaw: string): string {
  const raw = refinedOrRaw.trim();
  if (!raw) return "";
  // 润色模板尾部已包含 "flat pure chroma green" 约定；
  // 若未包含，补上 BASE_IMAGE_PROMPT_TEMPLATE 的固定后缀
  if (/chroma green|#00FF00/i.test(raw)) return raw;
  return BASE_IMAGE_PROMPT_TEMPLATE.replace("{{DESCRIPTION}}", raw);
}

/**
 * Step 2 候选生成：拿 4 张 base 候选，写入 draft 目录（candidates/*.png），
 * 返回 { b64, seed } 列表供 UI 选择。
 */
export async function generateBaseCandidates(opts: {
  draftId: string;
  prompt: string;
  count?: number;
  width?: number;
  height?: number;
  seed?: number;
}): Promise<Array<{ b64: string; seed: number | undefined; index: number }>> {
  const count = opts.count ?? 4;
  await consumeQuota(count);
  const result = await generateImage({
    prompt: opts.prompt,
    negativePrompt: BASE_IMAGE_NEGATIVE_PROMPT,
    width: opts.width ?? 512,
    height: opts.height ?? 512,
    count,
    seed: opts.seed,
  });

  const out: Array<{ b64: string; seed: number | undefined; index: number }> = [];
  for (let i = 0; i < result.images.length; i++) {
    const img = result.images[i];
    if (!img.b64) continue;
    // 候选先保存到 draft 目录，方便大图查看与二次选择
    await invoke("draft_save_png_bytes", {
      draftId: opts.draftId,
      relativePath: `candidates/candidate_${i}.png`,
      bytes: Array.from(base64ToBytes(img.b64)),
    });
    out.push({ b64: img.b64, seed: img.seed, index: i });
  }
  return out;
}

/**
 * 把候选 b64 过色键抠图 → 返回抠图后 PNG 的 base64（不含前缀）。
 * 由 UI 在滑块变更时即时重算。
 */
export async function applyChromaKey(
  b64: string,
  options: ChromaKeyOptions = {}
): Promise<string> {
  const blob = await dataUrlToBlob(b64ToDataUrl(b64));
  const cutout = await chromaKeyRemove(blob, options);
  return blobToBase64(cutout);
}

/**
 * Step 4 单动作帧生成。
 *
 * 为保证跨帧一致性：
 *   - 复用 base seed（+ frameIndex 偏移）
 *   - 以 base 图作为 reference image，强度 0.7
 *   - prompt 为 base 描述 + action delta + 当前帧 hint
 */
export async function generateActionFrames(opts: {
  draftId: string;
  characterDescription: string;
  baseB64: string;
  baseSeed: number;
  action: ActionSpec;
  width?: number;
  height?: number;
  /** 每帧生成完成回调（带 progress，用于 UI 进度条 + 支持暂停） */
  onFrame?: (
    frameIndex: number,
    b64: string,
    info: { seed: number | undefined }
  ) => void | Promise<void>;
}): Promise<Array<{ b64: string; seed: number | undefined }>> {
  const { action } = opts;
  const out: Array<{ b64: string; seed: number | undefined }> = [];

  for (let i = 0; i < action.frame_count; i++) {
    const prompt = buildActionPrompt({
      characterDescription: opts.characterDescription,
      actionName: action.action_name,
      actionDelta: action.prompt_delta,
      frameIndex: i,
      totalFrames: action.frame_count,
    });

    await consumeQuota(1);
    const res = await generateImage({
      prompt,
      negativePrompt: ACTION_NEGATIVE_PROMPT,
      referenceImageB64: opts.baseB64,
      referenceStrength: 0.7,
      width: opts.width ?? 512,
      height: opts.height ?? 512,
      count: 1,
      seed: opts.baseSeed + i,
    });

    const img = res.images[0];
    if (!img?.b64) continue;
    out.push({ b64: img.b64, seed: img.seed });
    await opts.onFrame?.(i, img.b64, { seed: img.seed });
  }
  return out;
}

/**
 * Step 4 单帧重试：用新 seed 重跑指定帧（保持其它参数一致）。
 */
export async function regenerateSingleFrame(opts: {
  characterDescription: string;
  baseB64: string;
  action: ActionSpec;
  frameIndex: number;
  seed: number;
  width?: number;
  height?: number;
}): Promise<{ b64: string; seed: number | undefined } | null> {
  const prompt = buildActionPrompt({
    characterDescription: opts.characterDescription,
    actionName: opts.action.action_name,
    actionDelta: opts.action.prompt_delta,
    frameIndex: opts.frameIndex,
    totalFrames: opts.action.frame_count,
  });
  await consumeQuota(1);
  const res = await generateImage({
    prompt,
    negativePrompt: ACTION_NEGATIVE_PROMPT,
    referenceImageB64: opts.baseB64,
    referenceStrength: 0.7,
    width: opts.width ?? 512,
    height: opts.height ?? 512,
    count: 1,
    seed: opts.seed,
  });
  const img = res.images[0];
  if (!img?.b64) return null;
  return { b64: img.b64, seed: img.seed };
}

/**
 * Step 5 落盘：把草稿里所有帧（已经抠图后的 b64）搬到正式角色目录，
 * 最后写 custom_characters + character_animations。
 *
 * 调用者负责：
 *   - 为每个动作 frames 数组提供"抠图完成"的 b64（不带前缀）
 *   - base_image 同理
 */
export async function promoteDraftToCharacter(opts: {
  draftId: string;
  name: string;
  description: string;
  refPrompt: string;
  baseB64: string;
  baseSeed: number | null;
  providerName: string;
  costTotal: number;
  /**
   * 可选：预分配的角色 ID。向导阶段若先生成视频再落盘帧，
   * 需在 Step 4 起手分配 id 让视频直接写进角色目录。
   */
  characterId?: string;
  actions: Array<{
    spec: ActionSpec;
    frames: string[]; // 每帧 b64，按顺序
    /** 若在向导中已生成视频，传入相对路径 "<action>/video.webm" 一并入库 */
    videoPath?: string | null;
    videoProvider?: string | null;
    videoDurationS?: number | null;
  }>;
}): Promise<string> {
  const characterId = opts.characterId ?? crypto.randomUUID();

  // 1) 保存 base.png
  await invoke("character_save_png_bytes", {
    characterId,
    relativePath: "base.png",
    bytes: Array.from(base64ToBytes(opts.baseB64)),
  });

  // 2) 保存每个动作的帧
  const animationMetas: Array<{
    action_name: string;
    pet_state_binding: ActionSpec["pet_state_binding"];
    prompt_delta: string;
    frames_dir: string;
    frame_count: number;
    fps: number;
    loop_mode: ActionSpec["loop_mode"];
    video_path?: string | null;
    video_provider?: string | null;
    video_duration_s?: number | null;
  }> = [];
  for (const a of opts.actions) {
    const dir = a.spec.action_name;
    for (let i = 0; i < a.frames.length; i++) {
      await invoke("character_save_png_bytes", {
        characterId,
        relativePath: `${dir}/frame_${String(i).padStart(3, "0")}.png`,
        bytes: Array.from(base64ToBytes(a.frames[i])),
      });
    }
    animationMetas.push({
      action_name: a.spec.action_name,
      pet_state_binding: a.spec.pet_state_binding,
      prompt_delta: a.spec.prompt_delta,
      frames_dir: dir,
      frame_count: a.frames.length,
      fps: a.spec.fps,
      loop_mode: a.spec.loop_mode,
      video_path: a.videoPath ?? null,
      video_provider: a.videoProvider ?? null,
      video_duration_s: a.videoDurationS ?? null,
    });
  }

  // 3) 写入 DB
  await createCharacterWithAnimations({
    id: characterId,
    name: opts.name,
    description: opts.description,
    ref_prompt: opts.refPrompt,
    base_image_path: "base.png",
    seed: opts.baseSeed,
    provider_used: opts.providerName,
    cost_total: opts.costTotal,
    animations: animationMetas,
  });

  return characterId;
}

/**
 * 为单个动作生成 Veo 视频并抠绿幕落盘。
 *
 * 两种调用场景：
 *   1. 向导中（角色未入库）：调用前先 allocCharacterId，视频直落正式目录；
 *      完成后把 videoPath 传给 promoteDraftToCharacter 一起入库。
 *   2. 后期补视频（角色已入库）：生成完成后调 updateAnimationVideo 写 DB。
 *
 * `updateDb=false` 时仅落盘不写 DB，由调用方自行决定入库时机。
 */
export async function generateVideoForAction(opts: {
  characterId: string;
  action: ActionSpec;
  characterDescription: string;
  baseImageB64: string;
  settings: Settings;
  /** 是否直接写 character_animations 的 video_path 字段（默认 true） */
  updateDb?: boolean;
  onProgress?: (p: VideoProgress) => void;
}): Promise<{
  videoPath: string;
  providerName: string;
  durationS: number;
}> {
  const result = await generateActionVideo({
    characterId: opts.characterId,
    action: opts.action,
    characterDescription: opts.characterDescription,
    baseImageB64: opts.baseImageB64,
    settings: opts.settings,
    onProgress: opts.onProgress,
  });
  const durationS = opts.action.video_duration_s ?? 4;
  if (opts.updateDb ?? true) {
    await updateAnimationVideo({
      characterId: opts.characterId,
      actionName: opts.action.action_name,
      videoPath: result.videoPath,
      videoProvider: result.providerName,
      videoDurationS: durationS,
    });
  }
  return {
    videoPath: result.videoPath,
    providerName: result.providerName,
    durationS,
  };
}

/** 预分配角色 ID — 向导需要在落盘视频前拿到 id 时使用 */
export function allocCharacterId(): string {
  return crypto.randomUUID();
}

/** 纯浏览器环境下把 base64 解为 Uint8Array，供 Rust invoke 的 bytes 参数使用 */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

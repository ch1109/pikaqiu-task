import { invoke } from "@tauri-apps/api/core";
import type { Settings, VideoGenProviderName } from "@/types/settings";
import type { ActionSpec } from "@/types/character";
import {
  VENDOR_PRESETS,
  parseCustomConfig,
} from "@/services/providers/presets";
import {
  COMFYUI_HUNYUAN_I2V_WORKFLOW_TEMPLATE,
  hunyuanFramesForDuration,
  injectUserVideoWorkflow,
  injectVideoWorkflow,
} from "@/services/image/workflows/comfyuiVideoI2v";

export type VideoProviderName = VideoGenProviderName;

export type VideoProgressPhase =
  | "preparing"
  | "submitting"
  | "polling"
  | "downloading"
  | "chromakey"
  | "done";

export interface VideoProgress {
  phase: VideoProgressPhase;
  pollAttempt?: number;
  message?: string;
}

export interface GenerateActionVideoOptions {
  characterId: string;
  action: ActionSpec;
  characterDescription: string;
  /** 基准图 base64（不含 data: 前缀） */
  baseImageB64: string;
  settings: Settings;
  onProgress?: (p: VideoProgress) => void;
}

/** Seedance 2.0 慢，统一放宽到 15 分钟（90 × 10s） */
const MAX_POLL_ATTEMPTS = 90;
const POLL_INTERVAL_MS = 10_000;

/**
 * 构造通用视频 prompt：角色外观 + 动作 + 无缝循环 + 纯绿背景。
 * 5 家厂商都吃英文 prompt，同一套模板通用。
 */
export function buildVideoPrompt(opts: {
  characterDescription: string;
  action: ActionSpec;
}): string {
  const duration = opts.action.video_duration_s ?? 4;
  return (
    `${opts.characterDescription}, ${opts.action.prompt_delta}, ` +
    `${duration} seconds seamless looping animation, subtle continuous motion, start pose equals end pose, ` +
    `same character same outfit same art style, single character centered full body front view, ` +
    `flat pure chroma green background #00FF00, solid green no gradient no shadow, static camera, no scene change, ` +
    `2d animation, game sprite style`
  );
}

export const VIDEO_NEGATIVE_PROMPT =
  "photographic realism, 3d rendering, complex background, gradient background, " +
  "shadow on ground, multiple characters, crowd, scene change, camera pan, camera zoom, " +
  "text overlay, watermark, signature, blurry, low quality";

interface StartResult {
  provider: VideoProviderName;
  task_id: string;
}

interface PollResult {
  done: boolean;
  video_uri?: string;
  error?: string;
}

/**
 * 生成单个动作的视频并抠绿幕。按 settings.video_gen_provider 分发到对应厂商。
 * 返回：角色目录下的相对路径（写 DB 用）
 */
export async function generateActionVideo(
  opts: GenerateActionVideoOptions
): Promise<{ videoPath: string; providerName: VideoProviderName }> {
  const { settings, action, characterId } = opts;
  const providerName: VideoProviderName = settings.video_gen_provider;
  const preset = VENDOR_PRESETS[providerName];
  const notify = (p: VideoProgress) => opts.onProgress?.(p);

  notify({ phase: "preparing", message: "正在检测 ffmpeg" });
  const ffmpegOk = await invoke<boolean>("video_check_ffmpeg");
  if (!ffmpegOk) {
    throw new Error(
      "未检测到 ffmpeg。请先安装 ffmpeg 并确保命令在系统 PATH 中（macOS: brew install ffmpeg）。"
    );
  }

  const apiUrl = settings.video_gen_api_url || preset.video?.endpoint || "";
  const apiKey = settings.video_gen_api_key.trim();
  const model = settings.video_gen_model || preset.video?.defaultModel || "";

  if (!apiKey && preset.authKind !== "local") {
    throw new Error(
      `未配置 ${preset.label} API Key，请在设置面板填写`
    );
  }
  if (providerName === "kling" && !settings.kling_secret_key.trim()) {
    throw new Error("可灵需要 AccessKey + SecretKey 组合，请在设置面板补充 SK");
  }

  const prompt = buildVideoPrompt({
    characterDescription: opts.characterDescription,
    action,
  });
  const duration = action.video_duration_s ?? 4;
  const aspectRatio = preset.video?.defaultAspectRatio ?? "9:16";

  const submitPayload: Record<string, unknown> = {
    prompt,
    base_image_b64: opts.baseImageB64,
    aspect_ratio: aspectRatio,
    duration_s: duration,
    negative_prompt: VIDEO_NEGATIVE_PROMPT,
  };
  if (providerName === "kling") {
    submitPayload.secret_key = settings.kling_secret_key;
  }
  if (providerName === "replicate") {
    const custom = parseCustomConfig(settings.custom_provider_config);
    if (custom.replicate_video_version) {
      submitPayload.replicate_video_version = custom.replicate_video_version;
    }
  }
  if (providerName === "comfyui") {
    const custom = parseCustomConfig(settings.custom_provider_config);
    const userRaw = (custom.comfyui_video_workflow_json || "").trim();
    const [vw, vh] = comfyuiVideoDims(aspectRatio);
    const seed = Math.floor(Math.random() * 2 ** 31);
    let workflow: unknown;
    if (userRaw) {
      try {
        workflow = injectUserVideoWorkflow(userRaw, {
          PROMPT: prompt,
          NEG_PROMPT: VIDEO_NEGATIVE_PROMPT,
          IMAGE_B64: opts.baseImageB64,
          SEED: seed,
        });
      } catch (e) {
        throw new Error(
          `ComfyUI 视频工作流 JSON 解析失败：${(e as Error).message}。请确认粘贴的是 ComfyUI「保存（API 格式）」导出的内容`
        );
      }
    } else {
      workflow = injectVideoWorkflow(COMFYUI_HUNYUAN_I2V_WORKFLOW_TEMPLATE, {
        SEED: seed,
        WIDTH: vw,
        HEIGHT: vh,
        LENGTH: hunyuanFramesForDuration(duration),
        PROMPT: prompt,
        NEG_PROMPT: VIDEO_NEGATIVE_PROMPT,
        IMAGE_B64: opts.baseImageB64,
      });
    }
    submitPayload.workflow_json = JSON.stringify(workflow);
  }

  notify({ phase: "submitting", message: `提交 ${preset.shortLabel} 任务` });
  const start = await invoke<StartResult>("video_generate_start", {
    provider: providerName,
    apiUrl,
    apiKey,
    model,
    payload: submitPayload,
  });

  const extra: Record<string, string> | undefined =
    providerName === "kling"
      ? { secret_key: settings.kling_secret_key }
      : undefined;

  let videoUri: string | null = null;
  for (let i = 1; i <= MAX_POLL_ATTEMPTS; i++) {
    notify({
      phase: "polling",
      pollAttempt: i,
      message: `生成中（${(i * POLL_INTERVAL_MS) / 1000}s）`,
    });
    await sleep(POLL_INTERVAL_MS);
    const status = await invoke<PollResult>("video_poll_operation", {
      provider: providerName,
      apiUrl,
      apiKey,
      taskId: start.task_id,
      extra,
    });
    if (status.error) {
      throw new Error(`${preset.shortLabel} 生成失败: ${status.error}`);
    }
    if (status.done && status.video_uri) {
      videoUri = status.video_uri;
      break;
    }
  }
  if (!videoUri) {
    throw new Error(
      `${preset.shortLabel} 生成超时（${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 60_000} 分钟未完成）。`
    );
  }

  notify({ phase: "downloading", message: "下载视频" });
  const rawRelative = `${action.action_name}/video.raw.mp4`;
  await invoke<string>("video_download_to_character", {
    provider: providerName,
    apiUrl,
    apiKey,
    videoUri,
    characterId,
    relativePath: rawRelative,
  });

  notify({ phase: "chromakey", message: "抠除绿幕 → WebM alpha" });
  const outRelative = `${action.action_name}/video.webm`;
  await invoke<string>("video_chroma_key", {
    characterId,
    inputRelative: rawRelative,
    outputRelative: outRelative,
    keyColorHex: settings.chroma_key_color || "#00FF00",
    similarity: Math.min(1, Math.max(0.05, settings.chroma_key_tolerance / 100)),
    blend: 0.1,
  });

  notify({ phase: "done" });
  return { videoPath: outRelative, providerName };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function comfyuiVideoDims(ratio: string): [number, number] {
  switch (ratio) {
    case "16:9":
      return [960, 544];
    case "1:1":
      return [720, 720];
    default:
      return [544, 960];
  }
}

/**
 * 读取角色目录下的 WebM 视频为可播放的 Blob URL。
 * 调用方负责在组件卸载 / 切换角色时 URL.revokeObjectURL。
 */
export async function readVideoAsBlobUrl(
  characterId: string,
  relativePath: string
): Promise<string> {
  const bytes = await invoke<number[]>("character_read_bytes", {
    characterId,
    relativePath,
  });
  const blob = new Blob([new Uint8Array(bytes)], {
    type: inferVideoMime(relativePath),
  });
  return URL.createObjectURL(blob);
}

function inferVideoMime(relativePath: string): string {
  const lc = relativePath.toLowerCase();
  if (lc.endsWith(".webm")) return "video/webm";
  if (lc.endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
}

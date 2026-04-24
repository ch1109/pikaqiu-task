import type { AIVendorId } from "@/types/settings";

export interface VendorImageCapability {
  endpoint: string;
  defaultModel: string;
}

export interface VendorVideoCapability {
  endpoint: string;
  defaultModel: string;
  /** 该厂商允许的时长选项（秒） */
  durations: number[];
  /** 该厂商的默认 i2v 画面比例 */
  defaultAspectRatio: "9:16" | "16:9" | "1:1";
}

export type AuthKind =
  | "bearer"         // Authorization: Bearer <key>
  | "replicate-token" // Authorization: Token <key>（Replicate 特殊）
  | "google-header"  // x-goog-api-key: <key>
  | "kling-jwt"      // Rust 端用 ak+sk 签 JWT
  | "local";         // 无 key

/** 动态字段 —— 针对开源 Provider（模型 version / 图像尺寸等按需配置） */
export interface CustomFieldDef {
  /** 写入 settings.custom_provider_config JSON 的 key */
  key: string;
  label: string;
  placeholder?: string;
  help?: string;
  defaultValue?: string;
  appliesTo: "image" | "video" | "both";
  kind?: "text" | "select";
  options?: { label: string; value: string }[];
}

export interface VendorPreset {
  id: AIVendorId;
  label: string;
  shortLabel: string;
  authKind: AuthKind;
  keyLabel: string;
  /** Kling: 需 AK + SK；其他 vendor = false */
  needsSecretKey?: boolean;
  /** UI 顶部提示（可选） */
  hint?: string;
  image?: VendorImageCapability;
  video?: VendorVideoCapability;
  /** 开源 Provider 的按需字段（非开源 vendor 留空） */
  customFields?: CustomFieldDef[];
  /** 部署形态：cloud = 云端 API，local = 用户本地部署的服务 */
  deployType: "cloud" | "local";
  /** 本地 vendor 的 endpoint 一键填充建议（UI 显示 chip 按钮） */
  localPortHints?: { label: string; url: string }[];
}

export const VENDOR_PRESETS: Record<AIVendorId, VendorPreset> = {
  jimeng: {
    id: "jimeng",
    label: "即梦（火山方舟）",
    shortLabel: "即梦",
    authKind: "bearer",
    keyLabel: "API Key",
    deployType: "cloud",
    hint: "豆包/即梦统一 Ark Key，同一把 Key 同时调用 Seedream (t2i) 与 Seedance (i2v)",
    image: {
      endpoint: "https://ark.cn-beijing.volces.com/api/v3",
      defaultModel: "doubao-seedream-4-0-250828",
    },
    video: {
      endpoint: "https://ark.cn-beijing.volces.com/api/v3",
      defaultModel: "doubao-seedance-2-0-260128",
      durations: [4, 5, 6, 8, 10],
      defaultAspectRatio: "9:16",
    },
  },

  kling: {
    id: "kling",
    label: "可灵（Kling）",
    shortLabel: "可灵",
    authKind: "kling-jwt",
    keyLabel: "Access Key (AK)",
    needsSecretKey: true,
    deployType: "cloud",
    hint: "可灵需 AK + SK 组合，Rust 端实时签 JWT（30 分钟过期自动刷新）",
    image: {
      endpoint: "https://api.klingai.com",
      defaultModel: "kling-v2",
    },
    video: {
      endpoint: "https://api.klingai.com",
      defaultModel: "kling-v1-6",
      durations: [5, 10],
      defaultAspectRatio: "9:16",
    },
  },

  minimax: {
    id: "minimax",
    label: "海螺（MiniMax Hailuo）",
    shortLabel: "海螺",
    authKind: "bearer",
    keyLabel: "API Key",
    deployType: "cloud",
    hint: "海螺视频任务完成后需多调一次 /files/retrieve 拿下载 URL",
    image: {
      endpoint: "https://api.minimaxi.com",
      defaultModel: "image-01",
    },
    video: {
      endpoint: "https://api.minimaxi.com",
      defaultModel: "MiniMax-Hailuo-02",
      durations: [6, 10],
      defaultAspectRatio: "9:16",
    },
  },

  vidu: {
    id: "vidu",
    label: "Vidu",
    shortLabel: "Vidu",
    authKind: "bearer",
    keyLabel: "API Key",
    deployType: "cloud",
    hint: "Vidu 仅支持视频生成，如需配套图像请在「图像与视频用不同厂商」高级模式里另选一家",
    video: {
      endpoint: "https://api.vidu.com",
      defaultModel: "vidu2.0",
      durations: [4, 8],
      defaultAspectRatio: "9:16",
    },
  },

  gemini: {
    id: "gemini",
    label: "Gemini Veo 3.1",
    shortLabel: "Veo 3.1",
    authKind: "google-header",
    keyLabel: "API Key",
    deployType: "cloud",
    hint: "Veo 仅视频，需本地安装 ffmpeg 抠绿幕。Google AI Studio 签发的 API Key",
    video: {
      endpoint: "https://generativelanguage.googleapis.com/v1beta",
      defaultModel: "veo-3.1-generate-preview",
      durations: [4, 6, 8],
      defaultAspectRatio: "9:16",
    },
  },

  comfyui: {
    id: "comfyui",
    label: "ComfyUI（本地）",
    shortLabel: "ComfyUI",
    authKind: "local",
    keyLabel: "",
    deployType: "local",
    hint: "本地 ComfyUI，图像 + 视频工作流通吃。视频需在下方粘贴包含 LoadImageBase64 + VHS_VideoCombine 的 API 格式工作流 JSON",
    image: {
      endpoint: "http://127.0.0.1:8188",
      defaultModel: "sd_xl_base_1.0.safetensors",
    },
    video: {
      endpoint: "http://127.0.0.1:8188",
      defaultModel: "hunyuan-video-i2v",
      durations: [3, 5, 8],
      defaultAspectRatio: "9:16",
    },
    localPortHints: [
      { label: "默认 :8188", url: "http://127.0.0.1:8188" },
      { label: "备用 :8000", url: "http://127.0.0.1:8000" },
    ],
    customFields: [
      {
        key: "comfyui_video_workflow_json",
        label: "视频工作流 JSON",
        appliesTo: "video",
        kind: "text",
        help: "从 ComfyUI 右上角『保存』→『API 格式』导出并粘贴；留空则使用内置 HunyuanVideo i2v 模板（依赖 VideoHelperSuite + KJNodes 插件）",
      },
    ],
  },

  "openai-compat": {
    id: "openai-compat",
    label: "OpenAI 兼容端点",
    shortLabel: "OpenAI Compat",
    authKind: "bearer",
    keyLabel: "API Key",
    deployType: "local",
    hint: "适配任何实现 OpenAI 图像协议的服务：LocalAI / Ollama / vLLM / Together AI / OpenRouter / SiliconFlow 等。仅图像生成",
    image: {
      endpoint: "http://127.0.0.1:8080/v1",
      defaultModel: "dall-e-3",
    },
    localPortHints: [
      { label: "LocalAI :8080", url: "http://127.0.0.1:8080/v1" },
      { label: "Ollama :11434", url: "http://127.0.0.1:11434/v1" },
      { label: "vLLM :8000", url: "http://127.0.0.1:8000/v1" },
    ],
    customFields: [
      {
        key: "openai_compat_image_size",
        label: "图像尺寸",
        defaultValue: "1024x1024",
        appliesTo: "image",
        kind: "select",
        options: [
          { label: "1024×1024", value: "1024x1024" },
          { label: "1792×1024", value: "1792x1024" },
          { label: "1024×1792", value: "1024x1792" },
          { label: "512×512", value: "512x512" },
          { label: "768×768", value: "768x768" },
        ],
        help: "部分自部署模型仅支持 512/768，按实际情况选择",
      },
      {
        key: "openai_compat_response_format",
        label: "返回格式",
        defaultValue: "b64_json",
        appliesTo: "image",
        kind: "select",
        options: [
          { label: "Base64（推荐）", value: "b64_json" },
          { label: "URL（多一次下载）", value: "url" },
        ],
      },
    ],
  },

  replicate: {
    id: "replicate",
    label: "Replicate",
    shortLabel: "Replicate",
    authKind: "replicate-token",
    keyLabel: "API Token",
    deployType: "cloud",
    hint: "Replicate 托管平台，覆盖 FLUX / SDXL / HunyuanVideo / Mochi-1 / CogVideoX / LTX-Video 等主流开源模型",
    image: {
      endpoint: "https://api.replicate.com",
      defaultModel: "black-forest-labs/flux-schnell",
    },
    video: {
      endpoint: "https://api.replicate.com",
      defaultModel: "tencent/hunyuan-video",
      durations: [3, 5],
      defaultAspectRatio: "9:16",
    },
    customFields: [
      {
        key: "replicate_image_version",
        label: "图像模型 version",
        appliesTo: "image",
        placeholder: "owner/model 或 owner/model:hash",
        help: "留空则使用上方「图像模型」字段。带 ':' 后缀即为锁定版本 hash",
      },
      {
        key: "replicate_video_version",
        label: "视频模型 version",
        appliesTo: "video",
        placeholder: "tencent/hunyuan-video:<hash>",
        help: "HunyuanVideo / CogVideoX / Mochi-1 / LTX-Video 等，建议填带 hash 的完整版本",
      },
    ],
  },
};

/** UI 顶部 Tab 顺序：按部署形态分组 —— 先云端，再本地 */
export const VENDOR_TAB_ORDER: AIVendorId[] = [
  "jimeng",
  "kling",
  "minimax",
  "vidu",
  "gemini",
  "replicate",
  "comfyui",
  "openai-compat",
];

/** 按部署形态分组的 Tab 顺序，UI 用它渲染「云端 API」/「本地部署」两行 */
export const VENDOR_GROUPS: {
  key: "cloud" | "local";
  label: string;
  hint: string;
  vendors: AIVendorId[];
}[] = [
  {
    key: "cloud",
    label: "云端 API",
    hint: "按 Key 计费，提交任务即可开跑",
    vendors: VENDOR_TAB_ORDER.filter(
      (id) => VENDOR_PRESETS[id].deployType === "cloud"
    ),
  },
  {
    key: "local",
    label: "本地部署",
    hint: "连接你自己电脑上启动的开源服务",
    vendors: VENDOR_TAB_ORDER.filter(
      (id) => VENDOR_PRESETS[id].deployType === "local"
    ),
  },
];

/** 解析 settings.custom_provider_config JSON 字符串 */
export function parseCustomConfig(
  raw: string | undefined | null
): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string") out[k] = v;
      }
      return out;
    }
  } catch {
    /* 坏 JSON 视为空 */
  }
  return {};
}

/** 序列化回 JSON 字符串（空对象写成 `{}` 而非 ""） */
export function serializeCustomConfig(
  cfg: Record<string, string>
): string {
  return JSON.stringify(cfg ?? {});
}

/** 能做图像生成的 vendor */
export const IMAGE_CAPABLE_VENDORS: AIVendorId[] = (
  Object.keys(VENDOR_PRESETS) as AIVendorId[]
).filter((id) => VENDOR_PRESETS[id].image !== undefined);

/** 能做视频生成的 vendor */
export const VIDEO_CAPABLE_VENDORS: AIVendorId[] = (
  Object.keys(VENDOR_PRESETS) as AIVendorId[]
).filter((id) => VENDOR_PRESETS[id].video !== undefined);

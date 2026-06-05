import type { VideoGenProviderName } from "@/types/settings";

export interface VideoProviderMeta {
  label: string;
  shortLabel: string;
  perSecondCNY: number;
  notes?: string;
}

export const VIDEO_PROVIDER_CATALOG: Record<VideoGenProviderName, VideoProviderMeta> = {
  gemini: {
    label: "Google Gemini Veo",
    shortLabel: "Veo",
    perSecondCNY: 2.7,
  },
  jimeng: {
    label: "字节即梦 Seedance",
    shortLabel: "即梦",
    perSecondCNY: 0.72,
  },
  kling: {
    label: "可灵 Kling i2v",
    shortLabel: "可灵",
    perSecondCNY: 1.44,
  },
  minimax: {
    label: "MiniMax 海螺",
    shortLabel: "海螺",
    perSecondCNY: 1.3,
  },
  vidu: {
    label: "Vidu",
    shortLabel: "Vidu",
    perSecondCNY: 0.58,
  },
  replicate: {
    label: "Replicate (聚合)",
    shortLabel: "Replicate",
    perSecondCNY: 2.16,
    notes: "费率视具体 model 浮动",
  },
  comfyui: {
    label: "本地 ComfyUI",
    shortLabel: "本地",
    perSecondCNY: 0,
    notes: "本地推理,免费",
  },
};

export function videoProviderMeta(name: VideoGenProviderName): VideoProviderMeta {
  return VIDEO_PROVIDER_CATALOG[name] ?? VIDEO_PROVIDER_CATALOG.gemini;
}

export const VIDEO_PROVIDER_ORDER: VideoGenProviderName[] = [
  "gemini",
  "jimeng",
  "kling",
  "minimax",
  "vidu",
  "replicate",
  "comfyui",
];

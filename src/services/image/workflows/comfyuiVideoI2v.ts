/**
 * ComfyUI 内置视频工作流（HunyuanVideo i2v 默认模板）。
 *
 * 适用场景：
 *   用户在「AI 创作平台 → ComfyUI」里未粘贴自定义视频工作流 JSON 时的回退。
 *
 * 依赖插件（ComfyUI 侧）：
 *   - ComfyUI-VideoHelperSuite（提供 LoadImageBase64 + VHS_VideoCombine）
 *   - HunyuanVideo 原生节点（ComfyUI ≥ 0.3 自带，包含 HunyuanImageToVideo）
 *
 * 依赖模型（需预先放入 ComfyUI/models/）：
 *   - diffusion_models/hunyuan_video_image_to_video_720p_bf16.safetensors
 *   - vae/hunyuan_video_vae_bf16.safetensors
 *   - clip/clip_l.safetensors + llava_llama3_fp8_scaled.safetensors
 *   - clip_vision/llava_llama3_vision.safetensors
 *
 * 占位符约定：数字型外套 `"__KEY__"` 形式，注入时被替换为裸数字。
 *   __SEED__      → number
 *   __WIDTH__     → number
 *   __HEIGHT__    → number
 *   __LENGTH__    → number（帧数，HunyuanVideo 建议 4n+1：73 / 93 / 129 …）
 *   __PROMPT__    → string
 *   __NEG_PROMPT__→ string
 *   __IMAGE_B64__ → string（参考图 base64，不含 data: 前缀）
 */
export const COMFYUI_HUNYUAN_I2V_WORKFLOW_TEMPLATE = `{
  "3": {
    "inputs": {
      "seed": "__SEED__",
      "steps": 20,
      "cfg": 6.0,
      "sampler_name": "euler",
      "scheduler": "simple",
      "denoise": 1.0,
      "model": ["12", 0],
      "positive": ["44", 0],
      "negative": ["7", 0],
      "latent_image": ["44", 2]
    },
    "class_type": "KSampler"
  },
  "6": {
    "inputs": { "text": "__PROMPT__", "clip": ["11", 0] },
    "class_type": "CLIPTextEncode"
  },
  "7": {
    "inputs": { "text": "__NEG_PROMPT__", "clip": ["11", 0] },
    "class_type": "CLIPTextEncode"
  },
  "8": {
    "inputs": { "samples": ["3", 0], "vae": ["10", 0] },
    "class_type": "VAEDecode"
  },
  "10": {
    "inputs": { "vae_name": "hunyuan_video_vae_bf16.safetensors" },
    "class_type": "VAELoader"
  },
  "11": {
    "inputs": {
      "clip_name1": "clip_l.safetensors",
      "clip_name2": "llava_llama3_fp8_scaled.safetensors",
      "type": "hunyuan_video"
    },
    "class_type": "DualCLIPLoader"
  },
  "12": {
    "inputs": {
      "unet_name": "hunyuan_video_image_to_video_720p_bf16.safetensors",
      "weight_dtype": "default"
    },
    "class_type": "UNETLoader"
  },
  "40": {
    "inputs": { "image": "__IMAGE_B64__" },
    "class_type": "LoadImageBase64"
  },
  "42": {
    "inputs": { "clip_name": "llava_llama3_vision.safetensors" },
    "class_type": "CLIPVisionLoader"
  },
  "43": {
    "inputs": {
      "clip_vision": ["42", 0],
      "image": ["40", 0],
      "crop": "center"
    },
    "class_type": "CLIPVisionEncode"
  },
  "44": {
    "inputs": {
      "positive": ["6", 0],
      "vae": ["10", 0],
      "width": "__WIDTH__",
      "height": "__HEIGHT__",
      "length": "__LENGTH__",
      "batch_size": 1,
      "guidance_type": "v1 (concat)",
      "start_image": ["40", 0]
    },
    "class_type": "HunyuanImageToVideo"
  },
  "50": {
    "inputs": {
      "images": ["8", 0],
      "frame_rate": 24,
      "loop_count": 0,
      "filename_prefix": "cyberpet_i2v",
      "format": "video/h264-mp4",
      "pix_fmt": "yuv420p",
      "crf": 19,
      "save_metadata": false,
      "pingpong": false,
      "save_output": true
    },
    "class_type": "VHS_VideoCombine"
  }
}`;

/** 注入占位符，返回可 POST 到 /prompt 的工作流对象 */
export function injectVideoWorkflow(
  template: string,
  vars: {
    SEED: number;
    WIDTH: number;
    HEIGHT: number;
    LENGTH: number;
    PROMPT: string;
    NEG_PROMPT: string;
    IMAGE_B64: string;
  }
): unknown {
  let filled = template;
  const numberKeys: Array<"SEED" | "WIDTH" | "HEIGHT" | "LENGTH"> = [
    "SEED",
    "WIDTH",
    "HEIGHT",
    "LENGTH",
  ];
  const stringKeys: Array<"PROMPT" | "NEG_PROMPT" | "IMAGE_B64"> = [
    "PROMPT",
    "NEG_PROMPT",
    "IMAGE_B64",
  ];
  for (const k of numberKeys) {
    filled = filled.split(`"__${k}__"`).join(String(vars[k]));
  }
  for (const k of stringKeys) {
    filled = filled.split(`"__${k}__"`).join(JSON.stringify(vars[k]));
  }
  return JSON.parse(filled);
}

/**
 * HunyuanVideo 推荐帧数（4n+1 规律），把 duration_s × 24fps 向下对齐到最近合法值。
 * 3s → 73, 5s → 121, 8s → 193。
 */
export function hunyuanFramesForDuration(durationS: number): number {
  const fps = 24;
  const raw = Math.max(25, Math.round(durationS * fps));
  const snapped = Math.round((raw - 1) / 4) * 4 + 1;
  return Math.max(25, Math.min(201, snapped));
}

/**
 * 用户可能直接粘贴自己导出的工作流 JSON（"API 格式"）。把任意占位注入进去：
 *   找到 class_type=LoadImageBase64 的节点，覆写 inputs.image
 *   找到 class_type=CLIPTextEncode 的节点，按 title/_meta.title 匹配 positive/negative
 * 匹配失败时保持原样（用户可能把参考图 / prompt 节点连到别的节点，不强改）。
 */
export function injectUserVideoWorkflow(
  raw: string,
  vars: {
    PROMPT: string;
    NEG_PROMPT: string;
    IMAGE_B64: string;
    SEED: number;
  }
): unknown {
  const wf = JSON.parse(raw) as Record<string, WorkflowNode>;
  for (const [, node] of Object.entries(wf)) {
    if (!node || typeof node !== "object") continue;
    const cls = node.class_type;
    const inputs = node.inputs ?? {};
    if (cls === "LoadImageBase64") {
      inputs.image = vars.IMAGE_B64;
    } else if (cls === "CLIPTextEncode") {
      const title = (node._meta?.title ?? "").toLowerCase();
      if (title.includes("neg")) {
        inputs.text = vars.NEG_PROMPT;
      } else if (typeof inputs.text === "string") {
        inputs.text = vars.PROMPT;
      }
    } else if (cls === "KSampler" && typeof inputs.seed === "number") {
      inputs.seed = vars.SEED;
    }
    node.inputs = inputs;
  }
  return wf;
}

interface WorkflowNode {
  class_type?: string;
  inputs?: Record<string, unknown> & { image?: string; text?: string; seed?: number };
  _meta?: { title?: string };
}

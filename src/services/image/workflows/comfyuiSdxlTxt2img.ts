/**
 * ComfyUI 内置 workflow 模板（SDXL txt2img）。
 *
 * 占位符约定（全部以 `"__KEY__"` 字符串形式出现在 JSON 中）：
 *   __SEED__      → number（KSampler seed）
 *   __WIDTH__     → number（EmptyLatentImage 宽度）
 *   __HEIGHT__    → number
 *   __PROMPT__    → string（CLIPTextEncode positive）
 *   __NEG_PROMPT__→ string
 *   __CKPT__      → string（checkpoint 文件名）
 *
 * 为什么以字符串模板而非 JSON 对象存储：
 * 数字占位 `"__SEED__"` 需要在注入时被替换为裸数字（去掉引号），
 * 所以必须在 JSON.parse 前做字符串替换。
 */
export const SDXL_TXT2IMG_WORKFLOW_TEMPLATE = `{
  "3": {
    "inputs": {
      "seed": "__SEED__",
      "steps": 20,
      "cfg": 7.0,
      "sampler_name": "euler",
      "scheduler": "normal",
      "denoise": 1.0,
      "model": ["4", 0],
      "positive": ["6", 0],
      "negative": ["7", 0],
      "latent_image": ["5", 0]
    },
    "class_type": "KSampler"
  },
  "4": {
    "inputs": { "ckpt_name": "__CKPT__" },
    "class_type": "CheckpointLoaderSimple"
  },
  "5": {
    "inputs": {
      "width": "__WIDTH__",
      "height": "__HEIGHT__",
      "batch_size": 1
    },
    "class_type": "EmptyLatentImage"
  },
  "6": {
    "inputs": { "text": "__PROMPT__", "clip": ["4", 1] },
    "class_type": "CLIPTextEncode"
  },
  "7": {
    "inputs": { "text": "__NEG_PROMPT__", "clip": ["4", 1] },
    "class_type": "CLIPTextEncode"
  },
  "8": {
    "inputs": { "samples": ["3", 0], "vae": ["4", 2] },
    "class_type": "VAEDecode"
  },
  "9": {
    "inputs": { "filename_prefix": "cyberpet", "images": ["8", 0] },
    "class_type": "SaveImage"
  }
}`;

/** 注入占位符 —— 数字型（去掉引号）+ 字符串型（JSON 化转义） */
export function injectWorkflow(
  template: string,
  vars: {
    SEED: number;
    WIDTH: number;
    HEIGHT: number;
    PROMPT: string;
    NEG_PROMPT: string;
    CKPT: string;
  }
): unknown {
  let filled = template;
  const numberKeys: Array<keyof typeof vars> = ["SEED", "WIDTH", "HEIGHT"];
  const stringKeys: Array<keyof typeof vars> = ["PROMPT", "NEG_PROMPT", "CKPT"];

  for (const k of numberKeys) {
    filled = filled.split(`"__${k}__"`).join(String(vars[k]));
  }
  for (const k of stringKeys) {
    filled = filled.split(`"__${k}__"`).join(JSON.stringify(vars[k]));
  }
  return JSON.parse(filled);
}

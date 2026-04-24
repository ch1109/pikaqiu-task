export type LLMMode = "api" | "local";

/** 可选 AI 创作 Provider：6 家商业 + 2 条开源通用管道（迁移 017 起） */
export type AIVendorId =
  | "jimeng"
  | "kling"
  | "minimax"
  | "vidu"
  | "gemini"
  | "comfyui"
  | "openai-compat"
  | "replicate";

/** 图像 Provider 子集：有 image 能力的 vendor */
export type ImageGenProviderName =
  | "jimeng"
  | "kling"
  | "minimax"
  | "comfyui"
  | "openai-compat"
  | "replicate";

/** 视频 Provider 子集：有 video 能力的 vendor */
export type VideoGenProviderName =
  | "jimeng"
  | "kling"
  | "minimax"
  | "vidu"
  | "gemini"
  | "replicate"
  | "comfyui";

export interface Settings {
  id: number;
  work_start: string;
  work_end: string;
  break_mins: number;
  llm_mode: LLMMode;
  llm_api_url: string;
  llm_api_key: string;
  llm_model: string;
  local_model_path: string;
  pet_x: number;
  pet_y: number;
  opacity: number;
  /** 图像生成 Provider（迁移 012 引入；迁移 016 扩容） */
  image_gen_provider: ImageGenProviderName;
  image_gen_api_url: string;
  image_gen_api_key: string;
  image_gen_model: string;
  comfyui_workflow_json: string;
  /** 色键抠图参数 */
  chroma_key_color: string;
  chroma_key_tolerance: number;
  chroma_key_despill: number;
  /** 每日调用配额（仅对计费 Provider 生效） */
  image_gen_daily_quota: number;
  image_gen_today_count: number;
  image_gen_today_date: string;
  /** 迁移 013：Gemini Veo 图生视频（保留兼容，UI 已不直接读） */
  gemini_api_key: string;
  gemini_api_url: string;
  gemini_video_model: string;
  /** 迁移 015：桌宠尺寸缩放系数（0.5 ~ 2.0，1.0 = 140px 基准） */
  pet_scale: number;
  /** 迁移 016：多厂商视频 Provider（gemini / jimeng / kling / minimax / vidu） */
  video_gen_provider: VideoGenProviderName;
  video_gen_api_url: string;
  video_gen_api_key: string;
  video_gen_model: string;
  /** Kling 需 AK + SK 组合，SK 单独字段 */
  kling_secret_key: string;
  /** 迁移 017：开源 Provider 的动态字段（如 Replicate 模型 version / OpenAI 兼容端的图像尺寸） */
  custom_provider_config: string;
  created_at: string;
  updated_at: string;
}

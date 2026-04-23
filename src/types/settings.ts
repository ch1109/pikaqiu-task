export type LLMMode = "api" | "local";

export type ImageGenProviderName = "jimeng" | "comfyui";

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
  /** 图像生成 Provider（迁移 012 引入） */
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
  created_at: string;
  updated_at: string;
}

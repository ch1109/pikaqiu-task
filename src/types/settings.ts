export type LLMMode = "api" | "local";

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
  created_at: string;
  updated_at: string;
}

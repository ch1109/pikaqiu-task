import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage, LLMOptions, LLMProvider } from "./types";

export class APIProvider implements LLMProvider {
  name = "api";

  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(baseUrl: string, apiKey: string, model: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(messages: ChatMessage[], options?: LLMOptions): Promise<string> {
    return invoke<string>("llm_chat", {
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      model: this.model,
      messages,
      temperature: options?.temperature ?? 0.3,
      maxTokens: options?.maxTokens ?? 2048,
    });
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey || !this.baseUrl) return false;
    try {
      return await invoke<boolean>("llm_check", {
        baseUrl: this.baseUrl,
        apiKey: this.apiKey,
      });
    } catch {
      return false;
    }
  }
}

import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage, LLMOptions, LLMProvider } from "./types";

/**
 * 本地 LLM Provider — 通过 Rust 后端代理请求本地模型服务（Ollama / llama.cpp 等）
 * 走 invoke("llm_chat") 统一架构，绕过浏览器 CORS 限制
 */
export class LocalProvider implements LLMProvider {
  name = "local";

  private baseUrl: string;
  private model: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = (baseUrl || "http://localhost:11434/v1").replace(/\/+$/, "");
    this.model = model || "";
  }

  async chat(messages: ChatMessage[], options?: LLMOptions): Promise<string> {
    return invoke<string>("llm_chat", {
      baseUrl: this.baseUrl,
      apiKey: "ollama",
      model: this.model,
      messages,
      temperature: options?.temperature ?? 0.3,
      maxTokens: options?.maxTokens ?? 2048,
    });
  }

  async isAvailable(): Promise<boolean> {
    try {
      return await invoke<boolean>("llm_check", {
        baseUrl: this.baseUrl,
        apiKey: "ollama",
      });
    } catch {
      return false;
    }
  }
}

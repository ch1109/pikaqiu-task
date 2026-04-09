import type { ChatMessage, LLMOptions, LLMProvider } from "./types";

/**
 * 本地 LLM Provider — 调用 llama.cpp server (localhost:8080)
 * 架构预留，后续集成 Sidecar 启动本地模型
 */
export class LocalProvider implements LLMProvider {
  name = "local";

  private port = 8080;

  constructor(port?: number) {
    if (port) this.port = port;
  }

  async chat(messages: ChatMessage[], options?: LLMOptions): Promise<string> {
    const url = `http://localhost:${this.port}/v1/chat/completions`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `本地 LLM 请求失败 (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("本地 LLM 返回了空内容");
    }
    return content;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(
        `http://localhost:${this.port}/v1/models`,
        { signal: AbortSignal.timeout(3000) }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}

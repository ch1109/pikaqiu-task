import { invoke } from "@tauri-apps/api/core";
import type {
  ImageGenParams,
  ImageGenProvider,
  ImageGenResult,
} from "../types";

/**
 * OpenAI 兼容图像 Provider。
 *
 * 覆盖 LocalAI / Ollama (images 兼容) / vLLM / Together AI / OpenRouter
 * / SiliconFlow / Fireworks 等自部署或聚合平台。
 *
 * 协议：POST {baseUrl}/v1/images/generations，Bearer 鉴权，
 * 返回 `{data: [{b64_json | url}]}`。
 */
export class OpenAICompatProvider implements ImageGenProvider {
  name = "openai-compat";

  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private imageSize: string;
  private responseFormat: string;

  constructor(
    baseUrl: string,
    apiKey: string,
    model: string,
    customConfig: Record<string, string>
  ) {
    this.baseUrl = (baseUrl || "https://api.openai.com").replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.model = model || "dall-e-3";
    this.imageSize =
      customConfig.openai_compat_image_size || "1024x1024";
    this.responseFormat =
      customConfig.openai_compat_response_format || "b64_json";
  }

  isLocal(): boolean {
    return false;
  }

  async generate(params: ImageGenParams): Promise<ImageGenResult> {
    const payload = {
      prompt: params.prompt,
      n: params.count ?? 1,
      size: this.imageSize,
      response_format: this.responseFormat,
    };
    const res = await invoke<{
      images: Array<{ b64?: string; url?: string; seed?: number }>;
      cost_estimate: number;
    }>("image_generate", {
      provider: "openai-compat",
      apiUrl: this.baseUrl,
      apiKey: this.apiKey,
      model: this.model,
      payload,
    });
    return {
      images: res.images,
      costEstimate: res.cost_estimate ?? 0,
    };
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey || !this.baseUrl) return false;
    try {
      return await invoke<boolean>("image_check", {
        provider: "openai-compat",
        apiUrl: this.baseUrl,
        apiKey: this.apiKey,
      });
    } catch {
      return false;
    }
  }
}

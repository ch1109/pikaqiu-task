import { invoke } from "@tauri-apps/api/core";
import type {
  ImageGenParams,
  ImageGenProvider,
  ImageGenResult,
} from "../types";

/**
 * 即梦（火山方舟图像生成）Provider。
 *
 * 使用方舟 Visual OpenAPI：POST {base_url}/images/generations
 * 默认 base_url 指向 ark.cn-beijing.volces.com/api/v3（与聊天的 coding/v1 不同版本）
 */
export class JimengProvider implements ImageGenProvider {
  name = "jimeng";

  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(baseUrl: string, apiKey: string, model: string) {
    const fallback = "https://ark.cn-beijing.volces.com/api/v3";
    this.baseUrl = (baseUrl || fallback).replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.model = model || "doubao-seedream-3-0-t2i-250415";
  }

  isLocal(): boolean {
    return false;
  }

  async generate(params: ImageGenParams): Promise<ImageGenResult> {
    const payload = {
      prompt: params.prompt,
      negative_prompt: params.negativePrompt ?? "",
      width: params.width,
      height: params.height,
      seed: params.seed,
      count: params.count ?? 1,
      reference_image_b64: params.referenceImageB64,
      reference_strength: params.referenceStrength,
    };
    const res = await invoke<{
      images: Array<{ b64?: string; url?: string; seed?: number }>;
      cost_estimate: number;
    }>("image_generate", {
      provider: "jimeng",
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
        provider: "jimeng",
        apiUrl: this.baseUrl,
        apiKey: this.apiKey,
      });
    } catch {
      return false;
    }
  }
}

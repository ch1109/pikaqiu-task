import { invoke } from "@tauri-apps/api/core";
import type {
  ImageGenParams,
  ImageGenProvider,
  ImageGenResult,
} from "../types";

/**
 * 海螺（MiniMax）图像生成 Provider。
 *
 * 同步接口，Bearer Key 鉴权，Rust 端 POST /v1/image_generation 后直接拿 base64。
 */
export class MiniMaxProvider implements ImageGenProvider {
  name = "minimax";

  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(baseUrl: string, apiKey: string, model: string) {
    this.baseUrl = (baseUrl || "https://api.minimaxi.com").replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.model = model || "image-01";
  }

  isLocal(): boolean {
    return false;
  }

  async generate(params: ImageGenParams): Promise<ImageGenResult> {
    const payload = {
      prompt: params.prompt,
      negative_prompt: params.negativePrompt ?? "",
      reference_image_b64: params.referenceImageB64,
      aspect_ratio: aspectRatioFromWH(params.width, params.height),
      count: params.count ?? 1,
    };
    const res = await invoke<{
      images: Array<{ b64?: string; url?: string; seed?: number }>;
      cost_estimate: number;
    }>("image_generate", {
      provider: "minimax",
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
        provider: "minimax",
        apiUrl: this.baseUrl,
        apiKey: this.apiKey,
      });
    } catch {
      return false;
    }
  }
}

function aspectRatioFromWH(w: number, h: number): string {
  const r = w / h;
  if (Math.abs(r - 1) < 0.05) return "1:1";
  if (r > 1) return "16:9";
  return "9:16";
}

import { invoke } from "@tauri-apps/api/core";
import type {
  ImageGenParams,
  ImageGenProvider,
  ImageGenResult,
} from "../types";

/**
 * Replicate 托管平台 —— 开源模型集市。
 *
 * 协议：POST {baseUrl}/v1/predictions → 轮询 urls.get → 拿 output（由 Rust 完成）。
 * 认证前缀是 "Token <key>" 而非 "Bearer"（Rust 端区分）。
 *
 * version 字段允许两种形式，Rust 的 `build_replicate_body` 做分流：
 *   "owner/model"        → 走 latest（塞进 body.model 字段）
 *   "owner/model:hash"   → 锁定版本（塞进 body.version 字段，Rust 取 ':' 后半段）
 */
export class ReplicateProvider implements ImageGenProvider {
  name = "replicate";

  private baseUrl: string;
  private apiKey: string;
  private defaultModel: string;
  private imageVersion: string;

  constructor(
    baseUrl: string,
    apiKey: string,
    model: string,
    customConfig: Record<string, string>
  ) {
    this.baseUrl = (baseUrl || "https://api.replicate.com").replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.defaultModel = model || "black-forest-labs/flux-schnell";
    this.imageVersion = customConfig.replicate_image_version || "";
  }

  isLocal(): boolean {
    return false;
  }

  async generate(params: ImageGenParams): Promise<ImageGenResult> {
    const payload = {
      prompt: params.prompt,
      aspect_ratio: aspectRatioFromWH(params.width, params.height),
      seed: params.seed,
      reference_image_b64: params.referenceImageB64,
      replicate_image_version: this.imageVersion,
    };
    const res = await invoke<{
      images: Array<{ b64?: string; url?: string; seed?: number }>;
      cost_estimate: number;
    }>("image_generate", {
      provider: "replicate",
      apiUrl: this.baseUrl,
      apiKey: this.apiKey,
      model: this.defaultModel,
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
        provider: "replicate",
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

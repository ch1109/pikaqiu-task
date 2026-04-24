import { invoke } from "@tauri-apps/api/core";
import type {
  ImageGenParams,
  ImageGenProvider,
  ImageGenResult,
} from "../types";

/**
 * 可灵（Kling）图像生成 Provider。
 *
 * 特殊点：认证走 AK（apiKey）+ SK（secretKey），Rust 端实时签 JWT。
 * 图像 API 为异步任务：提交 → 轮询 → 拿 URL → 再下载回 base64。
 * 轮询逻辑全部在 Rust 端 image_generate 分支里完成，前端透传 SK 即可。
 */
export class KlingProvider implements ImageGenProvider {
  name = "kling";

  private baseUrl: string;
  private accessKey: string;
  private secretKey: string;
  private model: string;

  constructor(
    baseUrl: string,
    accessKey: string,
    secretKey: string,
    model: string
  ) {
    this.baseUrl = (baseUrl || "https://api.klingai.com").replace(/\/+$/, "");
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.model = model || "kling-v2";
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
      secret_key: this.secretKey,
    };
    const res = await invoke<{
      images: Array<{ b64?: string; url?: string; seed?: number }>;
      cost_estimate: number;
    }>("image_generate", {
      provider: "kling",
      apiUrl: this.baseUrl,
      apiKey: this.accessKey,
      model: this.model,
      payload,
    });
    return {
      images: res.images,
      costEstimate: res.cost_estimate ?? 0,
    };
  }

  async isAvailable(): Promise<boolean> {
    if (!this.accessKey || !this.secretKey) return false;
    return true;
  }
}

function aspectRatioFromWH(w: number, h: number): string {
  const r = w / h;
  if (Math.abs(r - 1) < 0.05) return "1:1";
  if (r > 1) return "16:9";
  return "9:16";
}

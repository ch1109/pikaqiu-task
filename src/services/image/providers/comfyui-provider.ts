import { invoke } from "@tauri-apps/api/core";
import type {
  ImageGenParams,
  ImageGenProvider,
  ImageGenResult,
} from "../types";
import {
  SDXL_TXT2IMG_WORKFLOW_TEMPLATE,
  injectWorkflow,
} from "../workflows/comfyuiSdxlTxt2img";

/**
 * ComfyUI 本地 Provider。
 *
 * 工作流程：
 *   1. 读取 workflow 模板（用户自定义 > 内置 SDXL txt2img）
 *   2. 逐次注入占位符提交给 Rust 命令
 *   3. Rust 端 POST /prompt + 轮询 /history + /view 下载
 *
 * 注意：SDXL 的 img2img 需要更复杂的 LoadImageBase64 节点，
 * MVP 仅支持 txt2img；要启用 reference image 请在设置中自定义 workflow。
 */
export class ComfyUIProvider implements ImageGenProvider {
  name = "comfyui";

  private baseUrl: string;
  private model: string;
  private customTemplate: string;

  constructor(baseUrl: string, model: string, customWorkflowJson: string = "") {
    this.baseUrl = (baseUrl || "http://127.0.0.1:8188").replace(/\/+$/, "");
    this.model = model || "sd_xl_base_1.0.safetensors";
    this.customTemplate = customWorkflowJson.trim();
  }

  isLocal(): boolean {
    return true;
  }

  async generate(params: ImageGenParams): Promise<ImageGenResult> {
    const template = this.customTemplate || SDXL_TXT2IMG_WORKFLOW_TEMPLATE;
    const count = params.count ?? 1;
    const allImages: Array<{ b64?: string; url?: string; seed?: number }> = [];

    const baseSeed = params.seed ?? Math.floor(Math.random() * 1_000_000);

    for (let i = 0; i < count; i++) {
      const thisSeed = baseSeed + i;
      const workflow = injectWorkflow(template, {
        SEED: thisSeed,
        WIDTH: params.width,
        HEIGHT: params.height,
        PROMPT: params.prompt,
        NEG_PROMPT: params.negativePrompt ?? "",
        CKPT: this.model,
      });

      const res = await invoke<{
        images: Array<{ b64?: string; url?: string; seed?: number }>;
        cost_estimate: number;
      }>("image_generate", {
        provider: "comfyui",
        apiUrl: this.baseUrl,
        apiKey: "",
        model: this.model,
        payload: { workflow_json: workflow },
      });

      for (const img of res.images) {
        allImages.push({ ...img, seed: img.seed ?? thisSeed });
      }
    }

    return { images: allImages, costEstimate: 0 };
  }

  async isAvailable(): Promise<boolean> {
    try {
      return await invoke<boolean>("comfyui_ping", { apiUrl: this.baseUrl });
    } catch {
      return false;
    }
  }
}

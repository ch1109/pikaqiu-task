import { getDB } from "@/services/db";
import type { Settings } from "@/types/settings";
import type { ImageGenParams, ImageGenProvider, ImageGenResult } from "./types";
import { JimengProvider } from "./providers/jimeng-provider";
import { ComfyUIProvider } from "./providers/comfyui-provider";

export type { ImageGenParams, ImageGenProvider, ImageGenResult };

let cachedProvider: ImageGenProvider | null = null;
let cachedSignature: string | null = null;

async function getSettings(): Promise<Settings> {
  const db = await getDB();
  const rows = await db.select<Settings[]>(
    "SELECT * FROM settings WHERE id = 1"
  );
  return rows[0];
}

/** 影响 Provider 实例的字段组合 —— 任意变更都要重建实例 */
function buildSignature(s: Settings): string {
  return [
    s.image_gen_provider,
    s.image_gen_api_url,
    s.image_gen_api_key,
    s.image_gen_model,
    s.comfyui_workflow_json,
  ].join("|");
}

export async function getImageProvider(): Promise<ImageGenProvider> {
  const settings = await getSettings();
  const sig = buildSignature(settings);
  if (cachedProvider && cachedSignature === sig) {
    return cachedProvider;
  }

  if (settings.image_gen_provider === "comfyui") {
    cachedProvider = new ComfyUIProvider(
      settings.image_gen_api_url,
      settings.image_gen_model,
      settings.comfyui_workflow_json
    );
  } else {
    cachedProvider = new JimengProvider(
      settings.image_gen_api_url,
      settings.image_gen_api_key,
      settings.image_gen_model
    );
  }
  cachedSignature = sig;
  return cachedProvider;
}

export function resetImageProvider() {
  cachedProvider = null;
  cachedSignature = null;
}

export async function generateImage(
  params: ImageGenParams
): Promise<ImageGenResult> {
  const provider = await getImageProvider();
  return provider.generate(params);
}

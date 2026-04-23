/**
 * 图像生成 Provider 抽象。
 *
 * 设计对齐 src/services/llm/types.ts：
 * - 接口简洁（generate + isAvailable）
 * - 所有网络请求走 Rust 代理（规避 CORS 与本地 HTTP 证书问题）
 * - Provider 对 "图像字节" 和 "远程 URL" 两种返回形态都兼容
 */

export interface ImageGenParams {
  /** 正向 prompt（英文效果最佳，已在 prompts/characterPrompt.ts 中处理） */
  prompt: string;
  /** 负向 prompt（避免背景/阴影污染） */
  negativePrompt?: string;
  /**
   * 参考图的 base64（不含 data: 前缀）。
   * 用于 img2img / reference_only ControlNet，保证角色一致性。
   */
  referenceImageB64?: string;
  /** 0-1，img2img 强度（越高越偏离参考图） */
  referenceStrength?: number;
  width: number;
  height: number;
  seed?: number;
  /** 单次批量出图数量，用于 Step 2 候选图 */
  count?: number;
}

export interface GeneratedImage {
  /** base64 字节（不含 data: 前缀）。优先字段。 */
  b64?: string;
  /** 远程 URL（ComfyUI /view 等）。与 b64 二选一。 */
  url?: string;
  /** 实际使用的 seed，用于跨帧复用 */
  seed?: number;
}

export interface ImageGenResult {
  images: GeneratedImage[];
  /** 本次调用的估算成本（CNY），本地 Provider 返回 0 */
  costEstimate: number;
}

export interface ImageGenProvider {
  /** Provider 标识，与 settings.image_gen_provider 一致 */
  name: string;
  /** 执行一次图像生成调用 */
  generate(params: ImageGenParams): Promise<ImageGenResult>;
  /** 健康检查：能否连通 / 鉴权是否正确 */
  isAvailable(): Promise<boolean>;
  /** 是否为本地免费 Provider（配额/成本 UI 据此隐藏） */
  isLocal(): boolean;
}

/**
 * AI 自定义桌宠角色生成所用的 prompt 模板集合。
 *
 * 三类模板：
 *   1. 基准图 prompt（Step 2）—— 让 AI 在纯绿幕上画出主体，便于色键抠图
 *   2. 动作 prompt delta（Step 4）—— 复用基准图 seed + 参考，改变姿态
 *   3. LLM 润色 prompt（Step 1 可选）—— 把用户的一句话描述扩写成专业 prompt
 */

/**
 * 纯绿背景 + 边缘清晰 + 单角色居中的强约束模板。
 * 模板以英文为主：开源 SDXL + 方舟文生图对英文响应更稳定。
 */
export const BASE_IMAGE_PROMPT_TEMPLATE = `{{DESCRIPTION}}, single character, full body, centered composition, front view, game sprite style, flat pure chroma green background #00FF00, solid background without gradient or texture, hard clean edges, no shadow on background, no ground shadow, 2d illustration, high detail character only`;

/** 与基准图配对的负面 prompt，压制常见"脏背景"情形 */
export const BASE_IMAGE_NEGATIVE_PROMPT = `gradient background, complex background, multiple characters, crowd, busy scene, background objects, props on ground, shadows on background, depth of field, blur, bokeh, photo frame, watermark, text, signature, border`;

/** 动作变体 prompt：保留主体不变，仅替换 pose/表情 */
export function buildActionPrompt(opts: {
  characterDescription: string;
  actionName: string;
  actionDelta: string;
  frameIndex: number;
  totalFrames: number;
}): string {
  const progress = `frame ${opts.frameIndex + 1} of ${opts.totalFrames}`;
  return `${opts.characterDescription}, ${opts.actionDelta} (${opts.actionName}, ${progress}), same character, same outfit, same art style, same proportions, single character, full body, centered, front view, flat pure chroma green background #00FF00, solid green, hard edges, game sprite style`;
}

export const ACTION_NEGATIVE_PROMPT = BASE_IMAGE_NEGATIVE_PROMPT;

/**
 * LLM 润色 system prompt：把用户的一句话扩写成稳定且风格统一的生图 prompt。
 * 返回值需要直接用于生图，所以要求纯文本、单行、英文、不带额外说明。
 */
export const REFINE_PROMPT_SYSTEM = `你是游戏美术总监。用户会给你一句中文角色描述，请扩写成一段适合 stable diffusion / sdxl 生图的英文 prompt。

要求：
- 只输出英文 prompt，一行（逗号分隔），不要任何解释或引号
- 覆盖风格、主色、服饰、体型、神情
- **必须在末尾保留**："single character, full body, centered, front view, flat pure chroma green background #00FF00, solid green, hard edges, game sprite style"
- 不要输出 negative prompt
- 长度 30-60 个 token

示例：
输入：戴贝雷帽的柴犬艺术家
输出：shiba inu artist wearing a purple beret, holding a wooden palette, wide smiling eyes, orange fur with white belly, chibi proportions, 2d illustration, thick line art, clean cel shading, warm color palette, single character, full body, centered, front view, flat pure chroma green background #00FF00, solid green, hard edges, game sprite style`;

/** 构造一次性的 LLM 润色调用 messages（传给现有 LLMProvider.chat） */
export function buildRefineMessages(
  userInput: string
): Array<{ role: "system" | "user"; content: string }> {
  return [
    { role: "system", content: REFINE_PROMPT_SYSTEM },
    { role: "user", content: userInput },
  ];
}

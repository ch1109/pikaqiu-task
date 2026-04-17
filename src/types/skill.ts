/**
 * Skills（技能）系统类型定义
 *
 * 技能是一种结构化的、可通过 `/command` 触发的工作流。
 * 与 PresetPrompt（一键填入模板）的区别：
 * - Skill 有独立命令名、带占位符的 prompt 模板、可选的后置动作（action_key）
 * - Skill 调用不走 chatRouter，直接构造 system+user messages
 */

export interface Skill {
  id: number;
  /** 触发命令，小写 [a-z0-9-] */
  name: string;
  /** 展示名（中文） */
  display_name: string;
  /** 补全下拉显示的一行说明 */
  description: string;
  /** 长说明（Manager 列表显示） */
  when_to_use: string;
  /** 提示词模板，支持 {{args}} {{now}} {{current_tasks}} {{pet_name}} */
  prompt: string;
  /** Icon 名（需在 shared/Icon.tsx iconMap 注册） */
  icon: string;
  /** 后置动作 key（见 skillRegistry.SKILL_ACTIONS），NULL = 纯对话 */
  action_key: string | null;
  /** 可选 model override */
  model: string | null;
  sort_order: number;
  /** 0 / 1 */
  is_builtin: number;
  /** 0 / 1 */
  enabled: number;
  created_at: string;
}

/** 一次 skill 调用的上下文 */
export interface SkillInvocation {
  skill: Skill;
  /** /name 后的参数（含换行与空白） */
  args: string;
  /** 原始输入 */
  raw: string;
}

/** 后置动作执行结果。未返回或返回空对象 = 完全透传 LLM 原始回复。 */
export interface SkillActionResult {
  /** 非空时替换 LLM 原始 reply 作为聊天消息显示内容（例如 skill-creator 用以隐藏 JSON 原文） */
  displayReply?: string;
}

/** 后置动作处理器 */
export type SkillActionHandler = (ctx: {
  invocation: SkillInvocation;
  llmReply: string;
  planId: number | null;
}) => Promise<void | SkillActionResult>;

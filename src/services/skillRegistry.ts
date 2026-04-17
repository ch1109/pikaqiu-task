import { emit } from "@tauri-apps/api/event";
import { useSkillStore, normalizeSkillName } from "@/stores/useSkillStore";
import type { SkillActionHandler } from "@/types/skill";

/**
 * 技能后置动作注册表。
 *
 * 技能的 `action_key` 字段引用这里的 key。LLM 回复完成后自动触发。
 * 新增后置动作时：
 *   1. 在 {@link SKILL_ACTIONS} 添加 handler
 *   2. 在 {@link SKILL_ACTION_KEYS} union 追加 key
 *   3. 若需让用户在 SkillManager 下拉中选中，在 {@link SKILL_ACTION_OPTIONS} 追加
 *      —— create_skill 是 skill-creator 内部专用，**不**暴露给用户手动挂载，避免递归套娃
 */

/** 专注态持续上限（分钟）：超过后自动切回 idle，避免桌宠永远停在 thinking */
const FOCUS_AUTO_EXIT_MS = 15 * 60 * 1000;

/** 模块级 timer：保证多次 /focus 调用不堆叠 */
let focusExitTimer: ReturnType<typeof setTimeout> | null = null;

export const SKILL_ACTION_KEYS = ["refresh_tasks", "pet_focus", "create_skill"] as const;
export type SkillActionKey = (typeof SKILL_ACTION_KEYS)[number];

/** 合法 icon 白名单（与 SkillAutocomplete 的 KNOWN_ICONS 保持同源概念） */
const ALLOWED_ICONS = new Set([
  "wand-2",
  "sparkles",
  "calendar-days",
  "scroll-text",
  "target",
  "list-todo",
  "pen-line",
  "lightbulb",
  "heart",
  "briefcase",
  "notebook-pen",
  "book-open-text",
]);

/** 允许 LLM 生成的新技能挂载的 action_key —— 严禁 create_skill 递归 */
const ALLOWED_GENERATED_ACTION_KEYS = new Set(["refresh_tasks", "pet_focus"]);

/** 剥离 LLM 可能套在 JSON 外围的 markdown 代码块 */
function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

/** 给已存在的 name 自动加 -2 / -3 ... 后缀，直到不冲突 */
function ensureUniqueName(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export const SKILL_ACTIONS: Record<SkillActionKey, SkillActionHandler> = {
  /** 刷新任务面板（/plan 等涉及任务建议后调用） */
  refresh_tasks: async () => {
    await emit("tasks-updated", {});
  },

  /** 桌宠进入思考态并在 15 分钟后自动切回（/focus 启动专注时调用） */
  pet_focus: async () => {
    await emit("pet-state", { state: "thinking" });
    if (focusExitTimer) clearTimeout(focusExitTimer);
    focusExitTimer = setTimeout(() => {
      void emit("pet-state", { state: "idle" });
      focusExitTimer = null;
    }, FOCUS_AUTO_EXIT_MS);
  },

  /**
   * /skill-creator 专用：解析 LLM 返回的 JSON，落库新技能，广播刷新。
   * 返回 displayReply 覆盖原 JSON 文本的聊天显示，避免用户看到裸 JSON。
   */
  create_skill: async ({ llmReply }) => {
    const cleaned = stripCodeFence(llmReply);
    let parsed: { reply?: unknown; skill?: unknown };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("LLM 未返回可解析的 JSON。请把需求描述得更具体一点再试一次。");
    }

    const rawSkill = parsed.skill;
    if (!rawSkill || typeof rawSkill !== "object") {
      throw new Error("LLM 返回结果缺少 skill 字段。");
    }
    const s = rawSkill as Record<string, unknown>;

    // 字段基本校验
    const rawName = typeof s.name === "string" ? s.name : "";
    const normalized = normalizeSkillName(rawName);
    if (!normalized) {
      throw new Error("生成的命令名不合法（需要英文字母/数字）。");
    }
    const displayName =
      typeof s.display_name === "string" && s.display_name.trim()
        ? s.display_name.trim()
        : normalized;
    const description = typeof s.description === "string" ? s.description.trim() : "";
    const whenToUse = typeof s.when_to_use === "string" ? s.when_to_use.trim() : "";
    let promptTpl = typeof s.prompt === "string" ? s.prompt : "";
    if (!promptTpl.trim()) {
      throw new Error("生成的 prompt 为空。");
    }
    // 强制包含 {{args}}，缺失则兜底追加
    if (!promptTpl.includes("{{args}}")) {
      promptTpl = `${promptTpl.trim()}\n\n用户输入：{{args}}`;
    }
    const iconRaw = typeof s.icon === "string" ? s.icon : "";
    const icon = ALLOWED_ICONS.has(iconRaw) ? iconRaw : "wand-2";
    const actionKeyRaw =
      typeof s.action_key === "string" && s.action_key.trim()
        ? s.action_key.trim()
        : null;
    const actionKey =
      actionKeyRaw && ALLOWED_GENERATED_ACTION_KEYS.has(actionKeyRaw)
        ? actionKeyRaw
        : null;

    // 冲突去重：基于 store 当前缓存的 name 集合
    const existingNames = new Set(useSkillStore.getState().skills.map((sk) => sk.name));
    const finalName = ensureUniqueName(normalized, existingNames);

    await useSkillStore.getState().addSkill({
      name: finalName,
      display_name: displayName,
      description,
      when_to_use: whenToUse,
      prompt: promptTpl,
      icon,
      action_key: actionKey,
    });

    // 广播让其它窗口（PetWindow / SettingsPanel 的 SkillManager）同步
    await emit("skills-updated", {});

    // 把 LLM 的 reply 作为聊天显示；若跟生成的命令名不一致（因冲突改名了），补一句提示
    const rawReply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    const suffix =
      finalName !== normalized
        ? `\n\n（检测到命令名 /${normalized} 已存在，已自动改名为 /${finalName}）`
        : "";
    const displayReply =
      rawReply || `已创建 /${finalName} ${displayName}，立即可用。`;

    return { displayReply: displayReply + suffix };
  },
};

/** DB 中可能存的任意字符串；解析为合法 handler 或 null */
export function resolveSkillAction(key: string | null): SkillActionHandler | null {
  if (!key) return null;
  if ((SKILL_ACTION_KEYS as readonly string[]).includes(key)) {
    return SKILL_ACTIONS[key as SkillActionKey];
  }
  return null;
}

/** 用于 SkillManager 下拉的展示元数据 */
export const SKILL_ACTION_OPTIONS: { key: string; label: string; hint: string }[] = [
  { key: "", label: "无", hint: "仅让 AI 回复，不触发副作用" },
  { key: "refresh_tasks", label: "刷新任务", hint: "广播 tasks-updated 让任务面板重新加载" },
  { key: "pet_focus", label: "桌宠思考", hint: "让桌宠切换到 thinking 动画状态" },
];

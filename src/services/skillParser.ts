import type { Skill, SkillInvocation } from "@/types/skill";

/**
 * 解析用户输入是否为技能调用。
 *
 * - 必须首字符为 `/`
 * - 命令名贪婪匹配 `[a-zA-Z0-9-]+`，比对时统一转小写
 * - 命令名后可立即接非字符集字符（空白/中文/标点）作为 args，不强制要求空白分隔
 *   例：`/plan下午写周报` → name="plan", args="下午写周报"
 * - 未知技能返回 null（调用方可降级为普通对话）
 * - 已禁用（enabled=0）的技能视为未知
 */
const SKILL_INVOCATION_RE = /^\/([a-zA-Z0-9-]+)([\s\S]*)$/;

export function parseSkillInvocation(
  text: string,
  skills: Skill[]
): SkillInvocation | null {
  const match = text.match(SKILL_INVOCATION_RE);
  if (!match) return null;
  const name = match[1].toLowerCase();
  const args = (match[2] ?? "").trim();
  const skill = skills.find((s) => s.name === name && s.enabled === 1);
  if (!skill) return null;
  return { skill, args, raw: text };
}

/**
 * 自动补全匹配：先前缀、再子串，按 sort_order 稳定排序。
 * query 不含前导 `/`。
 */
export function matchSkillsByPrefix(
  query: string,
  skills: Skill[],
  limit = 6
): Skill[] {
  const q = query.toLowerCase();
  const enabled = skills.filter((s) => s.enabled === 1);
  if (!q) return enabled.slice(0, limit);
  const prefix: Skill[] = [];
  const substring: Skill[] = [];
  for (const s of enabled) {
    if (s.name.startsWith(q)) {
      prefix.push(s);
    } else if (
      s.name.includes(q) ||
      s.display_name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    ) {
      substring.push(s);
    }
  }
  return [...prefix, ...substring].slice(0, limit);
}

/**
 * 从输入框文本提取补全查询。
 * 返回 null 表示不应打开补全。
 */
export function extractSkillQuery(text: string): string | null {
  if (!text.startsWith("/")) return null;
  if (/\s/.test(text)) return null; // 已进入 args，不再补全命令名
  return text.slice(1);
}

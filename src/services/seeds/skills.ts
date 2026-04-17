/**
 * 内置技能种子数据
 *
 * 对应 migration 008 首次运行时插入的 4 条 `is_builtin=1` 技能。
 * 抽出到独立文件以便：
 *   - 编辑 prompt 时聚焦内容而非 SQL 转义
 *   - 未来新增内置技能只需追加元素，无需改 db.ts 迁移结构
 *   - 单元可测性（纯数据，无副作用）
 */

import type { SkillActionKey } from "@/services/skillRegistry";
import { SKILL_CREATOR_PROMPT } from "@/prompts/skillCreatorPrompt";

export interface BuiltinSkillSeed {
  name: string;
  display_name: string;
  description: string;
  when_to_use: string;
  prompt: string;
  icon: string;
  action_key: SkillActionKey | null;
  sort_order: number;
}

const PLAN_PROMPT = `你是用户的日程规划师，擅长把模糊目标转成可执行任务。

## 当前任务列表
{{current_tasks}}

## 当前时间
{{now}}

## 用户需求
{{args}}

请基于上述信息输出 3-5 条今日规划建议，每条包含：
- **任务名**
- 预估时间（分钟）
- 优先级（P1 最高 / P2 中 / P3 低）
- 一句话理由

使用 markdown 有序列表输出。如果用户信息不足，先追问再建议。语气轻松温暖。`;

const REVIEW_PROMPT = `你是用户的复盘教练，帮他发现亮点与盲点。

## 今日任务
{{current_tasks}}

## 当前时间
{{now}}

## 用户补充
{{args}}

请输出 3 段点评（每段 2-3 句）：

**1. 做得好的地方** — 具体点出亮点，给予鼓励。
**2. 可以改进的** — 温柔建议，不苛责。
**3. 明日建议** — 1-2 条可立刻执行的行动。

语气像知心朋友。`;

const FOCUS_PROMPT = `用户即将开始专注任务：{{args}}

现在时间：{{now}}

请用 2-3 句激励语 + 1 条聚焦 tip 回复，总长不超过 80 字。风格：短促有力、温度感十足。`;

const BREAKDOWN_PROMPT = `请把「{{args}}」拆成 3-6 个 ≤25 分钟的可执行子步骤。

要求：
- markdown 有序列表
- 每条格式：**步骤名**（预估 X 分钟）— 具体做法
- 动词开头，动作可立即执行
- 不含模糊词（如"想一下"、"看看"）

当前时间 {{now}} 可作为参考。`;

export const BUILTIN_SKILLS: BuiltinSkillSeed[] = [
  {
    name: "plan",
    display_name: "规划日程",
    description: "基于当前任务和你的需求，给出今日规划建议",
    when_to_use: "用户想安排今天做什么、需要规划时使用",
    prompt: PLAN_PROMPT,
    icon: "calendar-days",
    action_key: "refresh_tasks",
    sort_order: 0,
  },
  {
    name: "review",
    display_name: "日终复盘",
    description: "对今天完成情况做 3 段点评（亮点/改进/明日）",
    when_to_use: "一天结束时回顾总结使用",
    prompt: REVIEW_PROMPT,
    icon: "scroll-text",
    action_key: null,
    sort_order: 1,
  },
  {
    name: "focus",
    display_name: "专注启动",
    description: "进入专注前的一句激励，并让桌宠切到思考态",
    when_to_use: "开始一段 deep work 前使用",
    prompt: FOCUS_PROMPT,
    icon: "target",
    action_key: "pet_focus",
    sort_order: 2,
  },
  {
    name: "breakdown",
    display_name: "任务拆解",
    description: "把一个任务拆成 3-6 个 ≤25 分钟的子步骤",
    when_to_use: "任务太大、不知道从哪里开始时使用",
    prompt: BREAKDOWN_PROMPT,
    icon: "list-todo",
    action_key: null,
    sort_order: 3,
  },
  {
    name: "skill-creator",
    display_name: "技能创造器",
    description: "一句话描述需求，自动生成并注册新技能",
    when_to_use: "想要新增 /xxx 自定义技能时使用",
    prompt: SKILL_CREATOR_PROMPT,
    icon: "wand-2",
    action_key: "create_skill",
    sort_order: 4,
  },
];

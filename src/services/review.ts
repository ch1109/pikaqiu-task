import dayjs from "dayjs";
import { getDB } from "@/services/db";
import type { Task } from "@/types/task";
import { getActiveCharacter } from "@/services/character";
import { categoryLabels } from "@/components/task/taskMeta";
import { chatWithLLM } from "@/services/llm";
import {
  buildDailyReflectMessages,
  type ReflectTaskBrief,
} from "@/prompts/dailyReflect";

const DEFAULT_PET_NAME = "赛博桌宠";
const DEFAULT_PERSONA = "一只聪明友好、性格温暖的 AI 桌面伙伴";
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function toBrief(t: Task, withTime: boolean): ReflectTaskBrief {
  return {
    name: t.name,
    category: categoryLabels[t.category]?.text ?? "通用",
    completedAt:
      withTime && t.completed_at ? dayjs(t.completed_at).format("HH:mm") : null,
  };
}

/** 读取某日复盘文本缓存（未生成返回 null） */
export async function getReflection(
  planId: number
): Promise<{ text: string; at: string | null } | null> {
  const db = await getDB();
  const rows = await db.select<
    { ai_reflection: string | null; ai_reflection_at: string | null }[]
  >(
    "SELECT ai_reflection, ai_reflection_at FROM daily_reviews WHERE plan_id = $1",
    [planId]
  );
  const row = rows[0];
  if (!row?.ai_reflection) return null;
  return { text: row.ai_reflection, at: row.ai_reflection_at };
}

/**
 * 生成当日 AI 复盘文本并写入 daily_reviews 缓存。
 * 仅依赖可靠数据（任务名 / 状态 / 完成时刻），不碰已废弃的估/实时长。
 */
export async function generateReflection(planId: number): Promise<string> {
  const db = await getDB();
  const tasks = await db.select<Task[]>(
    "SELECT * FROM tasks WHERE plan_id = $1",
    [planId]
  );

  const completed = tasks
    .filter((t) => t.status === "completed")
    .map((t) => toBrief(t, true));
  const skipped = tasks
    .filter((t) => t.status === "skipped")
    .map((t) => toBrief(t, false));
  const pending = tasks
    .filter((t) => t.status === "pending" || t.status === "active")
    .map((t) => toBrief(t, false));

  const character = await getActiveCharacter();
  const petName = character?.name?.trim() || DEFAULT_PET_NAME;
  const persona = character?.description?.trim() || DEFAULT_PERSONA;

  const today = dayjs();
  const messages = buildDailyReflectMessages({
    petName,
    persona,
    dateLabel: `${today.format("YYYY年M月D日")} ${WEEKDAYS[today.day()]}`,
    now: today.format("HH:mm"),
    completed,
    pending,
    skipped,
  });

  const text = (
    await chatWithLLM(messages, { temperature: 0.8, maxTokens: 500 })
  ).trim();

  // daily_reviews 其余统计列均有 DEFAULT，仅写复盘文本即可
  await db.execute(
    `INSERT INTO daily_reviews (plan_id, ai_reflection, ai_reflection_at)
     VALUES ($1, $2, datetime('now','localtime'))
     ON CONFLICT(plan_id) DO UPDATE SET
       ai_reflection = $2,
       ai_reflection_at = datetime('now','localtime')`,
    [planId, text]
  );

  return text;
}

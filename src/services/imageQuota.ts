import { getDB } from "./db";
import { getImageProvider } from "./image";
import type { Settings } from "@/types/settings";

/** 今日日期：YYYY-MM-DD 本地时区 */
function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface QuotaSnapshot {
  used: number;
  quota: number;
  date: string;
  remaining: number;
}

async function readSettings(): Promise<Settings> {
  const db = await getDB();
  const rows = await db.select<Settings[]>(
    "SELECT * FROM settings WHERE id = 1"
  );
  return rows[0];
}

/** 读当前配额状态（若日期不是今天，自动重置 today_count） */
export async function getQuotaSnapshot(): Promise<QuotaSnapshot> {
  const s = await readSettings();
  const today = todayStr();
  if (s.image_gen_today_date !== today) {
    const db = await getDB();
    await db.execute(
      "UPDATE settings SET image_gen_today_count = 0, image_gen_today_date = $1 WHERE id = 1",
      [today]
    );
    return {
      used: 0,
      quota: s.image_gen_daily_quota,
      date: today,
      remaining: s.image_gen_daily_quota,
    };
  }
  return {
    used: s.image_gen_today_count,
    quota: s.image_gen_daily_quota,
    date: today,
    remaining: Math.max(0, s.image_gen_daily_quota - s.image_gen_today_count),
  };
}

/**
 * 扣减配额。本地 Provider 直接放行。
 * 若额度不足 → 抛错阻断生成。成功则把 today_count 原子加 n 并落库。
 */
export async function consumeQuota(n: number): Promise<void> {
  if (n <= 0) return;
  const provider = await getImageProvider();
  if (provider.isLocal()) return;

  const snap = await getQuotaSnapshot();
  if (snap.remaining < n) {
    throw new Error(
      `每日调用额度不足：今日已用 ${snap.used}/${snap.quota}，本次需要 ${n}。请到设置中调整上限或改用 ComfyUI 本地。`
    );
  }

  const db = await getDB();
  await db.execute(
    "UPDATE settings SET image_gen_today_count = image_gen_today_count + $1 WHERE id = 1",
    [n]
  );
}

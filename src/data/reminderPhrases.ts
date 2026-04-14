/**
 * 提醒气泡文案池
 *
 * 用 {title} 作为提醒标题插值位；pickPhrase 每次随机挑一条。
 * 文案追求卖萌 + 颜文字，和桌宠 Neon Kawaii 基调呼应。
 */

export const REMINDER_PHRASES: readonly string[] = [
  "主人~ 该做「{title}」啦 (ﾉ>ω<)ﾉ",
  "叮叮！「{title}」提醒时间到 ٩(◕‿◕)۶",
  "喂喂~ 别忘了「{title}」哦 (｡•̀ᴗ-)✧",
  "时间到啦！「{title}」等你呢 ૮₍ ˶ᵔ ᵕ ᵔ˶ ₎ა",
  "「{title}」—— 就是现在！ (งᴗ_ᴗ)ง",
  "嗷嗷！该「{title}」咯 ฅ(^•ω•^ฅ)",
  "咦？指针指向「{title}」了呢 (๑•̀ㅂ•́)و",
];

export function pickPhrase(title: string): string {
  const t =
    REMINDER_PHRASES[Math.floor(Math.random() * REMINDER_PHRASES.length)];
  return t.replace("{title}", title);
}

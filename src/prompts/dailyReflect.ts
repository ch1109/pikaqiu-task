import type { ChatMessage } from "@/services/llm/types";

/** 复盘用的任务摘要（喂给 LLM 的最小信息） */
export interface ReflectTaskBrief {
  name: string;
  /** 中文分类标签（工作 / 学习 / 生活 / 通用） */
  category: string;
  /** "HH:mm"，仅已完成任务带 */
  completedAt?: string | null;
}

export interface ReflectInput {
  petName: string;
  persona: string;
  /** 如 "2026年6月4日 周四" */
  dateLabel: string;
  /** 当前时刻 "HH:mm" */
  now: string;
  completed: ReflectTaskBrief[];
  pending: ReflectTaskBrief[];
  skipped: ReflectTaskBrief[];
}

function fmtList(items: ReflectTaskBrief[], withTime = false): string {
  if (items.length === 0) return "（无）";
  return items
    .map((t) => {
      const time = withTime && t.completedAt ? `，${t.completedAt} 完成` : "";
      return `- ${t.name}（${t.category}${time}）`;
    })
    .join("\n");
}

/**
 * 构造"今日复盘"对话。返回纯文本话术（非 JSON），chatWithLLM 直接拿到字符串展示。
 *
 * 去虚三原则写进硬约束：具体（点名真实任务）/ 诚实（提没做成的）/ 向前（一条明天建议）。
 */
export function buildDailyReflectMessages(input: ReflectInput): ChatMessage[] {
  const { petName, persona, dateLabel, now, completed, pending, skipped } = input;

  const system = `你是「${petName}」，${persona}。现在你要像朋友一样，陪用户做一次"今日复盘"——温暖、真诚、不浮夸。

## 今天（${dateLabel}，当前 ${now}）
已完成（${completed.length} 项）：
${fmtList(completed, true)}

未完成 / 还在进行（${pending.length} 项）：
${fmtList(pending)}

已跳过（${skipped.length} 项）：
${fmtList(skipped)}

## 复盘怎么写（必须全部遵守）
1. 先用一句话点名今天真实的"战绩"——必须出现上面列表里的真实任务名（如"『写周报』搞定了"），不许说"你完成了一些任务"这种空话。
2. 如果有没做完或跳过的，诚实地点名提一句，但语气是理解、不是责备。
3. 只给"一条"明天可以试的、跟今天情况挂钩的具体小建议——不要泛泛地喊"加油""继续努力"。
4. 全文 3-5 句，像在微信上跟朋友聊天，可带一点点你的性格，但别喧宾夺主。
5. 绝对不许编造列表里没有出现的任务或数字。
6. 如果今天一项都还没完成，就别假装有战绩——真诚地说一句鼓励，并从"未完成"里挑一个最小的，提议现在就开始。

直接输出这段复盘话本身，不要标题、不要分点、不要 markdown 代码块。`;

  return [
    { role: "system", content: system },
    { role: "user", content: "帮我复盘一下今天吧。" },
  ];
}

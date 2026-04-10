import type { TaskCategory } from "@/types/task";
import type { IconName } from "@/components/shared/Icon";

/**
 * 任务优先级对应的主题色 —— 纯墨色 5 级阶梯
 * P1 最黑最重 → P5 最轻最淡。
 * 理由：Editorial 配色严格限制朱砂红使用；priority 属于"标签"而非"CTA"，
 * 不应占用朱砂。P1 的视觉强调靠 TaskCard 已有的 3px 左边框 + 粗墨色呈现。
 */
export const priorityColors: Record<number, string> = {
  1: "var(--ink-900)",
  2: "var(--ink-700)",
  3: "var(--ink-500)",
  4: "var(--ink-400)",
  5: "var(--ink-300)",
};

export const priorityLabels: Record<number, string> = {
  1: "P1",
  2: "P2",
  3: "P3",
  4: "P4",
  5: "P5",
};

/**
 * 任务分类元数据：展示文本 + 主色 + 淡化背景 + 图标
 * work/study 用"颜色 + 图标"双通道区分，study 改用朱砂红与 work 拉开色相。
 */
export const categoryLabels: Record<
  TaskCategory,
  { text: string; color: string; bg: string; icon: IconName }
> = {
  work: {
    text: "工作",
    color: "var(--indigo-600)",
    bg: "var(--indigo-200)",
    icon: "briefcase",
  },
  study: {
    text: "学习",
    color: "var(--vermilion-600)",
    bg: "var(--vermilion-100)",
    icon: "graduation-cap",
  },
  life: {
    text: "生活",
    color: "var(--moss-600)",
    bg: "var(--moss-200)",
    icon: "heart",
  },
  general: {
    text: "通用",
    color: "var(--ink-500)",
    bg: "var(--ink-50)",
    icon: "circle",
  },
};

export const CATEGORY_KEYS: TaskCategory[] = ["work", "study", "life", "general"];

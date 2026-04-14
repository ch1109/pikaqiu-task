/**
 * Editorial Icon · lucide-react 薄包装
 *
 * 所有图标在此处静态导入 + 注册到 iconMap，保证 Vite tree-shake。
 * 固定 3 尺寸：xs=12 / sm=14 / md=16；描边 1.5px（accent=1.75）。
 */

import {
  AlertTriangle,
  ArrowRight,
  ArrowUp,
  BellRing,
  BookOpenText,
  Briefcase,
  CalendarDays,
  Check,
  Clock3,
  ChevronDown,
  ChevronRight,
  Circle,
  CornerDownLeft,
  GraduationCap,
  Heart,
  ListTodo,
  LogOut,
  MoreHorizontal,
  NotebookPen,
  PenLine,
  Play,
  ScrollText,
  SendHorizontal,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  Wand2,
  Lightbulb,
  X,
  Minus,
  Plus,
} from "lucide-react";
import type { LucideProps } from "lucide-react";

/* 可用图标清单 —— 新增图标时在此处注册 */
const iconMap = {
  "alert-triangle": AlertTriangle,
  "arrow-right": ArrowRight,
  "arrow-up": ArrowUp,
  "bell-ring": BellRing,
  "book-open-text": BookOpenText,
  briefcase: Briefcase,
  "calendar-days": CalendarDays,
  check: Check,
  clock: Clock3,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  circle: Circle,
  "corner-down-left": CornerDownLeft,
  "graduation-cap": GraduationCap,
  heart: Heart,
  "list-todo": ListTodo,
  "log-out": LogOut,
  "more-horizontal": MoreHorizontal,
  "notebook-pen": NotebookPen,
  "pen-line": PenLine,
  play: Play,
  "scroll-text": ScrollText,
  "send-horizontal": SendHorizontal,
  "settings-2": Settings2,
  sparkles: Sparkles,
  target: Target,
  "trash-2": Trash2,
  "wand-2": Wand2,
  lightbulb: Lightbulb,
  x: X,
  minus: Minus,
  plus: Plus,
} as const;

export type IconName = keyof typeof iconMap;

interface IconProps
  extends Omit<LucideProps, "ref" | "size" | "strokeWidth" | "fill"> {
  name: IconName;
  size?: "xs" | "sm" | "md" | number;
  accent?: boolean;
  fill?: boolean;
}

const SIZE_MAP = { xs: 12, sm: 14, md: 16 } as const;

export default function Icon({
  name,
  size = "sm",
  accent = false,
  fill = false,
  color = "currentColor",
  style,
  ...rest
}: IconProps) {
  const LucideIcon = iconMap[name];
  const px = typeof size === "number" ? size : SIZE_MAP[size];
  const stroke = accent ? 1.75 : 1.5;

  return (
    <LucideIcon
      size={px}
      strokeWidth={stroke}
      color={color}
      fill={fill ? color : "none"}
      style={{
        flexShrink: 0,
        display: "inline-block",
        verticalAlign: "middle",
        ...style,
      }}
      {...rest}
    />
  );
}

import dayjs from "dayjs";
import Icon from "@/components/shared/Icon";
import type { Reminder, Weekday } from "@/types/reminder";

interface ReminderItemProps {
  reminder: Reminder;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
}

const WEEKDAY_SHORT: Record<Weekday, string> = {
  0: "日",
  1: "一",
  2: "二",
  3: "三",
  4: "四",
  5: "五",
  6: "六",
};

function summarizeWeekdays(days: Weekday[]): string {
  if (days.length === 0) return "每天";
  if (days.length === 7) return "每天";
  if (
    days.length === 5 &&
    [1, 2, 3, 4, 5].every((d) => days.includes(d as Weekday))
  )
    return "工作日";
  if (days.length === 2 && days.includes(0) && days.includes(6)) return "周末";
  return [...days].sort().map((d) => WEEKDAY_SHORT[d]).join("");
}

function formatIntervalMin(min: number): string {
  if (min % 60 === 0) return `${min / 60} 小时`;
  if (min > 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h} 小时 ${m} 分`;
  }
  return `${min} 分钟`;
}

function summarizeRepeat(r: Reminder): string {
  if (r.repeat_kind === "none") return "单次";
  if (r.repeat_kind === "daily") return "每天";
  if (r.repeat_kind === "weekdays") {
    const days = r.weekdays ?? [];
    if (days.length === 0) return "未指定";
    return "每周 " + summarizeWeekdays(days);
  }
  if (r.repeat_kind === "interval") {
    const intervalLabel = r.interval_minutes
      ? `每 ${formatIntervalMin(r.interval_minutes)}`
      : "按间隔";
    const win =
      r.window_start && r.window_end
        ? ` · ${r.window_start}-${r.window_end}`
        : "";
    const daysLabel =
      r.weekdays && r.weekdays.length > 0
        ? ` · ${summarizeWeekdays(r.weekdays)}`
        : "";
    return `${intervalLabel}${win}${daysLabel}`;
  }
  return "";
}

function formatRelative(iso: string): string {
  const target = dayjs(iso);
  const now = dayjs();
  const diffMs = target.diff(now);
  if (diffMs < 0) return "已过";

  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "不到 1 分钟";
  if (mins < 60) return `${mins} 分钟后`;
  const hours = Math.floor(mins / 60);
  const remMin = mins % 60;
  if (hours < 24) {
    return remMin > 0 ? `${hours} 小时 ${remMin} 分后` : `${hours} 小时后`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天后`;
  return target.format("M 月 D 日");
}

function formatAbsolute(iso: string): string {
  const target = dayjs(iso);
  const now = dayjs();
  if (target.isSame(now, "day")) return `今日 ${target.format("HH:mm")}`;
  if (target.isSame(now.add(1, "day"), "day"))
    return `明日 ${target.format("HH:mm")}`;
  if (target.isSame(now, "year")) return target.format("M/D HH:mm");
  return target.format("YYYY-MM-DD HH:mm");
}

export default function ReminderItem({
  reminder,
  index,
  onEdit,
  onDelete,
  onToggle,
}: ReminderItemProps) {
  const { enabled, title, next_trigger_at } = reminder;

  return (
    <div
      className="animate-card-enter"
      style={{
        "--i": index,
        position: "relative",
        background: "var(--paper-0)",
        border: "1px solid var(--rule-line)",
        borderLeft: enabled
          ? "3px solid var(--vermilion-600)"
          : "3px solid var(--ink-200)",
        borderRadius: "var(--radius-lg)",
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        opacity: enabled ? 1 : 0.55,
        boxShadow: "var(--shadow-paper-low)",
        transition: "var(--transition-normal)",
      } as React.CSSProperties}
    >
      {/* 主体信息 */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 1.4,
            color: enabled ? "var(--ink-900)" : "var(--ink-500)",
            textDecoration: enabled ? "none" : "line-through",
            wordBreak: "break-word",
          }}
        >
          {title}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span
            className="text-mono"
            style={{
              fontSize: 11,
              letterSpacing: "-0.01em",
              color: enabled ? "var(--vermilion-600)" : "var(--ink-400)",
              fontWeight: 600,
            }}
          >
            {formatRelative(next_trigger_at)}
          </span>
          <span
            aria-hidden="true"
            style={{
              width: 1,
              height: 10,
              background: "var(--rule-line)",
              display: "inline-block",
            }}
          />
          <span
            className="text-mono"
            style={{
              fontSize: 11,
              color: "var(--ink-500)",
              letterSpacing: "-0.01em",
            }}
          >
            {formatAbsolute(next_trigger_at)}
          </span>
          <span
            aria-hidden="true"
            style={{
              width: 1,
              height: 10,
              background: "var(--rule-line)",
              display: "inline-block",
            }}
          />
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              fontFamily: "var(--font-display)",
              color: "var(--ink-500)",
              letterSpacing: "0.02em",
            }}
          >
            {summarizeRepeat(reminder)}
          </span>
        </div>
      </div>

      {/* 开关 */}
      <button
        type="button"
        className="btn"
        onClick={() => onToggle(!enabled)}
        title={enabled ? "暂停此提醒" : "启用此提醒"}
        style={{
          width: 34,
          height: 20,
          borderRadius: 999,
          padding: 0,
          position: "relative",
          background: enabled ? "var(--moss-600)" : "var(--ink-200)",
          transition: "background 180ms ease",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: enabled ? 16 : 2,
            width: 16,
            height: 16,
            borderRadius: 999,
            background: "#FFFFFF",
            boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
            transition: "left 200ms var(--ease-out-expo)",
          }}
        />
      </button>

      {/* 编辑 / 删除 */}
      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
        <button
          type="button"
          className="btn btn-icon btn-ghost"
          onClick={onEdit}
          title="编辑"
          style={{
            width: 24,
            height: 24,
            borderRadius: "var(--radius-sm)",
          }}
        >
          <Icon name="pen-line" size="sm" color="var(--ink-500)" />
        </button>
        <button
          type="button"
          className="btn btn-icon btn-ghost"
          onClick={onDelete}
          title="删除"
          style={{
            width: 24,
            height: 24,
            borderRadius: "var(--radius-sm)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--accent-danger-soft)";
            e.currentTarget.style.color = "var(--accent-danger)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "";
          }}
        >
          <Icon name="trash-2" size="sm" color="currentColor" />
        </button>
      </div>
    </div>
  );
}

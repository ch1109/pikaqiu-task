import { useState, useMemo, useEffect } from "react";
import dayjs from "dayjs";
import Icon from "@/components/shared/Icon";
import type { Reminder, RepeatKind, Weekday } from "@/types/reminder";

interface ReminderFormProps {
  initial?: Reminder;
  onSubmit: (data: {
    title: string;
    next_trigger_at: string;
    repeat_kind: RepeatKind;
    weekdays: Weekday[] | null;
    interval_minutes: number | null;
    window_start: string | null;
    window_end: string | null;
  }) => Promise<void>;
  onCancel: () => void;
}

const WEEKDAY_LABELS: { day: Weekday; label: string }[] = [
  { day: 1, label: "一" },
  { day: 2, label: "二" },
  { day: 3, label: "三" },
  { day: 4, label: "四" },
  { day: 5, label: "五" },
  { day: 6, label: "六" },
  { day: 0, label: "日" },
];

const WORKDAYS: Weekday[] = [1, 2, 3, 4, 5];
const WEEKEND: Weekday[] = [0, 6];

/** 把 ISO datetime 字符串转为 datetime-local input 可用格式 "YYYY-MM-DDTHH:mm" */
function toInputValue(iso: string): string {
  return dayjs(iso).format("YYYY-MM-DDTHH:mm");
}

/** 默认 30 分钟后 */
function defaultDateTime(): string {
  return dayjs().add(30, "minute").second(0).format("YYYY-MM-DDTHH:mm");
}

export default function ReminderForm({
  initial,
  onSubmit,
  onCancel,
}: ReminderFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [dt, setDt] = useState(() =>
    initial ? toInputValue(initial.next_trigger_at) : defaultDateTime()
  );
  const [repeatKind, setRepeatKind] = useState<RepeatKind>(
    initial?.repeat_kind ?? "none"
  );
  const [weekdays, setWeekdays] = useState<Weekday[]>(
    initial?.weekdays ?? []
  );
  const [intervalMin, setIntervalMin] = useState<number>(
    initial?.interval_minutes ?? 60
  );
  const [winStart, setWinStart] = useState<string>(
    initial?.window_start ?? "09:00"
  );
  const [winEnd, setWinEnd] = useState<string>(initial?.window_end ?? "18:00");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);
  }, [title, dt, repeatKind, weekdays, intervalMin, winStart, winEnd]);

  const weekdaysSet = useMemo(() => new Set(weekdays), [weekdays]);
  const intervalValid = Number.isFinite(intervalMin) && intervalMin >= 1 && intervalMin <= 1440;
  const windowValid = winStart < winEnd;
  const canSubmit =
    title.trim().length > 0 &&
    dt.length > 0 &&
    (repeatKind !== "weekdays" || weekdays.length > 0) &&
    (repeatKind !== "interval" || (intervalValid && windowValid));

  const toggleDay = (d: Weekday) => {
    setWeekdays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    const trimmed = title.trim();
    // datetime-local 输入无秒字段，补 :00
    const iso = `${dt}:00`;
    if (repeatKind === "none" && dayjs(iso).isBefore(dayjs())) {
      setErr("单次提醒的时间必须在未来");
      return;
    }
    if (repeatKind === "interval") {
      if (!intervalValid) {
        setErr("间隔需在 1-1440 分钟之间");
        return;
      }
      if (!windowValid) {
        setErr("结束时间必须晚于开始时间");
        return;
      }
    }
    setSubmitting(true);
    try {
      await onSubmit({
        title: trimmed,
        next_trigger_at: iso,
        repeat_kind: repeatKind,
        weekdays:
          repeatKind === "weekdays"
            ? [...weekdays].sort()
            : repeatKind === "interval" && weekdays.length > 0
            ? [...weekdays].sort()
            : null,
        interval_minutes: repeatKind === "interval" ? intervalMin : null,
        window_start: repeatKind === "interval" ? winStart : null,
        window_end: repeatKind === "interval" ? winEnd : null,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="animate-panel-enter"
      style={{
        background: "var(--paper-0)",
        border: "1px solid var(--rule-line)",
        borderRadius: "var(--radius-lg)",
        padding: "16px 18px 14px",
        boxShadow: "var(--shadow-paper-lift)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            width: 24,
            height: 24,
            borderRadius: 999,
            background: "var(--vermilion-200)",
            color: "var(--vermilion-600)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="bell-ring" size="sm" color="var(--vermilion-600)" />
        </span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--vermilion-600)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {initial ? "编辑提醒" : "新建提醒"}
        </span>
      </div>

      {/* 标题 */}
      <Field label="提醒内容">
        <input
          className="input-field"
          type="text"
          value={title}
          autoFocus
          maxLength={60}
          placeholder="例如：写日报、喝水、站起来走走"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSubmit) handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
          style={{ padding: "8px 12px", fontSize: 13, width: "100%" }}
        />
      </Field>

      {/* 时间 */}
      <Field label="触发时间">
        <input
          className="input-field"
          type="datetime-local"
          value={dt}
          onChange={(e) => setDt(e.target.value)}
          style={{
            padding: "8px 12px",
            fontSize: 13,
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.01em",
            width: "100%",
          }}
        />
      </Field>

      {/* 重复 */}
      <Field label="重复">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["none", "daily", "weekdays", "interval"] as RepeatKind[]).map((kind) => {
            const active = repeatKind === kind;
            const label =
              kind === "none"
                ? "单次"
                : kind === "daily"
                ? "每天"
                : kind === "weekdays"
                ? "按周几"
                : "按间隔";
            return (
              <button
                key={kind}
                type="button"
                className="btn"
                onClick={() => setRepeatKind(kind)}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  borderRadius: 999,
                  border: active
                    ? "1px solid var(--vermilion-600)"
                    : "1px solid var(--rule-line)",
                  background: active ? "var(--vermilion-200)" : "var(--paper-1)",
                  color: active ? "var(--vermilion-600)" : "var(--ink-600)",
                  fontWeight: active ? 600 : 500,
                  fontFamily: "var(--font-display)",
                  letterSpacing: "0.02em",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </Field>

      {/* 周几 */}
      {repeatKind === "weekdays" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "10px 12px",
            background: "var(--paper-1)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--rule-line-dim)",
          }}
        >
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {WEEKDAY_LABELS.map(({ day, label }) => {
              const active = weekdaysSet.has(day);
              return (
                <button
                  key={day}
                  type="button"
                  className="btn"
                  onClick={() => toggleDay(day)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    fontSize: 12,
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    background: active
                      ? "var(--vermilion-600)"
                      : "var(--paper-0)",
                    color: active ? "#FFFFFF" : "var(--ink-600)",
                    border: active
                      ? "1px solid var(--vermilion-600)"
                      : "1px solid var(--rule-line)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setWeekdays([...WORKDAYS])}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                letterSpacing: "0.02em",
              }}
            >
              工作日
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setWeekdays([...WEEKEND])}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                letterSpacing: "0.02em",
              }}
            >
              周末
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setWeekdays([])}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                letterSpacing: "0.02em",
                color: "var(--ink-400)",
              }}
            >
              清空
            </button>
          </div>
        </div>
      )}

      {/* 间隔模式展开：分钟数 + 时间窗口 + 可选周几 */}
      {repeatKind === "interval" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: "12px 14px",
            background: "var(--paper-1)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--rule-line-dim)",
          }}
        >
          {/* 间隔 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 10,
                fontWeight: 600,
                color: "var(--ink-500)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              间隔（分钟）
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <input
                className="input-field"
                type="number"
                min={1}
                max={1440}
                step={1}
                value={intervalMin}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setIntervalMin(Number.isFinite(v) ? v : 0);
                }}
                style={{
                  padding: "7px 10px",
                  fontSize: 13,
                  fontFamily: "var(--font-display)",
                  width: 88,
                }}
              />
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {[30, 60, 90, 120].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setIntervalMin(v)}
                    style={{
                      padding: "4px 9px",
                      fontSize: 11,
                      letterSpacing: "0.02em",
                      fontFamily: "var(--font-display)",
                      background:
                        intervalMin === v ? "var(--vermilion-200)" : "transparent",
                      color:
                        intervalMin === v ? "var(--vermilion-600)" : "var(--ink-500)",
                    }}
                  >
                    {v >= 60 && v % 60 === 0 ? `${v / 60} 小时` : `${v} 分`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 时间窗口 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 10,
                fontWeight: 600,
                color: "var(--ink-500)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              触发窗口
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                className="input-field"
                type="time"
                value={winStart}
                onChange={(e) => setWinStart(e.target.value)}
                style={{
                  padding: "7px 10px",
                  fontSize: 13,
                  fontFamily: "var(--font-display)",
                }}
              />
              <span
                className="text-mono"
                style={{ color: "var(--ink-400)", fontSize: 12 }}
              >
                —
              </span>
              <input
                className="input-field"
                type="time"
                value={winEnd}
                onChange={(e) => setWinEnd(e.target.value)}
                style={{
                  padding: "7px 10px",
                  fontSize: 13,
                  fontFamily: "var(--font-display)",
                }}
              />
            </div>
          </div>

          {/* 周几过滤（可选，空 = 每天） */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 10,
                fontWeight: 600,
                color: "var(--ink-500)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              仅限以下日子（留空=每天）
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {WEEKDAY_LABELS.map(({ day, label }) => {
                const active = weekdaysSet.has(day);
                return (
                  <button
                    key={day}
                    type="button"
                    className="btn"
                    onClick={() => toggleDay(day)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      fontSize: 11,
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      background: active ? "var(--vermilion-600)" : "var(--paper-0)",
                      color: active ? "#FFFFFF" : "var(--ink-600)",
                      border: active
                        ? "1px solid var(--vermilion-600)"
                        : "1px solid var(--rule-line)",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setWeekdays([...WORKDAYS])}
                style={{ padding: "4px 10px", fontSize: 11 }}
              >
                工作日
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setWeekdays([...WEEKEND])}
                style={{ padding: "4px 10px", fontSize: 11 }}
              >
                周末
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setWeekdays([])}
                style={{
                  padding: "4px 10px",
                  fontSize: 11,
                  color: "var(--ink-400)",
                }}
              >
                清空
              </button>
            </div>
          </div>
        </div>
      )}

      {err && (
        <div
          style={{
            fontSize: 11,
            color: "var(--seal-red)",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontFamily: "var(--font-display)",
          }}
        >
          <Icon name="alert-triangle" size="xs" color="var(--seal-red)" />
          {err}
        </div>
      )}

      {/* 操作 */}
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          paddingTop: 4,
        }}
      >
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onCancel}
          style={{ padding: "8px 16px", fontSize: 12 }}
        >
          取消
        </button>
        <button
          type="button"
          className="btn btn-cyan"
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          style={{ padding: "8px 18px", fontSize: 12 }}
        >
          {submitting ? "保存中..." : initial ? "保存" : "添加"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 10,
          fontWeight: 600,
          color: "var(--ink-500)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

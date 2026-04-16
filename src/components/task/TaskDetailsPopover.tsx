import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import type { Task, SubTask, TaskCategory } from "@/types/task";
import Icon from "@/components/shared/Icon";
import { clearAlarmDedup } from "@/services/taskAlarm";
import {
  priorityColors,
  priorityLabels,
  categoryLabels,
  CATEGORY_KEYS,
} from "./taskMeta";

interface TaskDetailsPopoverProps {
  task: Task;
  hasSubtasks: boolean;
  decomposing: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onUpdate: (fields: {
    priority?: number;
    category?: TaskCategory;
    deadline?: string | null;
    estimated_mins?: number;
    planned_start_time?: string | null;
    planned_end_time?: string | null;
  }) => void;
  onDecompose: () => void;
  onDelete: () => void;
  onClose: () => void;
  /** 只读模式：复盘中回看已完成任务时使用，禁用所有编辑交互并隐藏底部操作 */
  readOnly?: boolean;
  /** readOnly 下可传入子任务列表用于只读展示 */
  subtasks?: SubTask[];
}

const PRIORITIES = [1, 2, 3, 4, 5];
const ESTIMATE_PRESETS = [15, 30, 60, 90];
/** 估算的浮层高度上限，用于决定向下/向上翻转定位 */
const POPOVER_MAX_H = 520;
const POPOVER_PAD = 8;

export default function TaskDetailsPopover({
  task,
  hasSubtasks,
  decomposing,
  anchorRef,
  onUpdate,
  onDecompose,
  onDelete,
  onClose,
  readOnly = false,
  subtasks,
}: TaskDetailsPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [draftStart, setDraftStart] = useState(task.planned_start_time ?? "");
  const [draftEnd, setDraftEnd] = useState(task.planned_end_time ?? "");
  const [timeHint, setTimeHint] = useState<string | null>(null);
  const [pos, setPos] = useState<
    { top: number; right: number; openUp: boolean; maxH: number } | null
  >(null);

  const isOvertime = useMemo(() => {
    if (!task.planned_end_time) return false;
    if (task.status === "completed" || task.status === "skipped") return false;
    const now = dayjs();
    const end = dayjs().hour(Number(task.planned_end_time.slice(0, 2)))
      .minute(Number(task.planned_end_time.slice(3, 5)))
      .second(0)
      .millisecond(0);
    return now.isAfter(end);
  }, [task.planned_end_time, task.status]);

  // 首帧定位：若下方空间不足则向上翻转，避免被窗口底部裁剪
  useLayoutEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom - POPOVER_PAD;
    const above = rect.top - POPOVER_PAD;
    const needed = Math.min(POPOVER_MAX_H, window.innerHeight - 2 * POPOVER_PAD);
    const openUp = below < needed && above > below;
    const maxH = Math.max(160, openUp ? above : below);
    const top = openUp
      ? Math.max(POPOVER_PAD, rect.top - maxH - POPOVER_PAD)
      : rect.bottom + POPOVER_PAD;
    setPos({
      top,
      right: Math.max(POPOVER_PAD, window.innerWidth - rect.right),
      openUp,
      maxH,
    });
  }, [anchorRef]);

  const commitAnchor = (nextStart: string, nextEnd: string) => {
    const hasAny = !!(nextStart || nextEnd);
    if (!hasAny) {
      setTimeHint(null);
      onUpdate({ planned_start_time: null, planned_end_time: null });
      return;
    }
    // 允许只有开始时间：适配"知道何时开始但结束时间不确定"的场景
    if (!nextStart && nextEnd) {
      setTimeHint("请先填写开始时间");
      return;
    }
    if (nextStart && nextEnd && nextEnd <= nextStart) {
      setTimeHint("结束时间必须晚于开始时间");
      return;
    }
    setTimeHint(null);
    onUpdate({
      planned_start_time: nextStart,
      planned_end_time: nextEnd || null,
    });
  };

  const clearAnchor = () => {
    setDraftStart("");
    setDraftEnd("");
    setTimeHint(null);
    onUpdate({ planned_start_time: null, planned_end_time: null });
    clearAlarmDedup(task.id, "start");
    clearAlarmDedup(task.id, "end");
  };

  /**
   * 顺延：从 max(现在, 原 end) 开始加 mins，确保顺延结果落在未来，
   * 否则超时态立即再次触发毫无意义。清除 end 的 dedup 标记以允许再次提醒。
   */
  const postponeEnd = (mins: number) => {
    const base = task.planned_end_time ?? task.planned_start_time;
    if (!base) return;
    const [h, m] = base.split(":").map(Number);
    const baseTs = dayjs().hour(h).minute(m).second(0).millisecond(0);
    const start = baseTs.isAfter(dayjs()) ? baseTs : dayjs();
    const nextStr = start.add(mins, "minute").format("HH:mm");
    setDraftEnd(nextStr);
    setTimeHint(null);
    onUpdate({ planned_end_time: nextStr });
    clearAlarmDedup(task.id, "end");
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // 滚动或窗口尺寸变化时关闭，避免浮层与锚点错位
    const handleDismiss = () => onClose();

    // 延迟到下一帧再注册，避免打开时的 mousedown 立即关闭
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEsc);
      window.addEventListener("scroll", handleDismiss, true);
      window.addEventListener("resize", handleDismiss);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("resize", handleDismiss);
    };
  }, [onClose, anchorRef]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={ref}
      className="animate-popover"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: pos.top,
        right: pos.right,
        width: 300,
        maxHeight: pos.maxH,
        overflowY: "auto",
        background: "var(--paper-0)",
        border: "1px solid var(--rule-line)",
        borderRadius: "var(--radius-lg)",
        padding: 20,
        boxShadow: "var(--shadow-paper-lift)",
        zIndex: 300,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        transformOrigin: pos.openUp ? "bottom right" : "top right",
      }}
    >
      {readOnly && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingBottom: 12,
            borderBottom: "1px solid var(--rule-line)",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              color: "var(--moss-600)",
              background: "var(--moss-100)",
              padding: "3px 9px",
              borderRadius: 999,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            <Icon name="check" size="xs" color="var(--moss-600)" />
            已完成
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink-900)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={task.name}
          >
            {task.name}
          </span>
          {task.completed_at && (
            <span
              className="text-mono"
              style={{
                fontSize: 11,
                color: "var(--ink-500)",
                letterSpacing: "-0.01em",
                flexShrink: 0,
              }}
              title={dayjs(task.completed_at).format("YYYY-MM-DD HH:mm")}
            >
              {dayjs(task.completed_at).format("HH:mm")}
            </span>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          pointerEvents: readOnly ? "none" : "auto",
          opacity: readOnly ? 0.82 : 1,
        }}
        aria-disabled={readOnly}
      >
      {/* 优先级 */}
      <Row label="优先级">
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {PRIORITIES.map((p) => {
            const selected = task.priority === p;
            return (
              <button
                key={p}
                className="btn"
                onClick={() => onUpdate({ priority: p })}
                title={priorityLabels[p]}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  background: priorityColors[p],
                  opacity: selected ? 1 : 0.3,
                  boxShadow: selected
                    ? "0 0 0 2px var(--paper-0), 0 0 0 3px var(--vermilion-400)"
                    : "none",
                  transition: "all 180ms var(--ease-out-back)",
                  padding: 0,
                  border: "none",
                }}
              />
            );
          })}
        </div>
      </Row>

      {/* 分类 */}
      <Row label="分类">
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CATEGORY_KEYS.map((cat) => {
            const info = categoryLabels[cat];
            const selected = task.category === cat;
            return (
              <button
                key={cat}
                className="btn"
                onClick={() => onUpdate({ category: cat })}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 12px 5px 10px",
                  fontSize: 11,
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  borderRadius: 999,
                  color: selected ? info.color : "var(--ink-500)",
                  background: selected ? info.bg : "transparent",
                  border: selected
                    ? `1px solid ${info.color}`
                    : "1px solid var(--ink-200)",
                }}
              >
                <Icon
                  name={info.icon}
                  size="xs"
                  color={selected ? info.color : "var(--ink-500)"}
                />
                {info.text}
              </button>
            );
          })}
        </div>
      </Row>

      {/* 预估时长 */}
      <Row label="预估时长">
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {ESTIMATE_PRESETS.map((m) => {
            const selected = task.estimated_mins === m;
            return (
              <button
                key={m}
                className="btn"
                onClick={() => onUpdate({ estimated_mins: m })}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "-0.01em",
                  background: selected ? "var(--vermilion-600)" : "transparent",
                  color: selected ? "#FFFFFF" : "var(--ink-600)",
                  border: selected
                    ? "1px solid var(--vermilion-600)"
                    : "1px solid var(--ink-200)",
                }}
              >
                {m}m
              </button>
            );
          })}
          <input
            type="number"
            min={1}
            value={task.estimated_mins}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n) && n > 0) {
                onUpdate({ estimated_mins: n });
              }
            }}
            className="input-field"
            style={{
              width: 64,
              padding: "6px 8px",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              textAlign: "center",
            }}
          />
        </div>
      </Row>

      {/* 截止日 */}
      <Row label="截止日">
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="date"
            value={task.deadline ?? ""}
            onChange={(e) =>
              onUpdate({ deadline: e.target.value || null })
            }
            className="input-field"
            style={{
              flex: 1,
              padding: "6px 10px",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              colorScheme: "light",
            }}
          />
          {task.deadline && (
            <button
              className="btn btn-ghost"
              onClick={() => onUpdate({ deadline: null })}
              style={{
                padding: "6px 8px",
                borderRadius: "var(--radius-sm)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="清除"
            >
              <Icon name="x" size="xs" color="var(--ink-400)" />
            </button>
          )}
        </div>
      </Row>

      {/* 时间锚点（可选） */}
      <Row label="时间锚点（可选）">
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            type="time"
            value={draftStart}
            onChange={(e) => {
              setDraftStart(e.target.value);
              commitAnchor(e.target.value, draftEnd);
            }}
            className="input-field"
            style={{
              width: 96,
              padding: "6px 10px",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              colorScheme: "light",
            }}
          />
          <span style={{ color: "var(--ink-400)", fontSize: 12 }}>—</span>
          <input
            type="time"
            value={draftEnd}
            onChange={(e) => {
              setDraftEnd(e.target.value);
              commitAnchor(draftStart, e.target.value);
            }}
            className="input-field"
            style={{
              width: 96,
              padding: "6px 10px",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              colorScheme: "light",
            }}
          />
          {(draftStart || draftEnd) && (
            <button
              className="btn btn-ghost"
              onClick={clearAnchor}
              style={{
                padding: "6px 8px",
                borderRadius: "var(--radius-sm)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="清除时间锚点"
            >
              <Icon name="x" size="xs" color="var(--ink-400)" />
            </button>
          )}
        </div>
        {timeHint && (
          <div
            style={{
              fontSize: 11,
              color: "var(--seal-red)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              marginTop: 2,
            }}
          >
            <Icon name="alert-triangle" size="xs" color="var(--seal-red)" />
            {timeHint}
          </div>
        )}

        {isOvertime && !readOnly && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 4,
              padding: "8px 10px",
              background: "var(--amber-100)",
              border: "1px solid var(--amber-200)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <Icon name="alert-triangle" size="xs" color="var(--amber-600)" />
            <span style={{ fontSize: 11, color: "var(--amber-600)", flex: 1 }}>
              已超时 · 可顺延一点时间
            </span>
            <button
              className="btn"
              onClick={() => postponeEnd(30)}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                borderRadius: 999,
                background: "var(--amber-600)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
              }}
              title="将结束时间推后 30 分钟并重新开启提醒"
            >
              +30 分钟
            </button>
          </div>
        )}
      </Row>
      </div>

      {readOnly && subtasks && subtasks.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--ink-500)",
              fontWeight: 500,
            }}
          >
            子任务 · {subtasks.filter((s) => s.status === "completed").length}/{subtasks.length}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {subtasks.map((sub) => {
              const done = sub.status === "completed";
              const skipped = sub.status === "skipped";
              return (
                <div
                  key={sub.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    background: "var(--paper-1)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <Icon
                    name={done ? "check" : skipped ? "minus" : "circle"}
                    size="xs"
                    color={
                      done
                        ? "var(--moss-600)"
                        : skipped
                          ? "var(--ink-400)"
                          : "var(--ink-500)"
                    }
                  />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 12,
                      color: done ? "var(--ink-600)" : "var(--ink-800)",
                      textDecoration: done || skipped ? "line-through" : "none",
                      textDecorationColor: "var(--ink-300)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={sub.name}
                  >
                    {sub.name}
                  </span>
                  {sub.actual_mins != null && (
                    <span
                      className="text-mono"
                      style={{
                        fontSize: 11,
                        color: "var(--ink-500)",
                        letterSpacing: "-0.01em",
                        flexShrink: 0,
                      }}
                    >
                      {sub.actual_mins}′
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI 拆解 + 删除 */}
      {!readOnly && (
      <div
        style={{
          borderTop: "1px solid var(--rule-line)",
          paddingTop: 14,
          marginTop: 2,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <button
          className="btn btn-cyan"
          onClick={() => {
            onDecompose();
          }}
          disabled={decomposing}
          style={{
            width: "100%",
            padding: "10px 14px",
            fontSize: 12,
            fontFamily: "var(--font-display)",
            fontWeight: 500,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            cursor: decomposing ? "wait" : "pointer",
            opacity: decomposing ? 0.7 : 1,
          }}
        >
          {decomposing ? (
            <span className="animate-shake-nib" style={{ display: "inline-flex" }}>
              <Icon name="sparkles" size="xs" color="currentColor" />
            </span>
          ) : hasSubtasks ? (
            <Icon name="wand-2" size="xs" color="currentColor" />
          ) : (
            <Icon name="sparkles" size="xs" color="currentColor" />
          )}
          {decomposing
            ? "正在拆解…"
            : hasSubtasks
              ? "重新拆解子任务"
              : "AI 拆解子任务"}
        </button>

        <button
          className="btn btn-danger"
          onClick={() => {
            onDelete();
            onClose();
          }}
          style={{
            width: "100%",
            padding: "10px 14px",
            fontSize: 12,
            fontFamily: "var(--font-display)",
            fontWeight: 500,
          }}
        >
          删除任务
        </button>
      </div>
      )}
    </div>,
    document.body,
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          fontSize: 11,
          color: "var(--ink-500)",
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

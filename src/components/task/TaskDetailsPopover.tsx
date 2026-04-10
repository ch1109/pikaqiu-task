import { useEffect, useRef } from "react";
import type { Task, TaskCategory } from "@/types/task";
import Icon from "@/components/shared/Icon";
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
  onUpdate: (fields: {
    priority?: number;
    category?: TaskCategory;
    deadline?: string | null;
    estimated_mins?: number;
  }) => void;
  onDecompose: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const PRIORITIES = [1, 2, 3, 4, 5];
const ESTIMATE_PRESETS = [15, 30, 60, 90];

export default function TaskDetailsPopover({
  task,
  hasSubtasks,
  decomposing,
  onUpdate,
  onDecompose,
  onDelete,
  onClose,
}: TaskDetailsPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // 延迟到下一帧再注册，避免打开时的 mousedown 立即关闭
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEsc);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="animate-popover"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 12,
        width: 300,
        background: "var(--paper-0)",
        border: "1px solid var(--rule-line)",
        borderRadius: "var(--radius-lg)",
        padding: 20,
        boxShadow: "var(--shadow-paper-lift)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
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

      {/* AI 拆解 + 删除 */}
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
    </div>
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

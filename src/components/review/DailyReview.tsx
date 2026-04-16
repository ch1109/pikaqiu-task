import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import dayjs from "dayjs";
import type { Task, SubTask } from "@/types/task";
import ProgressRing from "@/components/shared/ProgressRing";
import SectionMasthead from "@/components/shared/SectionMasthead";
import Icon from "@/components/shared/Icon";
import { categoryLabels } from "@/components/task/taskMeta";
import TaskDetailsPopover from "@/components/task/TaskDetailsPopover";
import { generateReview, type DailyReviewData } from "@/services/review";
import { useTaskStore } from "@/stores/useTaskStore";

interface DailyReviewProps {
  planId: number | null;
  tasks: Task[];
}

type HistoryRow = { date: string; completed: number };
const HISTORY_WINDOWS = [14, 30, 90, 180] as const;
type HistoryDays = (typeof HISTORY_WINDOWS)[number];

export default function DailyReview({ planId, tasks }: DailyReviewProps) {
  const [review, setReview] = useState<DailyReviewData | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyDays, setHistoryDays] = useState<HistoryDays>(14);
  const loadHistory = useTaskStore((s) => s.loadHistory);
  const loadCompletedByDate = useTaskStore((s) => s.loadCompletedByDate);
  const todaySubtasks = useTaskStore((s) => s.subtasks);

  // 展开的某一天历史（单日）
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<{
    tasks: Task[];
    subtasksByTask: Record<number, SubTask[]>;
  } | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);

  // 详情 Popover 状态
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [openSubtasks, setOpenSubtasks] = useState<SubTask[]>([]);
  const anchorMap = useRef<Map<string, HTMLElement>>(new Map());
  const openAnchorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (planId && tasks.length > 0) {
      generateReview(planId).then(setReview);
    }
  }, [planId, tasks]);

  useEffect(() => {
    loadHistory(historyDays).then(setHistory);
  }, [loadHistory, tasks, historyDays]);

  // 历史窗口切换后重置展开态，避免展示与选中日期错位
  useEffect(() => {
    setExpandedDate(null);
    setExpandedData(null);
  }, [historyDays]);

  // 展开日期变化时关闭可能挂起的历史行 Popover，避免 anchor 失效后浮层错位
  useEffect(() => {
    setOpenTask(null);
  }, [expandedDate]);

  const stats = useMemo(() => {
    if (!review) return null;
    return {
      percent:
        review.total_tasks > 0
          ? (review.completed_tasks / review.total_tasks) * 100
          : 0,
      ...review,
    };
  }, [review]);

  // 今日完成清单：所有 completed 任务（含未点过"开始"直接完成的）
  const todayCompleted = useMemo(() => {
    return tasks
      .filter((t) => t.status === "completed")
      .slice()
      .sort((a, b) => {
        const ta = a.completed_at ?? "";
        const tb = b.completed_at ?? "";
        return ta.localeCompare(tb);
      });
  }, [tasks]);

  const barData = useMemo(() => {
    return tasks
      .filter((t) => t.status === "completed" && t.actual_mins)
      .map((t) => ({
        name: t.name.length > 8 ? t.name.slice(0, 8) + "…" : t.name,
        estimated: t.estimated_mins,
        actual: t.actual_mins!,
        overtime: t.actual_mins! > t.estimated_mins,
      }));
  }, [tasks]);

  const hasToday = !!stats && tasks.length > 0;
  const hasHistory = history.some((h) => h.completed > 0);
  const isHit = !!stats && stats.percent >= 100;
  const historyMax = useMemo(
    () => Math.max(1, ...history.map((h) => h.completed)),
    [history]
  );

  const handleOpenDetails = useCallback(
    (task: Task, subs: SubTask[], anchorKey: string) => {
      const el = anchorMap.current.get(anchorKey);
      if (!el) return;
      openAnchorRef.current = el;
      setOpenSubtasks(subs);
      setOpenTask(task);
    },
    []
  );

  const handleToggleDate = useCallback(
    async (date: string) => {
      if (expandedDate === date) {
        setExpandedDate(null);
        setExpandedData(null);
        return;
      }
      setExpandedDate(date);
      setExpandedData(null);
      setExpandedLoading(true);
      try {
        const data = await loadCompletedByDate(date);
        setExpandedData(data);
      } finally {
        setExpandedLoading(false);
      }
    },
    [expandedDate, loadCompletedByDate]
  );

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "26px 28px 32px",
        display: "flex",
        flexDirection: "column",
        gap: 26,
      }}
    >
      {/* 章节刊头 */}
      <SectionMasthead
        variant="review"
        subtitle={
          !hasToday
            ? "今天还没有数据"
            : isHit
              ? "圆满完成了今天的全部任务"
              : "今天走过一半,剩下的明天继续"
        }
      />

      {!hasToday && (
        <div
          style={{
            maxWidth: 260,
            fontSize: 14,
            lineHeight: 1.65,
            color: "var(--ink-500)",
          }}
        >
          完成今天的任务后,这里会出现一份完成度报告。
        </div>
      )}

      {stats && tasks.length > 0 && (<>

      {/* 主数据 —— 大号百分比 */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          padding: "20px 22px",
          background: "var(--paper-0)",
          border: "1px solid var(--rule-line)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-paper-low)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="smallcaps"
            style={{
              marginBottom: 6,
              fontSize: 11,
              color: "var(--ink-500)",
            }}
          >
            完成度
          </div>
          <div
            className="display-number animate-ink"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 72,
              fontWeight: 600,
              color: isHit ? "var(--moss-600)" : "var(--ink-900)",
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
            }}
          >
            {Math.round(stats.percent)}
            <span
              style={{
                fontSize: 28,
                verticalAlign: "top",
                marginLeft: 4,
                color: "var(--vermilion-600)",
                fontWeight: 500,
              }}
            >
              %
            </span>
          </div>
        </div>

        {/* 右侧：小进度环 */}
        <div style={{ flexShrink: 0 }}>
          <ProgressRing
            percent={stats.percent}
            size={72}
            strokeWidth={5}
            color={isHit ? "var(--moss-600)" : "var(--vermilion-600)"}
          />
        </div>
      </div>

      {/* 统计四宫格 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
        }}
      >
        <Stat label="总计" value={stats.total_tasks} />
        <Stat
          label="已完成"
          value={stats.completed_tasks}
          color="var(--moss-600)"
        />
        <Stat
          label="已跳过"
          value={stats.skipped_tasks}
          color="var(--ink-500)"
        />
        <Stat
          label="估 / 实"
          value={`${stats.total_estimated_mins}′/${stats.total_actual_mins}′`}
          color={
            stats.total_actual_mins > stats.total_estimated_mins
              ? "var(--amber-600)"
              : "var(--ink-800)"
          }
          small
        />
      </div>

      {/* 今日完成清单 */}
      {todayCompleted.length > 0 && (
        <CompletedListCard
          title="今日完成"
          count={todayCompleted.length}
          items={todayCompleted.map((t) => ({
            task: t,
            subtasks: todaySubtasks[t.id] ?? [],
          }))}
          anchorPrefix="today"
          anchorMap={anchorMap.current}
          onOpen={handleOpenDetails}
        />
      )}

      {/* 耗时对比柱状图 */}
      {barData.length > 0 && (
        <div
          style={{
            padding: "20px 22px",
            background: "var(--paper-0)",
            border: "1px solid var(--rule-line)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-paper-low)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--ink-900)",
                letterSpacing: "-0.01em",
              }}
            >
              估时 vs 实耗
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--ink-400)",
              }}
            >
              按任务
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {barData.map((d, i) => {
              const maxVal = Math.max(d.estimated, d.actual);
              return (
                <div key={i}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      marginBottom: 5,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--ink-800)",
                        fontWeight: 500,
                      }}
                    >
                      {d.name}
                    </span>
                    <span
                      className="text-mono"
                      style={{
                        fontSize: 11,
                        color: d.overtime
                          ? "var(--amber-600)"
                          : "var(--ink-500)",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {d.actual}′ / {d.estimated}′
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        height: 6,
                        width: `${(d.estimated / maxVal) * 100}%`,
                        minWidth: 6,
                        background: "var(--vermilion-200)",
                        borderRadius: 999,
                      }}
                    />
                    <div
                      style={{
                        height: 6,
                        width: `${(d.actual / maxVal) * 100}%`,
                        minWidth: 6,
                        background: d.overtime
                          ? "var(--amber-600)"
                          : "var(--moss-600)",
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 图例 */}
          <div
            style={{
              display: "flex",
              gap: 16,
              justifyContent: "flex-start",
              marginTop: 16,
              paddingTop: 12,
              borderTop: "1px solid var(--rule-line)",
            }}
          >
            <LegendDot color="var(--vermilion-600)" label="估时" />
            <LegendDot color="var(--moss-600)" label="实耗" />
            <LegendDot color="var(--amber-600)" label="超时" />
          </div>
        </div>
      )}

      </>)}

      {/* 历史完成趋势 —— 支持区间切换，点柱条展开当日清单 */}
      {hasHistory && (
        <div
          style={{
            padding: "20px 22px",
            background: "var(--paper-0)",
            border: "1px solid var(--rule-line)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-paper-low)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 14,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--ink-900)",
                letterSpacing: "-0.01em",
              }}
            >
              近 {historyDays} 天完成
            </span>
            <div
              style={{
                display: "inline-flex",
                background: "var(--paper-1)",
                border: "1px solid var(--rule-line)",
                borderRadius: 999,
                padding: 2,
                gap: 2,
              }}
              role="tablist"
              aria-label="历史区间"
            >
              {HISTORY_WINDOWS.map((d) => {
                const selected = historyDays === d;
                return (
                  <button
                    key={d}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setHistoryDays(d)}
                    className="text-mono"
                    style={{
                      padding: "4px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                      borderRadius: 999,
                      border: "none",
                      cursor: "pointer",
                      background: selected
                        ? "var(--vermilion-600)"
                        : "transparent",
                      color: selected ? "#fff" : "var(--ink-500)",
                      transition: "var(--transition-fast)",
                    }}
                    title={`近 ${d} 天`}
                  >
                    {d}d
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map((h) => {
              const isToday = h.date === dayjsToday();
              const pct = (h.completed / historyMax) * 100;
              const empty = h.completed === 0;
              const isExpanded = expandedDate === h.date;
              const disabled = empty;
              return (
                <div key={h.date}>
                  <button
                    type="button"
                    onClick={() => !disabled && handleToggleDate(h.date)}
                    disabled={disabled}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "46px 1fr 36px",
                      alignItems: "center",
                      gap: 10,
                      width: "100%",
                      padding: "6px 6px",
                      margin: "-6px -6px",
                      border: "none",
                      background: isExpanded
                        ? "var(--accent-primary-softer)"
                        : "transparent",
                      borderRadius: "var(--radius-sm)",
                      cursor: disabled ? "default" : "pointer",
                      transition: "background 160ms ease",
                      textAlign: "left",
                    }}
                    title={disabled ? "当日无完成记录" : "点击查看当日完成项"}
                  >
                    <span
                      className="text-mono"
                      style={{
                        fontSize: 11,
                        color: isToday
                          ? "var(--vermilion-600)"
                          : "var(--ink-500)",
                        letterSpacing: "-0.01em",
                        fontWeight: isToday ? 600 : 400,
                      }}
                    >
                      {h.date.slice(5)}
                    </span>
                    <div
                      style={{
                        position: "relative",
                        height: 6,
                        background: "var(--ink-100)",
                        borderRadius: 999,
                        overflow: "hidden",
                        boxShadow: isExpanded
                          ? "0 0 0 2px var(--accent-primary)"
                          : "none",
                      }}
                    >
                      <div
                        style={{
                          width: empty ? 0 : `${pct}%`,
                          minWidth: empty ? 0 : 4,
                          height: "100%",
                          background: isToday
                            ? "var(--vermilion-600)"
                            : "var(--moss-600)",
                          borderRadius: 999,
                          transition: "width 420ms var(--ease-out-back)",
                        }}
                      />
                      {empty && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            borderTop: "1px dashed var(--ink-200)",
                            top: "50%",
                          }}
                        />
                      )}
                    </div>
                    <span
                      className="text-mono"
                      style={{
                        fontSize: 11,
                        color: empty ? "var(--ink-300)" : "var(--ink-700)",
                        textAlign: "right",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {h.completed}
                    </span>
                  </button>

                  {isExpanded && (
                    <div style={{ marginTop: 10, marginBottom: 6 }}>
                      {expandedLoading && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--ink-400)",
                            padding: "8px 4px",
                          }}
                        >
                          正在加载 {h.date.slice(5)} 的完成项…
                        </div>
                      )}
                      {!expandedLoading && expandedData && (
                        <CompletedListCard
                          title={`${h.date} 完成`}
                          count={expandedData.tasks.length}
                          items={expandedData.tasks.map((t) => ({
                            task: t,
                            subtasks: expandedData.subtasksByTask[t.id] ?? [],
                          }))}
                          anchorPrefix={`d:${h.date}`}
                          anchorMap={anchorMap.current}
                          onOpen={handleOpenDetails}
                          dense
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {openTask && (
        <TaskDetailsPopover
          readOnly
          task={openTask}
          hasSubtasks={openSubtasks.length > 0}
          decomposing={false}
          subtasks={openSubtasks}
          anchorRef={openAnchorRef}
          onUpdate={() => {}}
          onDecompose={() => {}}
          onDelete={() => {}}
          onClose={() => setOpenTask(null)}
        />
      )}
    </div>
  );
}

function CompletedListCard({
  title,
  count,
  items,
  anchorPrefix,
  anchorMap,
  onOpen,
  dense = false,
}: {
  title: string;
  count: number;
  items: Array<{ task: Task; subtasks: SubTask[] }>;
  anchorPrefix: string;
  anchorMap: Map<string, HTMLElement>;
  onOpen: (task: Task, subs: SubTask[], anchorKey: string) => void;
  dense?: boolean;
}) {
  if (items.length === 0) {
    return (
      <div
        style={{
          fontSize: 12,
          color: "var(--ink-400)",
          padding: "8px 4px",
        }}
      >
        当日没有已完成任务
      </div>
    );
  }
  return (
    <div
      style={{
        padding: dense ? "14px 16px" : "20px 22px",
        background: dense ? "var(--paper-1)" : "var(--paper-0)",
        border: "1px solid var(--rule-line)",
        borderRadius: "var(--radius-lg)",
        boxShadow: dense ? "none" : "var(--shadow-paper-low)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: dense ? 10 : 14,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: dense ? 12 : 14,
            fontWeight: 600,
            color: "var(--ink-900)",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </span>
        <span
          className="text-mono"
          style={{ fontSize: 11, color: "var(--ink-400)" }}
        >
          {count} 项
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: dense ? 6 : 10 }}>
        {items.map(({ task, subtasks }) => {
          const cat = categoryLabels[task.category] || categoryLabels.general;
          const completedAt = task.completed_at
            ? dayjs(task.completed_at).format("HH:mm")
            : "—";
          const anchorKey = `${anchorPrefix}:${task.id}`;
          return (
            <button
              key={task.id}
              type="button"
              ref={(el) => {
                if (el) anchorMap.set(anchorKey, el);
                else anchorMap.delete(anchorKey);
              }}
              onClick={() => onOpen(task, subtasks, anchorKey)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: dense ? "8px 10px" : "10px 12px",
                background: dense ? "var(--paper-0)" : "var(--paper-1)",
                border: "1px solid var(--rule-line)",
                borderRadius: "var(--radius-md)",
                width: "100%",
                cursor: "pointer",
                textAlign: "left",
                transition: "var(--transition-fast)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent-primary)";
                e.currentTarget.style.background = "var(--accent-primary-softer)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--rule-line)";
                e.currentTarget.style.background = dense
                  ? "var(--paper-0)"
                  : "var(--paper-1)";
              }}
              title="查看任务详情"
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  background: "var(--moss-100)",
                  color: "var(--moss-600)",
                  flexShrink: 0,
                }}
              >
                <Icon name="check" size="xs" color="var(--moss-600)" />
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 13,
                  color: "var(--ink-800)",
                  textDecoration: "line-through",
                  textDecorationColor: "var(--ink-300)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {task.name}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 10,
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  color: cat.color,
                  background: cat.bg,
                  padding: "2px 8px",
                  borderRadius: 999,
                  flexShrink: 0,
                }}
              >
                <Icon name={cat.icon} size="xs" color={cat.color} />
                {cat.text}
              </span>
              <span
                className="text-mono"
                style={{
                  fontSize: 11,
                  color: "var(--ink-500)",
                  letterSpacing: "-0.01em",
                  flexShrink: 0,
                  width: 40,
                  textAlign: "right",
                }}
              >
                {completedAt}
              </span>
              <span
                className="text-mono"
                style={{
                  fontSize: 11,
                  color:
                    task.actual_mins != null
                      ? "var(--ink-700)"
                      : "var(--ink-300)",
                  letterSpacing: "-0.01em",
                  flexShrink: 0,
                  width: 36,
                  textAlign: "right",
                }}
              >
                {task.actual_mins != null ? `${task.actual_mins}′` : "—"}
              </span>
              <Icon
                name="chevron-right"
                size="xs"
                color="var(--ink-300)"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function dayjsToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function Stat({
  label,
  value,
  color = "var(--ink-800)",
  small = false,
}: {
  label: string;
  value: string | number;
  color?: string;
  small?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "16px 18px",
        background: "var(--paper-0)",
        border: "1px solid var(--rule-line)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-paper-low)",
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: "var(--ink-500)",
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <span
        className="text-mono"
        style={{
          fontSize: small ? 17 : 26,
          fontWeight: 600,
          color,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        color: "var(--ink-500)",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 14,
          height: 3,
          background: color,
          borderRadius: 999,
        }}
      />
      {label}
    </span>
  );
}

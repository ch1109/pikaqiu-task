import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import dayjs from "dayjs";
import type { Task, SubTask } from "@/types/task";
import Icon from "@/components/shared/Icon";
import { categoryLabels } from "@/components/task/taskMeta";
import TaskDetailsPopover from "@/components/task/TaskDetailsPopover";
import { generateReflection, getReflection } from "@/services/review";
import { useTaskStore } from "@/stores/useTaskStore";

interface DailyReviewProps {
  planId: number | null;
  tasks: Task[];
}

type RangeData = {
  tasks: Task[];
  subtasksByTask: Record<number, SubTask[]>;
};

const HISTORY_WINDOWS = [14, 30, 90, 180] as const;
type HistoryDays = (typeof HISTORY_WINDOWS)[number];
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function todayStr() {
  return dayjs().format("YYYY-MM-DD");
}

function formatDateLabel(date: string): string {
  if (date === todayStr()) return "今天";
  if (date === dayjs().subtract(1, "day").format("YYYY-MM-DD")) return "昨天";
  const d = dayjs(date);
  return `${d.month() + 1}月${d.date()}日 ${WEEKDAYS[d.day()]}`;
}

export default function DailyReview({ planId, tasks }: DailyReviewProps) {
  const loadCompletedRange = useTaskStore((s) => s.loadCompletedRange);

  const [historyDays, setHistoryDays] = useState<HistoryDays>(14);
  const [range, setRange] = useState<RangeData>({
    tasks: [],
    subtasksByTask: {},
  });

  // AI 复盘状态
  const [reflection, setReflection] = useState<string | null>(null);
  const [reflectAt, setReflectAt] = useState<string | null>(null);
  const [reflecting, setReflecting] = useState(false);
  const [reflectError, setReflectError] = useState<string | null>(null);

  // 详情 Popover
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [openSubtasks, setOpenSubtasks] = useState<SubTask[]>([]);
  const anchorMap = useRef<Map<string, HTMLElement>>(new Map());
  const openAnchorRef = useRef<HTMLElement | null>(null);

  // 完成轨迹（窗口切换 / 今日任务变化 → 刷新）
  useEffect(() => {
    let alive = true;
    loadCompletedRange(historyDays).then((r) => {
      if (alive) setRange(r);
    });
    return () => {
      alive = false;
    };
  }, [loadCompletedRange, historyDays, tasks]);

  // 今日复盘缓存
  useEffect(() => {
    if (planId == null) {
      setReflection(null);
      setReflectAt(null);
      return;
    }
    let alive = true;
    getReflection(planId).then((r) => {
      if (!alive) return;
      setReflection(r?.text ?? null);
      setReflectAt(r?.at ?? null);
    });
    return () => {
      alive = false;
    };
  }, [planId]);

  // 展开日期变化时关闭可能挂起的 Popover，避免 anchor 失效后浮层错位
  useEffect(() => {
    setOpenTask(null);
  }, [historyDays]);

  const todayCompletedCount = useMemo(
    () => tasks.filter((t) => t.status === "completed").length,
    [tasks]
  );
  const hasTodayTasks = tasks.length > 0;

  const datesWithOutput = useMemo(() => {
    const set = new Set<string>();
    for (const t of range.tasks) {
      if (t.completed_at) set.add(t.completed_at.slice(0, 10));
    }
    return set;
  }, [range]);

  const weekCount = useMemo(() => {
    const weekAgo = dayjs().subtract(6, "day").format("YYYY-MM-DD");
    return range.tasks.filter(
      (t) => (t.completed_at?.slice(0, 10) ?? "") >= weekAgo
    ).length;
  }, [range]);

  // 连续产出天数：从今天往回数；今天还没产出时从昨天起算，不打断连胜
  const streak = useMemo(() => {
    let n = 0;
    let cursor = dayjs();
    if (!datesWithOutput.has(cursor.format("YYYY-MM-DD"))) {
      cursor = cursor.subtract(1, "day");
    }
    while (datesWithOutput.has(cursor.format("YYYY-MM-DD"))) {
      n++;
      cursor = cursor.subtract(1, "day");
    }
    return n;
  }, [datesWithOutput]);

  // 按日期分组（range.tasks 已按 completed_at DESC，首次出现即最新）
  const dayGroups = useMemo(() => {
    const groups: Array<{ date: string; tasks: Task[] }> = [];
    const byDate = new Map<string, Task[]>();
    for (const t of range.tasks) {
      const d = (t.completed_at ?? "").slice(0, 10);
      if (!d) continue;
      let arr = byDate.get(d);
      if (!arr) {
        arr = [];
        byDate.set(d, arr);
        groups.push({ date: d, tasks: arr });
      }
      arr.push(t);
    }
    return groups;
  }, [range]);

  // 打卡墙：窗口内逐日完成数（缺勤日零填充，最早 → 今天）
  const heatCells = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of range.tasks) {
      const d = t.completed_at?.slice(0, 10);
      if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    const start = dayjs().subtract(historyDays - 1, "day");
    const cells: Array<{ date: string; count: number }> = [];
    for (let i = 0; i < historyDays; i++) {
      const d = start.add(i, "day").format("YYYY-MM-DD");
      cells.push({ date: d, count: counts.get(d) ?? 0 });
    }
    return cells;
  }, [range, historyDays]);

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

  const handleReflect = useCallback(async () => {
    if (planId == null || reflecting) return;
    setReflecting(true);
    setReflectError(null);
    try {
      const text = await generateReflection(planId);
      setReflection(text);
      setReflectAt(dayjs().format("YYYY-MM-DD HH:mm:ss"));
    } catch (err) {
      setReflectError(err instanceof Error ? err.message : "复盘生成失败");
    } finally {
      setReflecting(false);
    }
  }, [planId, reflecting]);

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "26px 28px 32px",
        display: "flex",
        flexDirection: "column",
        gap: 22,
      }}
    >
      {/* AI 小结卡片 */}
      <ReflectionCard
        hasTasks={hasTodayTasks}
        completedCount={todayCompletedCount}
        reflection={reflection}
        reflectAt={reflectAt}
        reflecting={reflecting}
        error={reflectError}
        canReflect={planId != null}
        onReflect={handleReflect}
      />

      {/* 打卡统计卡（始终渲染：选择器常驻，无数据时给可爱提示而非裸 0） */}
      <StatsCard
        days={historyDays}
        setDays={setHistoryDays}
        hasData={range.tasks.length > 0}
        streak={streak}
        weekCount={weekCount}
        total={range.tasks.length}
        cells={heatCells}
      />

      {/* 完成轨迹明细（有数据才显示；区间选择器已上移到打卡卡） */}
      {dayGroups.length > 0 && (
        <div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 14,
              fontFamily: "var(--font-display)",
              fontSize: 14,
              fontWeight: 600,
              color: "var(--ink-900)",
              letterSpacing: "-0.01em",
            }}
          >
            <Icon name="scroll-text" size="sm" color="var(--ink-700)" />
            完成轨迹
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {dayGroups.map((g) => (
              <CompletedListCard
                key={g.date}
                title={formatDateLabel(g.date)}
                count={g.tasks.length}
                items={g.tasks.map((t) => ({
                  task: t,
                  subtasks: range.subtasksByTask[t.id] ?? [],
                }))}
                anchorPrefix={`d:${g.date}`}
                anchorMap={anchorMap.current}
                onOpen={handleOpenDetails}
              />
            ))}
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

/* ── AI 复盘卡片 ───────────────────────────────────────── */

const primaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "9px 16px",
  background: "var(--vermilion-600)",
  color: "#fff",
  border: "none",
  borderRadius: "var(--radius-pill)",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "var(--font-display)",
  letterSpacing: "-0.01em",
  cursor: "pointer",
  boxShadow: "var(--shadow-paper-low)",
  transition: "var(--transition-fast)",
};

const ghostBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  marginTop: 12,
  padding: 0,
  background: "transparent",
  color: "var(--ink-500)",
  border: "none",
  fontSize: 11,
  fontWeight: 500,
  cursor: "pointer",
};

function ReflectionCard({
  hasTasks,
  completedCount,
  reflection,
  reflectAt,
  reflecting,
  error,
  canReflect,
  onReflect,
}: {
  hasTasks: boolean;
  completedCount: number;
  reflection: string | null;
  reflectAt: string | null;
  reflecting: boolean;
  error: string | null;
  canReflect: boolean;
  onReflect: () => void;
}) {
  const disabledStyle: React.CSSProperties = reflecting
    ? { opacity: 0.65, cursor: "default" }
    : {};

  return (
    <div
      style={{
        position: "relative",
        padding: "18px 20px",
        background: "var(--paper-0)",
        border: "1px solid var(--rule-line)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-paper-low)",
        overflow: "hidden",
      }}
    >
      {/* 顶部流光条：蓝 → 樱花粉，标记这张卡"是活的" */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background:
            "linear-gradient(90deg, var(--vermilion-600), var(--blush-500))",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <Icon name="sparkles" size="sm" color="var(--vermilion-600)" />
          <span className="smallcaps" style={{ fontSize: 11, color: "var(--ink-700)" }}>
            今日小结
          </span>
        </span>
        {reflection && reflectAt && (
          <span className="text-mono" style={{ fontSize: 10, color: "var(--ink-400)" }}>
            {dayjs(reflectAt).format("HH:mm")} 小结
          </span>
        )}
      </div>

      {!hasTasks ? (
        <div
          style={{
            display: "flex",
            gap: 9,
            alignItems: "flex-start",
            fontSize: 13,
            lineHeight: 1.7,
            color: "var(--ink-500)",
          }}
        >
          <Icon
            name="send-horizontal"
            size="sm"
            color="var(--ink-400)"
            style={{ marginTop: 3 }}
          />
          <span>今天还没有安排任务。双击我打开对话,告诉我你想做点什么吧～</span>
        </div>
      ) : reflection ? (
        <>
          <p
            className="animate-fade-in"
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.75,
              color: "var(--ink-800)",
              whiteSpace: "pre-wrap",
            }}
          >
            {reflection}
          </p>
          <button
            type="button"
            onClick={onReflect}
            disabled={reflecting}
            style={{ ...ghostBtn, ...disabledStyle }}
          >
            <Icon name="refresh-cw" size="xs" color="var(--ink-500)" />
            {reflecting ? "重新生成中…" : "重新回顾"}
          </button>
        </>
      ) : (
        <>
          <p
            style={{
              margin: "0 0 14px",
              fontSize: 13,
              lineHeight: 1.7,
              color: "var(--ink-500)",
            }}
          >
            {completedCount > 0
              ? `今天已经完成 ${completedCount} 项了,让我陪你回顾一下,顺便看看明天怎么安排更顺。`
              : "今天还在进行中。要不要让我陪你看看现在的进度,定一个最容易上手的小目标?"}
          </p>
          <button
            type="button"
            onClick={onReflect}
            disabled={!canReflect || reflecting}
            style={{
              ...primaryBtn,
              ...(!canReflect || reflecting
                ? { opacity: 0.65, cursor: "default" }
                : {}),
            }}
          >
            <Icon name="sparkles" size="sm" color="#fff" />
            {reflecting ? "正在回顾…" : "陪我回顾今天"}
          </button>
        </>
      )}

      {error && (
        <div
          style={{
            marginTop: 12,
            fontSize: 12,
            lineHeight: 1.6,
            color: "var(--seal-red)",
          }}
        >
          小结失败:{error}。请到设置确认对话模型已配置好,再试一次。
        </div>
      )}
    </div>
  );
}

/* ── 完成轨迹：单日完成清单 ────────────────────────────── */

function CompletedListCard({
  title,
  count,
  items,
  anchorPrefix,
  anchorMap,
  onOpen,
}: {
  title: string;
  count: number;
  items: Array<{ task: Task; subtasks: SubTask[] }>;
  anchorPrefix: string;
  anchorMap: Map<string, HTMLElement>;
  onOpen: (task: Task, subs: SubTask[], anchorKey: string) => void;
}) {
  return (
    <div
      style={{
        padding: "18px 20px",
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
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink-900)",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </span>
        <span className="text-mono" style={{ fontSize: 11, color: "var(--ink-400)" }}>
          {count} 项
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                padding: "10px 12px",
                background: "var(--paper-1)",
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
                e.currentTarget.style.background = "var(--paper-1)";
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
              <Icon name="chevron-right" size="xs" color="var(--ink-300)" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── 打卡统计卡：萌系数字 + 打卡墙 ─────────────────────── */

function StatsCard({
  days,
  setDays,
  hasData,
  streak,
  weekCount,
  total,
  cells,
}: {
  days: HistoryDays;
  setDays: (d: HistoryDays) => void;
  hasData: boolean;
  streak: number;
  weekCount: number;
  total: number;
  cells: Array<{ date: string; count: number }>;
}) {
  return (
    <div
      style={{
        padding: "16px 18px 18px",
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
          marginBottom: hasData ? 14 : 12,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontFamily: "var(--font-display)",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--ink-900)",
            letterSpacing: "-0.01em",
          }}
        >
          <Icon name="footprints" size="sm" color="var(--moss-600)" />
          打卡
        </span>
        <WindowSelector days={days} setDays={setDays} />
      </div>

      {hasData ? (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <StatPill
              icon="flame"
              tone="var(--amber-600)"
              bg="var(--amber-100)"
              value={streak}
              label="连续天"
            />
            <StatPill
              icon="check"
              tone="var(--vermilion-600)"
              bg="var(--vermilion-100)"
              value={weekCount}
              label="本周完成"
            />
            <StatPill
              icon="star"
              tone="var(--moss-600)"
              bg="var(--moss-100)"
              value={total}
              label={`近${days}天`}
            />
          </div>
          <Heatmap cells={cells} />
        </>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 9,
            alignItems: "flex-start",
            fontSize: 13,
            lineHeight: 1.7,
            color: "var(--ink-500)",
          }}
        >
          <Icon
            name="footprints"
            size="sm"
            color="var(--ink-400)"
            style={{ marginTop: 3 }}
          />
          <span>近 {days} 天还没有打卡。完成任务,点亮第一格吧～</span>
        </div>
      )}
    </div>
  );
}

function WindowSelector({
  days,
  setDays,
}: {
  days: HistoryDays;
  setDays: (d: HistoryDays) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="回看区间"
      style={{
        display: "inline-flex",
        background: "var(--paper-1)",
        border: "1px solid var(--rule-line)",
        borderRadius: 999,
        padding: 2,
        gap: 2,
      }}
    >
      {HISTORY_WINDOWS.map((d) => {
        const selected = days === d;
        return (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => setDays(d)}
            className="text-mono"
            style={{
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: selected ? "var(--vermilion-600)" : "transparent",
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
  );
}

function StatPill({
  icon,
  tone,
  bg,
  value,
  label,
}: {
  icon: "flame" | "check" | "star";
  tone: string;
  bg: string;
  value: number;
  label: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "10px 11px",
        background: bg,
        borderRadius: "var(--radius-md)",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 26,
          height: 26,
          borderRadius: 999,
          background: "var(--paper-0)",
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size="sm" color={tone} />
      </span>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span
          className="display-number"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 21,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            color: tone,
          }}
        >
          {value}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "var(--ink-500)",
            marginTop: 3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>
      </span>
    </div>
  );
}

/** 完成数 → 绿色强度（越多越深） */
function cellColor(count: number): string {
  if (count <= 0) return "var(--surface-shade)";
  if (count === 1) return "rgba(63,181,143,0.28)";
  if (count === 2) return "rgba(63,181,143,0.5)";
  if (count === 3) return "rgba(63,181,143,0.72)";
  return "var(--moss-600)";
}

function Heatmap({ cells }: { cells: Array<{ date: string; count: number }> }) {
  const today = todayStr();
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {cells.map((c, i) => {
          const isToday = c.date === today;
          const d = dayjs(c.date);
          return (
            <span
              key={c.date}
              className="hm-cell"
              title={`${d.month() + 1}月${d.date()}日 · ${c.count} 项`}
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                flexShrink: 0,
                background: cellColor(c.count),
                boxShadow: isToday ? "0 0 0 2px var(--vermilion-600)" : "none",
                animationDelay: `${Math.min(i, 40) * 10}ms`,
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 6,
          marginTop: 12,
          fontSize: 10,
          color: "var(--ink-400)",
        }}
      >
        <span>少</span>
        {[0, 1, 2, 3, 4].map((n) => (
          <span
            key={n}
            style={{
              width: 11,
              height: 11,
              borderRadius: 3,
              background: cellColor(n),
            }}
          />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}

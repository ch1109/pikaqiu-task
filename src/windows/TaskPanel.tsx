import { useState, useEffect, useCallback, useMemo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import TabBar from "@/components/shared/TabBar";
import TaskList from "@/components/task/TaskList";
import TaskTimeline from "@/components/task/TaskTimeline";
import ConflictAlert from "@/components/task/ConflictAlert";
import ProgressRing from "@/components/shared/ProgressRing";
import { useTaskStore } from "@/stores/useTaskStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { scheduleDay } from "@/services/scheduler";
import { analyzeConflicts } from "@/services/conflictDetector";
import { setupReminders, clearReminders } from "@/services/reminder";

const TABS = [
  { key: "timeline", label: "日程", icon: "⏱" },
  { key: "tasks", label: "任务", icon: "⚡" },
  { key: "review", label: "复盘", icon: "📊" },
];

interface OvertimeAlert {
  subtaskId: number;
  subtaskName: string;
  message: string;
}

export default function TaskPanel() {
  const [activeTab, setActiveTab] = useState("tasks");
  const [overtime, setOvertime] = useState<OvertimeAlert | null>(null);
  const { tasks, subtasks, loading, loadToday, startTask, completeTask, startSubtask, completeSubtask, updateSubtaskStatus } = useTaskStore();
  const { settings, load: loadSettings } = useSettingsStore();

  useEffect(() => {
    loadToday();
    loadSettings();
  }, [loadToday, loadSettings]);

  // 监听 tasks-updated 事件刷新
  useEffect(() => {
    const unlisten = listen("tasks-updated", () => loadToday());
    return () => { unlisten.then((fn) => fn()); };
  }, [loadToday]);

  // 监听超时提醒
  useEffect(() => {
    const unlisten = listen<OvertimeAlert>("reminder", (event) => {
      if (event.payload.message.includes("超时")) {
        setOvertime(event.payload);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // 计算排程
  const schedule = useMemo(() => {
    if (tasks.length === 0 || !settings) return { blocks: [], conflicts: [] };
    return scheduleDay({
      tasks,
      subtasks,
      dependencies: {},
      workStart: settings.work_start,
      workEnd: settings.work_end,
      breakMins: settings.break_mins,
    });
  }, [tasks, subtasks, settings]);

  // 设置提醒定时器
  useEffect(() => {
    if (schedule.blocks.length > 0) {
      setupReminders(schedule.blocks);
    }
    return () => clearReminders();
  }, [schedule.blocks]);

  const conflictSuggestions = useMemo(
    () => analyzeConflicts(schedule.conflicts),
    [schedule.conflicts]
  );

  // 复盘统计
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const skipped = tasks.filter((t) => t.status === "skipped").length;
    const totalEstimated = tasks.reduce((s, t) => s + t.estimated_mins, 0);
    const totalActual = tasks.reduce((s, t) => s + (t.actual_mins || 0), 0);
    const percent = total > 0 ? (completed / total) * 100 : 0;
    return { total, completed, skipped, totalEstimated, totalActual, percent };
  }, [tasks]);

  const handleStartTask = useCallback(async (id: number) => { await startTask(id); }, [startTask]);
  const handleCompleteTask = useCallback(async (id: number) => { await completeTask(id); }, [completeTask]);
  const handleStartSubtask = useCallback(async (id: number) => { await startSubtask(id); }, [startSubtask]);
  const handleCompleteSubtask = useCallback(async (id: number) => { await completeSubtask(id); }, [completeSubtask]);
  const handleSkipSubtask = useCallback(async (id: number) => { await updateSubtaskStatus(id, "skipped"); }, [updateSubtaskStatus]);

  const handleClose = () => getCurrentWindow().close();

  return (
    <div
      className="glass-panel"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 标题栏 */}
      <div
        data-tauri-drag-region
        style={{
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          borderBottom: "1px solid rgba(0, 240, 255, 0.1)",
          cursor: "grab",
          flexShrink: 0,
        }}
      >
        <span
          className="heading-display"
          style={{ fontSize: 13, color: "var(--cyan-glow)", letterSpacing: "0.1em" }}
        >
          CYBERPET // TASKS
        </span>
        <button
          onClick={handleClose}
          style={{
            width: 20,
            height: 20,
            border: "none",
            background: "rgba(255, 60, 172, 0.15)",
            borderRadius: "50%",
            color: "var(--magenta-glow)",
            fontSize: 11,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "var(--transition-fast)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255, 60, 172, 0.35)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 60, 172, 0.15)";
          }}
        >
          ✕
        </button>
      </div>

      {/* Tab 切换 */}
      <TabBar tabs={TABS} activeKey={activeTab} onChange={setActiveTab} />

      {/* 冲突提示 */}
      {activeTab !== "review" && conflictSuggestions.length > 0 && (
        <ConflictAlert items={conflictSuggestions} />
      )}

      {/* 内容区 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {loading && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              fontSize: 12,
            }}
          >
            加载中...
          </div>
        )}

        {!loading && activeTab === "timeline" && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <TaskTimeline
              blocks={schedule.blocks}
              workStart={settings?.work_start || "09:00"}
              workEnd={settings?.work_end || "18:00"}
            />
          </div>
        )}

        {!loading && activeTab === "tasks" && (
          <TaskList
            tasks={tasks}
            subtasks={subtasks}
            schedule={schedule.blocks}
            onStartTask={handleStartTask}
            onCompleteTask={handleCompleteTask}
            onStartSubtask={handleStartSubtask}
            onCompleteSubtask={handleCompleteSubtask}
            onSkipSubtask={handleSkipSubtask}
          />
        )}

        {!loading && activeTab === "review" && (
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
            }}
          >
            {/* 进度环 */}
            <ProgressRing
              percent={stats.percent}
              size={100}
              strokeWidth={6}
              color={stats.percent >= 100 ? "var(--neon-green)" : "var(--cyan-glow)"}
            />

            {/* 统计卡片 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                width: "100%",
                maxWidth: 380,
              }}
            >
              <StatBox label="总任务" value={`${stats.total}`} color="var(--cyan-glow)" />
              <StatBox label="已完成" value={`${stats.completed}`} color="var(--neon-green)" />
              <StatBox label="已跳过" value={`${stats.skipped}`} color="var(--text-muted)" />
              <StatBox
                label="预估/实际"
                value={`${stats.totalEstimated}m / ${stats.totalActual}m`}
                color={
                  stats.totalActual > stats.totalEstimated
                    ? "var(--amber-glow)"
                    : "var(--cyan-glow)"
                }
              />
            </div>

            {stats.total === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 10 }}>
                暂无数据 — 完成任务后查看复盘
              </div>
            )}
          </div>
        )}
      </div>

      {/* 超时弹窗 */}
      {overtime && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(8, 10, 24, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            className="animate-panel-enter"
            style={{
              background: "var(--bg-panel)",
              border: "1px solid rgba(255, 184, 0, 0.3)",
              borderRadius: "var(--radius-lg)",
              padding: "20px 24px",
              maxWidth: 320,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>⏰</div>
            <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>
              {overtime.subtaskName}
            </div>
            <div style={{ fontSize: 11, color: "var(--amber-glow)", marginBottom: 16 }}>
              已超过预估时间的 150%
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                onClick={() => setOvertime(null)}
                style={overtimeBtn("var(--cyan-glow)", "rgba(0, 240, 255, 0.12)")}
              >
                继续
              </button>
              <button
                onClick={async () => {
                  await handleCompleteSubtask(overtime.subtaskId);
                  setOvertime(null);
                }}
                style={overtimeBtn("var(--neon-green)", "rgba(57, 255, 20, 0.12)")}
              >
                完成
              </button>
              <button
                onClick={async () => {
                  await handleSkipSubtask(overtime.subtaskId);
                  setOvertime(null);
                }}
                style={overtimeBtn("var(--text-muted)", "rgba(74, 80, 104, 0.15)")}
              >
                跳过
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function overtimeBtn(color: string, bg: string): React.CSSProperties {
  return {
    padding: "6px 16px",
    border: "none",
    borderRadius: "var(--radius-sm)",
    background: bg,
    color,
    fontSize: 12,
    fontFamily: "var(--font-body)",
    cursor: "pointer",
    transition: "var(--transition-fast)",
  };
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "var(--border-glass)",
        borderRadius: "var(--radius-sm)",
        padding: "10px 12px",
        textAlign: "center",
      }}
    >
      <div
        className="text-mono"
        style={{ fontSize: 18, fontWeight: 600, color }}
      >
        {value}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import WindowTitleBar from "@/components/shared/WindowTitleBar";
import TabBar from "@/components/shared/TabBar";
import TaskList from "@/components/task/TaskList";
import TaskTimeline from "@/components/task/TaskTimeline";
import ConflictAlert from "@/components/task/ConflictAlert";
import DailyReview from "@/components/review/DailyReview";
import ReminderPanel from "@/components/reminder/ReminderPanel";
import { useTaskStore } from "@/stores/useTaskStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { scheduleDay } from "@/services/scheduler";
import { analyzeConflicts } from "@/services/conflictDetector";
import { setupReminders, clearReminders } from "@/services/reminder";
import Icon from "@/components/shared/Icon";

const TABS = [
  { key: "timeline", label: "日程", icon: <Icon name="calendar-days" size="sm" /> },
  { key: "tasks", label: "任务", icon: <Icon name="notebook-pen" size="sm" /> },
  { key: "reminders", label: "提醒", icon: <Icon name="bell-ring" size="sm" /> },
  { key: "review", label: "复盘", icon: <Icon name="book-open-text" size="sm" /> },
];

interface OvertimeAlert {
  subtaskId: number;
  subtaskName: string;
  message: string;
}

export default function TaskPanel() {
  const [activeTab, setActiveTab] = useState("tasks");
  const [overtime, setOvertime] = useState<OvertimeAlert | null>(null);
  const {
    currentPlan,
    tasks,
    subtasks,
    loading,
    loadToday,
    startTask,
    completeTask,
    startSubtask,
    completeSubtask,
    updateSubtaskStatus,
    createPlan,
    addTask,
    deleteTask,
    updateTaskFields,
  } = useTaskStore();
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

  const handleStartTask = useCallback(async (id: number) => { await startTask(id); }, [startTask]);
  const handleCompleteTask = useCallback(async (id: number) => { await completeTask(id); }, [completeTask]);
  const handleStartSubtask = useCallback(async (id: number) => { await startSubtask(id); }, [startSubtask]);
  const handleCompleteSubtask = useCallback(async (id: number) => { await completeSubtask(id); }, [completeSubtask]);
  const handleSkipSubtask = useCallback(async (id: number) => { await updateSubtaskStatus(id, "skipped"); }, [updateSubtaskStatus]);

  const handleQuickAdd = useCallback(
    async (name: string) => {
      let planId = currentPlan?.id;
      if (!planId) {
        const plan = await createPlan("手动录入");
        planId = plan.id;
      }
      await addTask(planId, {
        name,
        priority: 3,
        category: "general",
        estimated_mins: 30,
        sort_order: tasks.length,
      });
    },
    [currentPlan, tasks.length, createPlan, addTask]
  );

  const handleDeleteTask = useCallback(
    async (id: number) => {
      await deleteTask(id);
    },
    [deleteTask]
  );

  const handleRenameTask = useCallback(
    async (id: number, name: string) => {
      await updateTaskFields(id, { name });
    },
    [updateTaskFields]
  );

  const handleUpdateTaskFields = useCallback(
    async (
      id: number,
      fields: Parameters<typeof updateTaskFields>[1]
    ) => {
      await updateTaskFields(id, fields);
    },
    [updateTaskFields]
  );

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
      <div className="stagger-child" style={{ "--stagger-index": 0 } as React.CSSProperties}>
        <WindowTitleBar title="任务" />
      </div>

      {/* Tab 切换 */}
      <div className="stagger-child" style={{ "--stagger-index": 1 } as React.CSSProperties}>
        <TabBar tabs={TABS} activeKey={activeTab} onChange={setActiveTab} />
      </div>

      {/* 冲突提示：仅在 日程/任务 Tab 显示 */}
      {(activeTab === "timeline" || activeTab === "tasks") &&
        conflictSuggestions.length > 0 && (
          <ConflictAlert items={conflictSuggestions} />
        )}

      {/* 内容区 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {loading && (
          <div style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="skeleton-bar" />
            <div className="skeleton-bar" style={{ height: 36 }} />
            <div className="skeleton-bar" style={{ height: 36 }} />
          </div>
        )}

        {!loading && (
          <div key={activeTab} className="animate-tab-content" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {activeTab === "timeline" && (
              <div style={{ flex: 1, overflowY: "auto" }}>
                <TaskTimeline
                  blocks={schedule.blocks}
                  workStart={settings?.work_start || "09:00"}
                  workEnd={settings?.work_end || "18:00"}
                />
              </div>
            )}

            {activeTab === "tasks" && (
              <TaskList
                tasks={tasks}
                subtasks={subtasks}
                schedule={schedule.blocks}
                onStartTask={handleStartTask}
                onCompleteTask={handleCompleteTask}
                onDeleteTask={handleDeleteTask}
                onRenameTask={handleRenameTask}
                onUpdateTaskFields={handleUpdateTaskFields}
                onStartSubtask={handleStartSubtask}
                onCompleteSubtask={handleCompleteSubtask}
                onSkipSubtask={handleSkipSubtask}
                onQuickAdd={handleQuickAdd}
              />
            )}

            {activeTab === "reminders" && <ReminderPanel />}

            {activeTab === "review" && (
              <DailyReview planId={currentPlan?.id ?? null} tasks={tasks} />
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
            background: "rgba(15, 23, 42, 0.22)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            className="animate-panel-enter"
            style={{
              position: "relative",
              background: "var(--paper-0)",
              border: "1px solid var(--rule-line)",
              borderRadius: "var(--radius-lg)",
              padding: "24px 26px 20px",
              width: 340,
              boxShadow: "var(--shadow-paper-lift)",
            }}
          >
            {/* 眉题 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: "var(--amber-200)",
                  color: "var(--amber-600)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="alert-triangle" size="sm" color="var(--amber-600)" />
              </span>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--amber-600)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                超时提醒
              </span>
            </div>

            {/* 标题 */}
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 18,
                fontWeight: 600,
                lineHeight: 1.35,
                letterSpacing: "-0.01em",
                color: "var(--ink-900)",
                marginBottom: 6,
              }}
            >
              {overtime.subtaskName}
            </div>

            {/* 副文 */}
            <p
              style={{
                fontSize: 13,
                lineHeight: 1.65,
                color: "var(--ink-500)",
                marginBottom: 18,
                marginTop: 0,
              }}
            >
              已超过预估时间的{" "}
              <span
                className="text-mono"
                style={{ color: "var(--amber-600)", fontWeight: 600 }}
              >
                150%
              </span>
              {" "}—— 需要调整节奏吗?
            </p>

            {/* 操作行 */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn btn-ghost"
                onClick={() => setOvertime(null)}
                style={{
                  flex: 1,
                  padding: "9px 14px",
                  fontSize: 12,
                  minWidth: 64,
                }}
              >
                继续
              </button>
              <button
                className="btn btn-green"
                onClick={async () => {
                  await handleCompleteSubtask(overtime.subtaskId);
                  setOvertime(null);
                }}
                style={{
                  flex: 1,
                  padding: "9px 14px",
                  fontSize: 12,
                  minWidth: 64,
                }}
              >
                完成
              </button>
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  await handleSkipSubtask(overtime.subtaskId);
                  setOvertime(null);
                }}
                style={{
                  flex: 1,
                  padding: "9px 14px",
                  fontSize: 12,
                  minWidth: 64,
                }}
              >
                跳过
              </button>
              <button
                className="btn btn-amber"
                onClick={async () => {
                  await handleCompleteSubtask(overtime.subtaskId);
                  setOvertime(null);
                  await loadToday();
                }}
                style={{
                  flex: 1,
                  padding: "9px 14px",
                  fontSize: 12,
                  minWidth: 64,
                }}
              >
                调整
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



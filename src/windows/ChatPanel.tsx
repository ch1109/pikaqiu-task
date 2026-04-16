import { useCallback, useEffect } from "react";
import { emit } from "@tauri-apps/api/event";
import WindowTitleBar from "@/components/shared/WindowTitleBar";
import ChatHistory from "@/components/chat/ChatHistory";
import ChatInput from "@/components/chat/ChatInput";
import { useChatStore } from "@/stores/useChatStore";
import { useTaskStore } from "@/stores/useTaskStore";
import { useLLM } from "@/hooks/useLLM";
import { buildTaskExtractMessages } from "@/prompts/taskExtract";
import { buildTaskDecomposeMessages } from "@/prompts/taskDecompose";
import { buildTaskModifyMessages } from "@/prompts/taskModify";
import {
  parseTaskExtractResult,
  parseTaskDecomposeResult,
  parseTaskModifyResult,
} from "@/services/taskParser";

export default function ChatPanel() {
  const { messages, loadAll, addMessage } = useChatStore();
  const {
    currentPlan,
    tasks,
    createPlan,
    addTask,
    addSubtask,
    deleteTask,
    updateTaskFields,
    clearSubtasks,
    loadToday,
  } = useTaskStore();
  const { loading, call } = useLLM();

  useEffect(() => {
    loadAll();
    loadToday();
  }, [loadAll, loadToday]);

  /** 新建任务流程：解析 + 拆解 + 排程 */
  const handleNewTasks = useCallback(
    async (text: string, plan: { id: number }) => {
      const extractMessages = buildTaskExtractMessages(text);
      const extractRaw = await call(extractMessages);

      let extractResult;
      try {
        extractResult = parseTaskExtractResult(extractRaw);
      } catch {
        const retryRaw = await call(extractMessages);
        extractResult = parseTaskExtractResult(retryRaw);
      }

      const taskCount = extractResult.tasks.length;
      if (taskCount === 0) {
        await addMessage(
          "assistant",
          "我没有从你的描述中识别到具体任务。可以更详细地描述一下吗？",
          plan.id
        );
        return;
      }

      const summaryLines: string[] = [];

      for (let i = 0; i < extractResult.tasks.length; i++) {
        const extracted = extractResult.tasks[i];

        const task = await addTask(plan.id, {
          name: extracted.task_name,
          deadline: extracted.deadline,
          priority: extracted.priority,
          category: extracted.category,
          estimated_mins: extracted.estimated_mins,
          sort_order: i,
        });

        const decomposeMessages = buildTaskDecomposeMessages(
          extracted.task_name,
          extracted.estimated_mins,
          extracted.category
        );

        let decomposeResult;
        try {
          const decomposeRaw = await call(decomposeMessages);
          decomposeResult = parseTaskDecomposeResult(decomposeRaw);
        } catch {
          try {
            const retryRaw = await call(decomposeMessages);
            decomposeResult = parseTaskDecomposeResult(retryRaw);
          } catch {
            summaryLines.push(
              `${i + 1}. **${extracted.task_name}** (${extracted.estimated_mins}min) — 子任务拆解失败，已保留主任务`
            );
            continue;
          }
        }

        for (let j = 0; j < decomposeResult.subtasks.length; j++) {
          const sub = decomposeResult.subtasks[j];
          await addSubtask(task.id, {
            name: sub.name,
            description: sub.description,
            estimated_mins: sub.estimated_mins,
            sort_order: j,
          });
        }

        const deadlineStr = extracted.deadline
          ? ` · DDL ${extracted.deadline}`
          : "";
        summaryLines.push(
          `${i + 1}. **${extracted.task_name}**${deadlineStr} — ${decomposeResult.subtasks.length} 个子任务`
        );
        if (decomposeResult.best_approach) {
          summaryLines.push(`   💡 ${decomposeResult.best_approach}`);
        }
      }

      const totalMins = extractResult.tasks.reduce(
        (sum, t) => sum + t.estimated_mins,
        0
      );
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      const timeStr =
        hours > 0
          ? `${hours}h${mins > 0 ? mins + "m" : ""}`
          : `${mins}m`;

      const summary = [
        `已为你规划了 ${taskCount} 个任务，预计总耗时 ${timeStr}：`,
        "",
        ...summaryLines,
        "",
        "打开任务面板查看详细日程，或继续告诉我需要调整的地方~",
      ].join("\n");

      await addMessage("assistant", summary, plan.id);
    },
    [addMessage, call, addTask, addSubtask]
  );

  /** 修改任务流程：判断意图 → 分发操作 */
  const handleModifyTask = useCallback(
    async (text: string, planId: number) => {
      const existingTaskNames = tasks.map((t) => t.name);
      const modifyMessages = buildTaskModifyMessages(text, existingTaskNames);
      const modifyRaw = await call(modifyMessages);
      const modifyResult = parseTaskModifyResult(modifyRaw);

      if (modifyResult.intent === "add") {
        // 新增任务 — 复用新建流程
        const desc =
          modifyResult.new_tasks_description || text;
        await handleNewTasks(desc, { id: planId });
        return;
      }

      // 查找目标任务
      const targetName = modifyResult.target_task;
      const target = tasks.find(
        (t) =>
          t.name === targetName ||
          t.name.includes(targetName || "")
      );

      if (!target) {
        await addMessage(
          "assistant",
          `找不到任务"${targetName}"，当前任务列表：\n${existingTaskNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}`,
          planId
        );
        return;
      }

      if (modifyResult.intent === "delete") {
        await deleteTask(target.id);
        await addMessage(
          "assistant",
          `已删除任务 **${target.name}**，日程已自动更新。`,
          planId
        );
      } else if (modifyResult.intent === "modify") {
        const changes: {
          deadline?: string | null;
          priority?: number;
          estimated_mins?: number;
        } = {};
        if (modifyResult.changes?.deadline !== undefined) {
          changes.deadline = modifyResult.changes.deadline;
        }
        if (modifyResult.changes?.priority) {
          changes.priority = modifyResult.changes.priority;
        }
        if (modifyResult.changes?.estimated_mins) {
          changes.estimated_mins = modifyResult.changes.estimated_mins;
        }
        await updateTaskFields(target.id, changes);
        const changeDesc = Object.entries(changes)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ");
        await addMessage(
          "assistant",
          `已更新 **${target.name}**：${changeDesc}`,
          planId
        );
      } else if (modifyResult.intent === "redecompose") {
        await clearSubtasks(target.id);
        const decomposeMessages = buildTaskDecomposeMessages(
          target.name,
          target.estimated_mins,
          target.category
        );
        let decomposeResult;
        try {
          const raw = await call(decomposeMessages);
          decomposeResult = parseTaskDecomposeResult(raw);
        } catch {
          const retryRaw = await call(decomposeMessages);
          decomposeResult = parseTaskDecomposeResult(retryRaw);
        }

        for (let j = 0; j < decomposeResult.subtasks.length; j++) {
          const sub = decomposeResult.subtasks[j];
          await addSubtask(target.id, {
            name: sub.name,
            description: sub.description,
            estimated_mins: sub.estimated_mins,
            sort_order: j,
          });
        }

        const subNames = decomposeResult.subtasks
          .map((s) => s.name)
          .join("、");
        await addMessage(
          "assistant",
          `已重新拆解 **${target.name}** 为 ${decomposeResult.subtasks.length} 个子任务：${subNames}`,
          planId
        );
      }

      await emit("tasks-updated", {});
    },
    [
      tasks,
      addMessage,
      call,
      handleNewTasks,
      deleteTask,
      updateTaskFields,
      clearSubtasks,
      addSubtask,
    ]
  );

  const handleSend = useCallback(
    async (text: string) => {
      const planId = currentPlan?.id ?? null;
      await addMessage("user", text, planId);

      try {
        await emit("pet-state", { state: "thinking" });

        if (currentPlan && tasks.length > 0) {
          // 已有计划 → 走修改流程
          await handleModifyTask(text, currentPlan.id);
        } else {
          // 无计划 → 走新建流程
          let plan = currentPlan;
          if (!plan) {
            plan = await createPlan(text);
          }
          await handleNewTasks(text, plan);
        }

        await emit("pet-state", { state: "encourage" });
        await emit("tasks-updated", {});
        // idle 回归由 usePetStore TTL 自动处理（encourage=2500ms）
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : "发生了未知错误";
        await addMessage(
          "assistant",
          `抱歉，处理时遇到问题：${errMsg}\n\n请检查 LLM 设置后重试。`,
          planId
        );
        await emit("pet-state", { state: "idle" });
      }
    },
    [
      currentPlan,
      tasks,
      addMessage,
      createPlan,
      handleNewTasks,
      handleModifyTask,
    ]
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
        <WindowTitleBar title="对话" />
      </div>

      {/* 消息区域 */}
      <div className="stagger-child" style={{ "--stagger-index": 1, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" } as React.CSSProperties}>
        <ChatHistory messages={messages} loading={loading} />
      </div>

      {/* 输入区 */}
      <div className="stagger-child" style={{ "--stagger-index": 2 } as React.CSSProperties}>
        <ChatInput
          onSend={handleSend}
          disabled={loading}
          placeholder={
            loading
              ? "正在规划中…"
              : "整段描述今天要做的事，AI 会帮你拆解成清单"
          }
        />
      </div>
    </div>
  );
}

import { useCallback, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit } from "@tauri-apps/api/event";
import ChatHistory from "@/components/chat/ChatHistory";
import ChatInput from "@/components/chat/ChatInput";
import { useChatStore } from "@/stores/useChatStore";
import { useTaskStore } from "@/stores/useTaskStore";
import { useLLM } from "@/hooks/useLLM";
import { buildTaskExtractMessages } from "@/prompts/taskExtract";
import { buildTaskDecomposeMessages } from "@/prompts/taskDecompose";
import {
  parseTaskExtractResult,
  parseTaskDecomposeResult,
} from "@/services/taskParser";

export default function ChatPanel() {
  const { messages, loadAll, addMessage } = useChatStore();
  const { currentPlan, createPlan, addTask, addSubtask, loadToday } =
    useTaskStore();
  const { loading, call } = useLLM();

  useEffect(() => {
    loadAll();
    loadToday();
  }, [loadAll, loadToday]);

  const handleSend = useCallback(
    async (text: string) => {
      const planId = currentPlan?.id ?? null;
      await addMessage("user", text, planId);

      try {
        // 发送桌宠状态变更事件
        await emit("pet-state", { state: "thinking" });

        // 1) 意图解析
        const extractMessages = buildTaskExtractMessages(text);
        const extractRaw = await call(extractMessages);

        let extractResult;
        try {
          extractResult = parseTaskExtractResult(extractRaw);
        } catch {
          // 重试一次
          const retryRaw = await call(extractMessages);
          extractResult = parseTaskExtractResult(retryRaw);
        }

        const taskCount = extractResult.tasks.length;
        if (taskCount === 0) {
          await addMessage(
            "assistant",
            "我没有从你的描述中识别到具体任务。可以更详细地描述一下吗？",
            planId
          );
          await emit("pet-state", { state: "idle" });
          return;
        }

        // 2) 创建/获取今日计划
        let plan = currentPlan;
        if (!plan) {
          plan = await createPlan(text);
        }

        // 3) 逐个创建任务并拆解子任务
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

          // 拆解子任务
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
              // 拆解失败，跳过子任务创建
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
            ? ` ⏰ ${extracted.deadline}`
            : "";
          summaryLines.push(
            `${i + 1}. **${extracted.task_name}**${deadlineStr} → ${decomposeResult.subtasks.length} 个子任务`
          );
        }

        // 4) 生成汇总消息
        const totalMins = extractResult.tasks.reduce(
          (sum, t) => sum + t.estimated_mins,
          0
        );
        const hours = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        const timeStr = hours > 0 ? `${hours}h${mins > 0 ? mins + "m" : ""}` : `${mins}m`;

        const summary = [
          `已为你规划了 ${taskCount} 个任务，预计总耗时 ${timeStr}：`,
          "",
          ...summaryLines,
          "",
          "📋 打开任务面板查看详细日程，或继续告诉我需要调整的地方~",
        ].join("\n");

        await addMessage("assistant", summary, plan.id);

        // 通知桌宠和任务面板刷新
        await emit("pet-state", { state: "encourage" });
        await emit("tasks-updated", {});

        // 2 秒后恢复待机
        setTimeout(() => emit("pet-state", { state: "idle" }), 2000);
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
    [currentPlan, addMessage, call, createPlan, addTask, addSubtask]
  );

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
      {/* 自定义标题栏 */}
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
          style={{
            fontSize: 13,
            color: "var(--cyan-glow)",
            letterSpacing: "0.1em",
          }}
        >
          CYBERPET // CHAT
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

      {/* 消息区域 */}
      <ChatHistory messages={messages} loading={loading} />

      {/* 输入区 */}
      <ChatInput
        onSend={handleSend}
        disabled={loading}
        placeholder={
          loading ? "正在规划中..." : "告诉我你今天要做什么..."
        }
      />
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import WindowTitleBar from "@/components/shared/WindowTitleBar";
import ChatHistory from "@/components/chat/ChatHistory";
import ChatInput from "@/components/chat/ChatInput";
import ChatHistoryDrawer from "@/components/chat/ChatHistoryDrawer";
import PresetBar from "@/components/chat/PresetBar";
import Icon from "@/components/shared/Icon";
import { useChatStore } from "@/stores/useChatStore";
import { useChatSessionStore } from "@/stores/useChatSessionStore";
import { useTaskStore } from "@/stores/useTaskStore";
import { usePresetStore } from "@/stores/usePresetStore";
import { useSkillStore } from "@/stores/useSkillStore";
import { useLLM } from "@/hooks/useLLM";
import { buildChatRouterMessages } from "@/prompts/chatRouter";
import { buildTaskDecomposeMessages } from "@/prompts/taskDecompose";
import { buildSkillMessages } from "@/prompts/skillPrompt";
import { parseSkillInvocation } from "@/services/skillParser";
import { resolveSkillAction } from "@/services/skillRegistry";
import {
  parseRouterResult,
  parseTaskDecomposeResult,
  type ExtractedTask,
  type RouterTaskModifyResult,
} from "@/services/taskParser";

export default function ChatPanel() {
  const { messages, resumeOrStartToday, startNewSession, addMessage } =
    useChatStore();
  const { loadAll: loadSessions } = useChatSessionStore();
  const [historyOpen, setHistoryOpen] = useState(false);
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
  const { loadAll: loadPresets } = usePresetStore();
  const { skills, loadAll: loadSkills, reload: reloadSkills } = useSkillStore();

  useEffect(() => {
    resumeOrStartToday();
    loadToday();
    loadPresets();
    loadSkills();
    loadSessions();
  }, [resumeOrStartToday, loadToday, loadPresets, loadSkills, loadSessions]);

  const handleNewSession = useCallback(async () => {
    await startNewSession();
  }, [startNewSession]);

  // 技能在 SettingsPanel 变更后广播 skills-updated，这里强制刷新
  useEffect(() => {
    const unlisten = listen("skills-updated", () => {
      reloadSkills();
    });
    return () => {
      unlisten.then((fn) => fn()).catch(() => {});
    };
  }, [reloadSkills]);

  /** 构建最近 10 条历史上下文 */
  const getHistory = useCallback(() => {
    return messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-10)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  }, [messages]);

  /** 任务拆解 + 入库流程（接收已解析的 tasks 数组） */
  const handleNewTasks = useCallback(
    async (extractedTasks: ExtractedTask[], plan: { id: number }) => {
      const summaryLines: string[] = [];

      for (let i = 0; i < extractedTasks.length; i++) {
        const extracted = extractedTasks[i];

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

      const totalMins = extractedTasks.reduce(
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
        `已为你规划了 ${extractedTasks.length} 个任务，预计总耗时 ${timeStr}：`,
        "",
        ...summaryLines,
        "",
        "打开任务面板查看详细日程，或继续告诉我需要调整的地方~",
      ].join("\n");

      await addMessage("assistant", summary, plan.id);
    },
    [addMessage, call, addTask, addSubtask]
  );

  /** 任务修改流程（接收已解析的 modify 结果） */
  const handleModifyTask = useCallback(
    async (result: RouterTaskModifyResult, planId: number) => {
      if (result.intent_detail === "add") {
        const desc = result.new_tasks_description || "";
        if (!desc) {
          await addMessage("assistant", "请描述一下要新增的任务内容~", planId);
          return;
        }
        // 新增任务需要重新走路由提取，这里用简单方式：构建消息重新调用
        const routerMessages = buildChatRouterMessages(desc, [], []);
        const raw = await call(routerMessages);
        const parsed = parseRouterResult(raw);
        if (parsed.intent === "task_new") {
          await handleNewTasks(parsed.tasks, { id: planId });
        }
        return;
      }

      const existingTaskNames = tasks.map((t) => t.name);
      const targetName = result.target_task;
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

      if (result.intent_detail === "delete") {
        await deleteTask(target.id);
        await addMessage(
          "assistant",
          `已删除任务 **${target.name}**，日程已自动更新。`,
          planId
        );
      } else if (result.intent_detail === "modify") {
        const changes: {
          deadline?: string | null;
          priority?: number;
          estimated_mins?: number;
        } = {};
        if (result.changes?.deadline !== undefined) {
          changes.deadline = result.changes.deadline;
        }
        if (result.changes?.priority) {
          changes.priority = result.changes.priority;
        }
        if (result.changes?.estimated_mins) {
          changes.estimated_mins = result.changes.estimated_mins;
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
      } else if (result.intent_detail === "redecompose") {
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

      // === Skill 短路分支 ===
      // /name [args] 形式优先匹配已启用技能；未匹配时继续走 chatRouter 默认流程
      const invocation = parseSkillInvocation(text, skills);
      if (invocation) {
        await addMessage("user", text, planId);
        try {
          await emit("pet-state", { state: "thinking" });
          const messages = buildSkillMessages(invocation, {
            tasks,
            history: getHistory(),
          });
          // model override 字段已在 DB 预留，当前 LLMOptions 暂不支持按调用切换，MVP 期忽略
          const reply = await call(messages);

          // 先执行 handler（可能产生副作用并返回替换显示文本，如 skill-creator 的 JSON 不给用户看）
          // 再 addMessage —— 顺序反过来会让用户看到裸 JSON 一闪
          const handler = resolveSkillAction(invocation.skill.action_key);
          let displayReply = reply;
          if (handler) {
            const result = await handler({ invocation, llmReply: reply, planId });
            if (result?.displayReply) displayReply = result.displayReply;
          }
          await addMessage("assistant", displayReply, planId);

          // 未指定 pet_focus 时统一回落到 encourage
          if (invocation.skill.action_key !== "pet_focus") {
            await emit("pet-state", { state: "encourage" });
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "发生了未知错误";
          await addMessage(
            "assistant",
            `执行 /${invocation.skill.name} 时出错：${errMsg}`,
            planId
          );
          await emit("pet-state", { state: "idle" });
        }
        return;
      }

      await addMessage("user", text, planId);

      try {
        await emit("pet-state", { state: "thinking" });

        const history = getHistory();
        const taskNames = tasks.map((t) => t.name);
        const routerMessages = buildChatRouterMessages(text, taskNames, history);
        const routerRaw = await call(routerMessages);

        let routerResult;
        try {
          routerResult = parseRouterResult(routerRaw);
        } catch {
          // 降级：JSON 解析失败时当作普通对话回复
          await addMessage("assistant", routerRaw, planId);
          await emit("pet-state", { state: "encourage" });
          return;
        }

        if (routerResult.intent === "chat") {
          await addMessage("assistant", routerResult.reply, planId);
          await emit("pet-state", { state: "encourage" });
        } else if (routerResult.intent === "task_new") {
          if (routerResult.tasks.length === 0) {
            const reply = routerResult.reply || "我没有从你的描述中识别到具体任务，可以更详细地描述一下吗？";
            await addMessage("assistant", reply, planId);
            await emit("pet-state", { state: "encourage" });
            return;
          }

          let plan = currentPlan;
          if (!plan) {
            plan = await createPlan(text);
          }

          if (routerResult.reply) {
            await addMessage("assistant", routerResult.reply, plan.id);
          }

          await handleNewTasks(routerResult.tasks, plan);
          await emit("pet-state", { state: "encourage" });
          await emit("tasks-updated", {});
        } else if (routerResult.intent === "task_modify") {
          let plan = currentPlan;
          if (!plan) {
            plan = await createPlan(text);
          }

          if (routerResult.reply) {
            await addMessage("assistant", routerResult.reply, plan.id);
          }

          await handleModifyTask(routerResult, plan.id);
          await emit("pet-state", { state: "encourage" });
        }
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : "发生了未知错误";
        await addMessage(
          "assistant",
          `抱歉，处理时遇到问题：${errMsg}\n\n请检查 AI 模型设置后重试。`,
          planId
        );
        await emit("pet-state", { state: "idle" });
      }
    },
    [
      currentPlan,
      tasks,
      skills,
      messages,
      addMessage,
      createPlan,
      getHistory,
      call,
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
        position: "relative",
      }}
    >
      <div className="stagger-child" style={{ "--stagger-index": 0 } as React.CSSProperties}>
        <WindowTitleBar
          title="对话"
          rightActions={
            <>
              <button
                data-tauri-drag-region="false"
                className="btn btn-icon"
                onClick={handleNewSession}
                title="新对话"
                style={{ width: 28, height: 28 }}
              >
                <Icon name="plus" size={16} />
              </button>
              <button
                data-tauri-drag-region="false"
                className="btn btn-icon"
                onClick={() => setHistoryOpen(true)}
                title="历史会话"
                style={{ width: 28, height: 28 }}
              >
                <Icon name="scroll-text" size={16} />
              </button>
            </>
          }
        />
      </div>

      {/* 消息区域 */}
      <div className="stagger-child" style={{ "--stagger-index": 1, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" } as React.CSSProperties}>
        <ChatHistory messages={messages} loading={loading} />
      </div>

      {/* 预设 + 输入区 */}
      <div className="stagger-child" style={{ "--stagger-index": 2 } as React.CSSProperties}>
        <PresetBar />
        <ChatInput
          onSend={handleSend}
          disabled={loading}
          placeholder={
            loading
              ? "思考中…"
              : "问我任何问题，或描述今天的任务…"
          }
        />
      </div>

      {/* 历史会话抽屉（absolute 嵌入，不是独立 Tauri 窗口） */}
      <ChatHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}

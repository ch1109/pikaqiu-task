import { useCallback, useState } from "react";
import { useLLM } from "./useLLM";
import { useTaskStore } from "@/stores/useTaskStore";
import { buildTaskDecomposeMessages } from "@/prompts/taskDecompose";
import { parseTaskDecomposeResult } from "@/services/taskParser";
import type { Task } from "@/types/task";

interface UseTaskDecomposeReturn {
  loading: boolean;
  error: string | null;
  decompose: () => Promise<void>;
}

/**
 * 为单个任务调用 LLM 生成子任务并写入数据库，
 * 若已有子任务会先清空再重建。
 */
export function useTaskDecompose(task: Task): UseTaskDecomposeReturn {
  const { call } = useLLM();
  const clearSubtasks = useTaskStore((s) => s.clearSubtasks);
  const addSubtask = useTaskStore((s) => s.addSubtask);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decompose = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const messages = buildTaskDecomposeMessages(
        task.name,
        task.estimated_mins,
        task.category
      );

      let result;
      try {
        const raw = await call(messages);
        result = parseTaskDecomposeResult(raw);
      } catch {
        // 失败重试一次
        const retry = await call(messages);
        result = parseTaskDecomposeResult(retry);
      }

      await clearSubtasks(task.id);
      for (let i = 0; i < result.subtasks.length; i++) {
        const sub = result.subtasks[i];
        await addSubtask(task.id, {
          name: sub.name,
          description: sub.description,
          estimated_mins: sub.estimated_mins,
          sort_order: i,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "拆解失败";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [task.id, task.name, task.estimated_mins, task.category, call, clearSubtasks, addSubtask]);

  return { loading, error, decompose };
}

import { useState, useCallback } from "react";
import { chatWithLLM } from "@/services/llm";
import type { ChatMessage, LLMOptions } from "@/services/llm/types";

interface UseLLMReturn {
  loading: boolean;
  error: string | null;
  call: (messages: ChatMessage[], options?: LLMOptions) => Promise<string>;
  reset: () => void;
}

export function useLLM(): UseLLMReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(
    async (messages: ChatMessage[], options?: LLMOptions): Promise<string> => {
      setLoading(true);
      setError(null);
      try {
        const result = await chatWithLLM(messages, options);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "LLM 调用失败";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  return { loading, error, call, reset };
}

import { useState, useEffect, useRef, useCallback } from "react";

interface UseTaskTimerReturn {
  elapsedSecs: number;
  isRunning: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useTaskTimer(startedAt?: string | null): UseTaskTimerReturn {
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 从 startedAt 恢复计时
  useEffect(() => {
    if (startedAt) {
      const startTime = new Date(startedAt).getTime();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedSecs(Math.max(0, elapsed));
      setIsRunning(true);
    }
  }, [startedAt]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedSecs((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const start = useCallback(() => setIsRunning(true), []);
  const stop = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(() => {
    setIsRunning(false);
    setElapsedSecs(0);
  }, []);

  return { elapsedSecs, isRunning, start, stop, reset };
}

export function formatElapsed(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

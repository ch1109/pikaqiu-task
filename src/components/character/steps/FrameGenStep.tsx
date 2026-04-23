import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import Icon from "@/components/shared/Icon";
import { useCharacterDraftStore } from "@/stores/useCharacterDraftStore";
import {
  applyChromaKey,
  b64ToDataUrl,
  generateActionFrames,
  regenerateSingleFrame,
} from "@/services/characterGenerator";
import type { ActionSpec } from "@/types/character";
import WizardFooter from "../WizardFooter";

type FramesMap = Record<string, string[]>;

/**
 * Step 4：逐动作帧生成。
 * - 串行跑动作，每帧生成后立即色键抠图 → 累计到 state
 * - 支持暂停（flag）+ 单帧重试（新 seed）
 * - 每 N 帧 flush 一次到 draft（防止中断丢失）
 */
export default function FrameGenStep() {
  const { draft, updatePayload, setStep } = useCharacterDraftStore();
  const actions = draft?.payload.actions ?? [];
  const baseB64 = draft?.payload.base_image_b64 ?? "";
  const baseSeed = useMemo(
    () =>
      draft?.payload.base_image_seed ?? Math.floor(Math.random() * 1_000_000),
    [draft?.id, draft?.payload.base_image_seed]
  );

  const [frames, setFrames] = useState<FramesMap>(
    () => draft?.payload.frames ?? {}
  );

  // 若从 Step 3 返回后 payload.frames 被清理需要同步
  useEffect(() => {
    const storeFrames = draft?.payload.frames ?? {};
    const storeKeys = Object.keys(storeFrames);
    const localKeys = Object.keys(frames);
    if (storeKeys.length !== localKeys.length) {
      setFrames(storeFrames);
    }
    // 仅在草稿 id 变化或 action 数量变化时同步
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id, actions.length]);
  const [currentAction, setCurrentAction] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const pauseRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const allDone = useMemo(
    () =>
      actions.length > 0 &&
      actions.every((a) => (frames[a.action_name]?.length ?? 0) >= a.frame_count),
    [actions, frames]
  );

  const runAllActions = useCallback(async () => {
    if (!draft || !baseB64) return;
    setRunning(true);
    pauseRef.current = false;
    setError(null);
    try {
      for (const action of actions) {
        if (pauseRef.current) break;
        const existing = frames[action.action_name] ?? [];
        if (existing.length >= action.frame_count) continue;

        setCurrentAction(action.action_name);

        const collected: string[] = [...existing];
        await generateActionFrames({
          draftId: draft.id,
          characterDescription:
            draft.payload.refined_prompt || draft.payload.description,
          baseB64,
          baseSeed,
          action: { ...action, frame_count: action.frame_count - existing.length },
          onFrame: async (_, b64) => {
            // 抠图后再存
            const cutout = await applyChromaKey(b64, {
              tolerance: 45,
              featherPx: 1,
              despill: true,
            });
            collected.push(cutout);
            const next = { ...frames, [action.action_name]: [...collected] };
            setFrames(next);
            await updatePayload({ frames: next });
            if (pauseRef.current) throw new Error("用户暂停");
          },
        });
      }
    } catch (e) {
      if (!(e instanceof Error && e.message === "用户暂停")) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setCurrentAction(null);
      setRunning(false);
    }
  }, [draft, actions, baseB64, baseSeed, frames, updatePayload]);

  const handlePause = useCallback(() => {
    pauseRef.current = true;
  }, []);

  const retryFrame = useCallback(
    async (action: ActionSpec, idx: number) => {
      if (!draft) return;
      try {
        const res = await regenerateSingleFrame({
          characterDescription:
            draft.payload.refined_prompt || draft.payload.description,
          baseB64,
          action,
          frameIndex: idx,
          seed: Math.floor(Math.random() * 1_000_000),
        });
        if (!res) return;
        const cutout = await applyChromaKey(res.b64, {
          tolerance: 45,
          featherPx: 1,
          despill: true,
        });
        const arr = [...(frames[action.action_name] ?? [])];
        arr[idx] = cutout;
        const next = { ...frames, [action.action_name]: arr };
        setFrames(next);
        await updatePayload({ frames: next });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [draft, baseB64, frames, updatePayload]
  );

  const handleNext = useCallback(async () => {
    await updatePayload({ frames });
    await setStep(5);
  }, [frames, updatePayload, setStep]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          padding: 12,
          background: "var(--paper-0)",
          borderRadius: 12,
          border: "1px solid var(--rule-line)",
        }}
      >
        {!running ? (
          <button
            className="btn btn-cyan"
            onClick={runAllActions}
            disabled={!baseB64 || allDone}
            style={{ fontSize: 13 }}
          >
            <Icon name="play" size="xs" style={{ marginRight: 6 }} />
            {allDone ? "全部已完成" : "开始批量生成"}
          </button>
        ) : (
          <button
            className="btn btn-amber"
            onClick={handlePause}
            style={{ fontSize: 13 }}
          >
            <Icon name="pause" size="xs" style={{ marginRight: 6 }} />
            暂停（下一帧结束后停止）
          </button>
        )}
        <div
          style={{
            fontSize: 11,
            color: "var(--ink-500)",
            flex: 1,
          }}
        >
          {currentAction
            ? `正在生成：${currentAction}`
            : running
            ? "准备中…"
            : allDone
            ? "所有动作帧已完成"
            : "点击开始后会串行生成每个动作的全部帧"}
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: 10,
            borderRadius: 10,
            background: "rgba(220,38,38,0.08)",
            color: "var(--seal-red)",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {actions.map((a) => {
          const list = frames[a.action_name] ?? [];
          const progress = `${list.length}/${a.frame_count}`;
          return (
            <div
              key={a.action_name}
              style={{
                border: "1px solid var(--rule-line)",
                borderRadius: 12,
                padding: 12,
                background: "var(--paper-0)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--ink-900)",
                  }}
                >
                  {a.action_name}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color:
                      list.length >= a.frame_count
                        ? "var(--moss-600)"
                        : "var(--ink-500)",
                  }}
                >
                  {progress}
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${Math.min(
                    a.frame_count,
                    8
                  )}, 1fr)`,
                  gap: 6,
                }}
              >
                {Array.from({ length: a.frame_count }).map((_, i) => {
                  const b64 = list[i];
                  return (
                    <div
                      key={i}
                      onClick={() => b64 && retryFrame(a, i)}
                      title={b64 ? "点击重新生成该帧" : "待生成"}
                      style={{
                        aspectRatio: "1 / 1",
                        borderRadius: 8,
                        border: "1px solid var(--rule-line)",
                        background:
                          "conic-gradient(var(--ink-100) 0 25%, var(--paper-0) 0 50%, var(--ink-100) 0 75%, var(--paper-0) 0) 0 0 / 10px 10px",
                        overflow: "hidden",
                        cursor: b64 ? "pointer" : "default",
                        display: "grid",
                        placeItems: "center",
                        position: "relative",
                      }}
                    >
                      {b64 ? (
                        <img
                          src={b64ToDataUrl(b64)}
                          alt={`frame ${i}`}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                          }}
                        />
                      ) : (
                        <span
                          style={{ fontSize: 10, color: "var(--ink-300)" }}
                        >
                          {i + 1}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <WizardFooter
        rightLabel="下一步：预览"
        rightDisabled={!allDone}
        onRight={handleNext}
      />
    </div>
  );
}

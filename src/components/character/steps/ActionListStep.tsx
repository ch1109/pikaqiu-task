import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "@/components/shared/Icon";
import { useCharacterDraftStore } from "@/stores/useCharacterDraftStore";
import {
  CORE_ACTION_BINDINGS,
  type ActionSpec,
  type LoopMode,
} from "@/types/character";
import WizardFooter from "../WizardFooter";
import CostEstimator from "../CostEstimator";

const DEFAULT_FPS = 8;
const DEFAULT_FRAMES = 6;

/**
 * Step 3：动作清单。
 * - 7 个核心动作默认勾选，每个可调 prompt_delta / frame_count / fps / loop_mode
 * - 支持增加完全自定义动作（不绑定 PetState）
 */
export default function ActionListStep() {
  const { draft, updatePayload, setStep } = useCharacterDraftStore();

  const initial = useMemo<ActionSpec[]>(() => {
    if (draft?.payload.actions && draft.payload.actions.length > 0) {
      return draft.payload.actions;
    }
    // 默认：全部核心动作勾选
    return CORE_ACTION_BINDINGS.map((b) => ({
      action_name: b.state,
      pet_state_binding: b.state,
      prompt_delta: b.default_prompt,
      frame_count: DEFAULT_FRAMES,
      fps: DEFAULT_FPS,
      loop_mode: b.state === "celebrating" ? "once" : "loop",
    }));
  }, [draft?.id]);

  const [actions, setActions] = useState<ActionSpec[]>(initial);
  const [newActionName, setNewActionName] = useState("");

  useEffect(() => {
    setActions(initial);
  }, [initial]);

  const coreNames = new Set(CORE_ACTION_BINDINGS.map((b) => b.state as string));

  const toggleCore = useCallback(
    (stateName: string) => {
      setActions((prev) => {
        const exists = prev.some((a) => a.action_name === stateName);
        if (exists) return prev.filter((a) => a.action_name !== stateName);
        const binding = CORE_ACTION_BINDINGS.find(
          (b) => b.state === stateName
        );
        if (!binding) return prev;
        const spec: ActionSpec = {
          action_name: binding.state,
          pet_state_binding: binding.state,
          prompt_delta: binding.default_prompt,
          frame_count: DEFAULT_FRAMES,
          fps: DEFAULT_FPS,
          loop_mode: binding.state === "celebrating" ? "once" : "loop",
        };
        return [...prev, spec];
      });
    },
    []
  );

  const updateAction = useCallback(
    (idx: number, patch: Partial<ActionSpec>) => {
      setActions((prev) =>
        prev.map((a, i) => (i === idx ? { ...a, ...patch } : a))
      );
    },
    []
  );

  const removeAction = useCallback(
    (idx: number) => {
      setActions((prev) => prev.filter((_, i) => i !== idx));
    },
    []
  );

  const addCustom = useCallback(() => {
    const n = newActionName.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!n) return;
    if (actions.some((a) => a.action_name === n)) return;
    setActions((prev) => [
      ...prev,
      {
        action_name: n,
        pet_state_binding: null,
        prompt_delta: "",
        frame_count: DEFAULT_FRAMES,
        fps: DEFAULT_FPS,
        loop_mode: "loop",
      },
    ]);
    setNewActionName("");
  }, [newActionName, actions]);

  const canNext = actions.length > 0 && actions.every((a) => a.prompt_delta.trim());

  const handleNext = useCallback(async () => {
    await updatePayload({ actions });
    await setStep(4);
  }, [actions, updatePayload, setStep]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          fontSize: 12,
          color: "var(--ink-500)",
          padding: "10px 12px",
          background: "var(--paper-3)",
          borderRadius: 10,
        }}
      >
        勾选要生成的动作，每个动作会基于基准图做 img2img，生成一组序列帧用于播放。
      </div>

      {/* 核心动作勾选 */}
      <div>
        <div
          style={{
            fontSize: 11,
            color: "var(--ink-500)",
            fontWeight: 500,
            marginBottom: 8,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          核心动作（绑定桌宠状态）
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 8,
          }}
        >
          {CORE_ACTION_BINDINGS.map((b) => {
            const checked = actions.some((a) => a.action_name === b.state);
            return (
              <button
                key={b.state}
                onClick={() => toggleCore(b.state)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: checked
                    ? "1.5px solid var(--vermilion-600)"
                    : "1px solid var(--rule-line-strong)",
                  background: checked ? "var(--vermilion-100)" : "var(--paper-0)",
                  color: checked ? "var(--vermilion-600)" : "var(--ink-700)",
                  fontSize: 12,
                  fontWeight: checked ? 600 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 140ms ease",
                }}
              >
                {checked ? (
                  <Icon name="check" size="xs" />
                ) : (
                  <Icon name="circle" size="xs" />
                )}
                {b.state}
              </button>
            );
          })}
        </div>
      </div>

      {/* 已选动作详情 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {actions.map((a, i) => {
          const isCustom = !coreNames.has(a.action_name);
          return (
            <div
              key={a.action_name}
              style={{
                border: "1px solid var(--rule-line)",
                borderRadius: 12,
                padding: 12,
                background: "var(--paper-0)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
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
                {isCustom && (
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--vermilion-600)",
                      background: "var(--vermilion-100)",
                      padding: "1px 6px",
                      borderRadius: 999,
                    }}
                  >
                    自定义
                  </span>
                )}
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => removeAction(i)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--ink-400)",
                    cursor: "pointer",
                    padding: 4,
                  }}
                  title="移除动作"
                >
                  <Icon name="trash-2" size="sm" />
                </button>
              </div>
              <textarea
                value={a.prompt_delta}
                onChange={(e) => updateAction(i, { prompt_delta: e.target.value })}
                placeholder="动作描述（英文更稳），如：waving one hand, smiling brightly"
                rows={2}
                style={{
                  padding: "8px 10px",
                  fontSize: 12,
                  border: "1px solid var(--rule-line)",
                  borderRadius: 8,
                  resize: "vertical",
                  minHeight: 52,
                  background: "var(--paper-1)",
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <NumField
                  label="帧数"
                  value={a.frame_count}
                  min={1}
                  max={24}
                  onChange={(v) => updateAction(i, { frame_count: v })}
                />
                <NumField
                  label="FPS"
                  value={a.fps}
                  min={1}
                  max={30}
                  onChange={(v) => updateAction(i, { fps: v })}
                />
                <LoopSelect
                  value={a.loop_mode}
                  onChange={(v) => updateAction(i, { loop_mode: v })}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 添加自定义 */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          padding: 10,
          border: "1px dashed var(--rule-line-strong)",
          borderRadius: 12,
          background: "transparent",
        }}
      >
        <input
          value={newActionName}
          onChange={(e) => setNewActionName(e.target.value)}
          placeholder="自定义动作名（英文/数字/下划线）"
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--rule-line)",
            fontSize: 12,
            background: "var(--paper-0)",
            outline: "none",
          }}
        />
        <button
          className="btn btn-ghost"
          onClick={addCustom}
          disabled={!newActionName.trim()}
          style={{ padding: "8px 12px", fontSize: 12 }}
        >
          <Icon name="plus" size="xs" style={{ marginRight: 4 }} />
          添加
        </button>
      </div>

      <CostEstimator actions={actions} />

      <WizardFooter
        rightLabel="下一步：开始生成帧"
        rightDisabled={!canNext}
        onRight={handleNext}
      />
    </div>
  );
}

function NumField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: "var(--ink-600)",
      }}
    >
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) =>
          onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))
        }
        style={{
          width: 56,
          padding: "4px 8px",
          borderRadius: 6,
          border: "1px solid var(--rule-line-strong)",
          fontSize: 12,
          background: "var(--paper-0)",
          outline: "none",
        }}
      />
    </label>
  );
}

function LoopSelect({
  value,
  onChange,
}: {
  value: LoopMode;
  onChange: (v: LoopMode) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: "var(--ink-600)",
      }}
    >
      循环
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as LoopMode)}
        style={{
          padding: "4px 8px",
          borderRadius: 6,
          border: "1px solid var(--rule-line-strong)",
          fontSize: 12,
          background: "var(--paper-0)",
          outline: "none",
        }}
      >
        <option value="loop">loop</option>
        <option value="once">once</option>
        <option value="pingpong">pingpong</option>
      </select>
    </label>
  );
}

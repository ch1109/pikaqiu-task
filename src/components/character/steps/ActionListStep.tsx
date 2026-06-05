import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Icon from "@/components/shared/Icon";
import { useCharacterDraftStore } from "@/stores/useCharacterDraftStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import {
  CORE_ACTION_BINDINGS,
  type ActionSpec,
  type LoopMode,
} from "@/types/character";
import type { VideoGenProviderName } from "@/types/settings";
import {
  ACTION_CATALOG,
  UNCOVERED_STATES,
  type ActionMeta,
} from "@/services/actionCatalog";
import {
  VIDEO_PROVIDER_CATALOG,
  VIDEO_PROVIDER_ORDER,
  videoProviderMeta,
} from "@/services/video/providerCatalog";
import WizardFooter from "../WizardFooter";
import CostEstimator from "../CostEstimator";

const DEFAULT_FPS = 8;
const DEFAULT_FRAMES = 6;

/**
 * Step 3:动作包(Action Pack)。
 * - Hero 区: 动作包概念 + PetState 覆盖率
 * - 视频供应商横幅: 内嵌下拉直切 settings.video_gen_provider
 * - 7 个核心动作以可展开卡片呈现(中文名 + 场景 + 各项参数)
 * - 自定义动作仍保留(不绑定 PetState)
 */
export default function ActionListStep() {
  const { draft, updatePayload, setStep } = useCharacterDraftStore();

  const initial = useMemo<ActionSpec[]>(() => {
    if (draft?.payload.actions && draft.payload.actions.length > 0) {
      return draft.payload.actions;
    }
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setActions(initial);
  }, [initial]);

  const coreNames = new Set(CORE_ACTION_BINDINGS.map((b) => b.state as string));

  const toggleCore = useCallback((stateName: string) => {
    setActions((prev) => {
      const exists = prev.some((a) => a.action_name === stateName);
      if (exists) return prev.filter((a) => a.action_name !== stateName);
      const binding = CORE_ACTION_BINDINGS.find((b) => b.state === stateName);
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
  }, []);

  const updateAction = useCallback(
    (idx: number, patch: Partial<ActionSpec>) => {
      setActions((prev) =>
        prev.map((a, i) => (i === idx ? { ...a, ...patch } : a))
      );
    },
    []
  );

  const removeAction = useCallback((idx: number) => {
    setActions((prev) => prev.filter((_, i) => i !== idx));
  }, []);

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
    setExpanded((prev) => ({ ...prev, [n]: true }));
    setNewActionName("");
  }, [newActionName, actions]);

  const canNext =
    actions.length > 0 && actions.every((a) => a.prompt_delta.trim());

  const handleNext = useCallback(async () => {
    await updatePayload({ actions });
    await setStep(4);
  }, [actions, updatePayload, setStep]);

  const enabledCoreCount = actions.filter((a) =>
    coreNames.has(a.action_name)
  ).length;
  const totalPetStates = ACTION_CATALOG.length + UNCOVERED_STATES.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Hero 区:动作包概念 */}
      <ActionPackHero
        enabledCount={enabledCoreCount}
        totalCore={ACTION_CATALOG.length}
        totalPetStates={totalPetStates}
        uncovered={UNCOVERED_STATES}
      />

      {/* 视频供应商横幅:内嵌下拉切换 */}
      <VideoProviderBanner actions={actions} />

      {/* 核心动作卡片 */}
      <div>
        <SectionLabel>核心动作 · 绑定桌宠状态</SectionLabel>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 8,
          }}
        >
          {ACTION_CATALOG.map((meta, idx) => {
            const action = actions.find((a) => a.action_name === meta.state);
            const checked = !!action;
            const open = !!expanded[meta.state];
            const actionIdx = action
              ? actions.findIndex((a) => a.action_name === meta.state)
              : -1;
            return (
              <CoreActionCard
                key={meta.state}
                meta={meta}
                checked={checked}
                expanded={open}
                action={action}
                staggerDelay={idx * 40}
                onToggle={() => toggleCore(meta.state)}
                onExpand={() =>
                  setExpanded((prev) => ({
                    ...prev,
                    [meta.state]: !prev[meta.state],
                  }))
                }
                onUpdate={(patch) =>
                  actionIdx >= 0 && updateAction(actionIdx, patch)
                }
              />
            );
          })}
        </div>
      </div>

      {/* 自定义动作 */}
      {actions.some((a) => !coreNames.has(a.action_name)) && (
        <div>
          <SectionLabel>自定义动作</SectionLabel>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 8,
            }}
          >
            {actions.map((a, i) => {
              if (coreNames.has(a.action_name)) return null;
              return (
                <CustomActionCard
                  key={a.action_name}
                  action={a}
                  onUpdate={(patch) => updateAction(i, patch)}
                  onRemove={() => removeAction(i)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* 添加自定义 */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          padding: 10,
          border: "1px dashed var(--rule-line-strong)",
          borderRadius: 12,
        }}
      >
        <Icon name="plus" size="sm" style={{ color: "var(--ink-400)" }} />
        <input
          value={newActionName}
          onChange={(e) => setNewActionName(e.target.value)}
          placeholder="自定义动作名(英文/数字/下划线),不绑定 PetState"
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid var(--rule-line)",
            fontSize: 12,
            background: "var(--paper-0)",
            outline: "none",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") addCustom();
          }}
        />
        <button
          className="btn btn-ghost"
          onClick={addCustom}
          disabled={!newActionName.trim()}
          style={{ padding: "6px 12px", fontSize: 12 }}
        >
          添加
        </button>
      </div>

      <CostEstimator actions={actions} />

      <WizardFooter
        rightLabel="下一步:开始生成帧"
        rightDisabled={!canNext}
        onRight={handleNext}
      />
    </div>
  );
}

/* ─────────────── Hero ─────────────── */

function ActionPackHero({
  enabledCount,
  totalCore,
  totalPetStates,
  uncovered,
}: {
  enabledCount: number;
  totalCore: number;
  totalPetStates: number;
  uncovered: { state: string; zhName: string }[];
}) {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 14,
        background:
          "linear-gradient(135deg, var(--paper-0) 0%, var(--vermilion-100) 220%)",
        border: "1px solid var(--rule-line)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 22 }}>🎭</span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 16,
            fontWeight: 700,
            color: "var(--ink-900)",
            letterSpacing: "-0.01em",
          }}
        >
          动作包 · {enabledCount}/{totalCore} 个核心动作
        </span>
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--ink-500)",
          lineHeight: 1.6,
          marginBottom: 10,
        }}
      >
        为你的桌宠生成一套覆盖日常状态的连贯动作。每个动作绑定一个桌宠状态,触发时自动播放对应序列帧或视频。
      </div>
      <div
        style={{
          display: "flex",
          gap: 14,
          paddingTop: 10,
          borderTop: "1px dashed var(--rule-line)",
          fontSize: 11,
          color: "var(--ink-600)",
          flexWrap: "wrap",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Icon
            name="check"
            size="xs"
            style={{ color: "var(--moss-600)" }}
            accent
          />
          已覆盖 {totalCore}/{totalPetStates} 个 PetState
        </span>
        {uncovered.length > 0 && (
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <span style={{ color: "var(--ink-400)" }}>·</span>
            未覆盖:
            {uncovered.map((u, i) => (
              <span
                key={u.state}
                style={{
                  padding: "1px 6px",
                  borderRadius: 999,
                  background: "var(--ink-100)",
                  color: "var(--ink-500)",
                  fontSize: 10,
                  marginLeft: i === 0 ? 0 : 4,
                }}
                title={`PetState: ${u.state}`}
              >
                {u.zhName}
              </span>
            ))}
            <span
              style={{
                color: "var(--ink-400)",
                fontSize: 10,
                marginLeft: 4,
              }}
            >
              (回退到 idle)
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

/* ─────────────── 视频供应商横幅 ─────────────── */

function VideoProviderBanner({ actions }: { actions: ActionSpec[] }) {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [open, setOpen] = useState(false);

  const provider: VideoGenProviderName = settings?.video_gen_provider ?? "gemini";
  const meta = videoProviderMeta(provider);
  const hasKey =
    provider === "comfyui" || (settings?.video_gen_api_key.trim().length ?? 0) > 0;

  const enabledVideoActions = actions.filter((a) => a.video_enabled);
  const previewDuration =
    enabledVideoActions[0]?.video_duration_s ?? 4;
  const perCost = (previewDuration * meta.perSecondCNY).toFixed(2);

  const handleSelect = useCallback(
    async (chosen: VideoGenProviderName) => {
      setOpen(false);
      if (chosen === provider) return;
      await update({ video_gen_provider: chosen });
    },
    [provider, update]
  );

  const keyStatusFor = useCallback(
    (name: VideoGenProviderName): "ok" | "missing" | "free" => {
      if (name === "comfyui") return "free";
      // 当前激活 provider 的状态来自 settings.video_gen_api_key;
      // 其它 provider 的 key 状态此处无法判断(未细分 provider 多 Key),
      // 仅在 name === provider 时返回真值;否则统一显示中性图标。
      if (name === provider) return hasKey ? "ok" : "missing";
      return "free";
    },
    [provider, hasKey]
  );

  return (
    <div
      style={{
        position: "relative",
        padding: "12px 14px",
        borderRadius: 12,
        background: hasKey
          ? "linear-gradient(135deg, var(--paper-0), var(--moss-100) 200%)"
          : "var(--amber-100)",
        border: `1px solid ${hasKey ? "var(--rule-line)" : "var(--amber-200)"}`,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Icon
        name="video"
        size="sm"
        style={{ color: hasKey ? "var(--moss-600)" : "var(--amber-600)" }}
        accent
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ink-900)",
            letterSpacing: "-0.005em",
          }}
        >
          动作视频:
        </span>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 8,
            border: "1px solid var(--rule-line-strong)",
            background: "var(--paper-0)",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ink-900)",
            cursor: "pointer",
            outline: "none",
          }}
        >
          {meta.label}
          <Icon name={open ? "chevron-up" : "chevron-down"} size="xs" />
        </button>
        <span style={{ fontSize: 11, color: "var(--ink-500)" }}>
          {meta.perSecondCNY === 0
            ? "本地推理 · 免费"
            : `单条 ${previewDuration}s ≈ ¥${perCost}`}
        </span>
      </div>
      {!hasKey && (
        <button
          onClick={() => invoke("create_settings_window")}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--seal-red)",
            fontSize: 11,
            cursor: "pointer",
            padding: "2px 6px",
            borderRadius: 6,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
          title="跳转设置面板填写 API Key"
        >
          <Icon name="alert-triangle" size="xs" accent />
          缺 API Key · 去填写
        </button>
      )}

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 14,
            zIndex: 20,
            minWidth: 240,
            padding: 6,
            borderRadius: 10,
            background: "var(--paper-0)",
            border: "1px solid var(--rule-line-strong)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {VIDEO_PROVIDER_ORDER.map((name) => {
            const m = VIDEO_PROVIDER_CATALOG[name];
            const status = keyStatusFor(name);
            const active = name === provider;
            return (
              <button
                key={name}
                onClick={() => handleSelect(name)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 10px",
                  borderRadius: 7,
                  border: "none",
                  background: active ? "var(--moss-100)" : "transparent",
                  color: "var(--ink-900)",
                  fontSize: 12,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 120ms ease",
                }}
                onMouseEnter={(e) => {
                  if (!active)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "var(--paper-3)";
                }}
                onMouseLeave={(e) => {
                  if (!active)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "transparent";
                }}
              >
                <span
                  style={{
                    fontWeight: active ? 600 : 500,
                    flex: 1,
                  }}
                >
                  {m.label}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--ink-400)",
                    fontFamily: "var(--font-mono, monospace)",
                  }}
                >
                  {m.perSecondCNY === 0
                    ? "免费"
                    : `¥${m.perSecondCNY.toFixed(2)}/s`}
                </span>
                {status === "ok" && (
                  <Icon
                    name="check"
                    size="xs"
                    style={{ color: "var(--moss-600)" }}
                    accent
                  />
                )}
                {status === "missing" && (
                  <Icon
                    name="alert-triangle"
                    size="xs"
                    style={{ color: "var(--amber-600)" }}
                    accent
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────── 核心动作卡片 ─────────────── */

function CoreActionCard({
  meta,
  checked,
  expanded,
  action,
  staggerDelay,
  onToggle,
  onExpand,
  onUpdate,
}: {
  meta: ActionMeta;
  checked: boolean;
  expanded: boolean;
  action: ActionSpec | undefined;
  staggerDelay: number;
  onToggle: () => void;
  onExpand: () => void;
  onUpdate: (patch: Partial<ActionSpec>) => void;
}) {
  const baseBg = checked ? "var(--moss-100)" : "var(--paper-0)";
  const baseBorder = checked
    ? "1.5px solid var(--moss-600)"
    : "1px solid var(--rule-line)";
  return (
    <div
      className="stagger-fade-up"
      style={{
        animationDelay: `${staggerDelay}ms`,
        border: baseBorder,
        borderRadius: 12,
        background: baseBg,
        overflow: "hidden",
        transition: "border-color 160ms ease, background 160ms ease",
      }}
    >
      {/* 折叠头 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          cursor: checked ? "pointer" : "default",
        }}
        onClick={() => checked && onExpand()}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            display: "grid",
            placeItems: "center",
            background: checked ? "var(--moss-600)" : "var(--paper-3)",
            color: checked ? "#fff" : "var(--ink-500)",
            transition: "all 160ms ease",
          }}
        >
          <Icon name={meta.iconName} size={16} accent={checked} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--ink-900)",
              }}
            >
              {meta.zhName}
            </span>
            <span
              style={{
                fontSize: 10,
                color: "var(--ink-400)",
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              {meta.state}
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--ink-500)",
              marginTop: 2,
              lineHeight: 1.4,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {meta.scene}
          </div>
        </div>
        {checked && action && (
          <div
            style={{
              fontSize: 10,
              color: "var(--ink-500)",
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            {action.frame_count}f · {action.fps}fps
            {action.video_enabled ? " · 视频" : ""}
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-label={checked ? "禁用动作" : "启用动作"}
          style={{
            width: 36,
            height: 20,
            borderRadius: 999,
            border: "none",
            position: "relative",
            background: checked ? "var(--moss-600)" : "var(--ink-200)",
            cursor: "pointer",
            transition: "background 160ms ease",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: checked ? 18 : 2,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#fff",
              boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
              transition: "left 160ms ease",
            }}
          />
        </button>
        {checked && (
          <Icon
            name={expanded ? "chevron-up" : "chevron-down"}
            size="sm"
            style={{ color: "var(--ink-400)" }}
          />
        )}
      </div>

      {/* 展开区 */}
      {checked && expanded && action && (
        <div
          style={{
            padding: "12px 14px",
            borderTop: "1px dashed var(--rule-line)",
            background: "var(--paper-1)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <textarea
            value={action.prompt_delta}
            onChange={(e) => onUpdate({ prompt_delta: e.target.value })}
            placeholder="动作描述(英文更稳),如:waving one hand, smiling brightly"
            rows={2}
            style={{
              padding: "8px 10px",
              fontSize: 12,
              border: "1px solid var(--rule-line)",
              borderRadius: 8,
              resize: "vertical",
              minHeight: 52,
              background: "var(--paper-0)",
              outline: "none",
              color: "var(--ink-900)",
              fontFamily: "var(--font-mono, 'SF Mono', monospace)",
            }}
          />
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <NumField
              label="帧数"
              value={action.frame_count}
              min={1}
              max={24}
              onChange={(v) => onUpdate({ frame_count: v })}
            />
            <NumField
              label="FPS"
              value={action.fps}
              min={1}
              max={30}
              onChange={(v) => onUpdate({ fps: v })}
            />
            <LoopSelect
              value={action.loop_mode}
              onChange={(v) => onUpdate({ loop_mode: v })}
            />
          </div>
          <VideoRow
            enabled={!!action.video_enabled}
            durationS={action.video_duration_s ?? 4}
            onToggle={(v) =>
              onUpdate({
                video_enabled: v,
                video_duration_s: action.video_duration_s ?? 4,
              })
            }
            onDurationChange={(d) => onUpdate({ video_duration_s: d })}
          />
        </div>
      )}
    </div>
  );
}

/* ─────────────── 自定义动作卡 ─────────────── */

function CustomActionCard({
  action,
  onUpdate,
  onRemove,
}: {
  action: ActionSpec;
  onUpdate: (patch: Partial<ActionSpec>) => void;
  onRemove: () => void;
}) {
  return (
    <div
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
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink-900)",
          }}
        >
          {action.action_name}
        </span>
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
        <div style={{ flex: 1 }} />
        <button
          onClick={onRemove}
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
        value={action.prompt_delta}
        onChange={(e) => onUpdate({ prompt_delta: e.target.value })}
        placeholder="动作描述(英文更稳)"
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
          fontFamily: "var(--font-mono, monospace)",
        }}
      />
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <NumField
          label="帧数"
          value={action.frame_count}
          min={1}
          max={24}
          onChange={(v) => onUpdate({ frame_count: v })}
        />
        <NumField
          label="FPS"
          value={action.fps}
          min={1}
          max={30}
          onChange={(v) => onUpdate({ fps: v })}
        />
        <LoopSelect
          value={action.loop_mode}
          onChange={(v) => onUpdate({ loop_mode: v })}
        />
      </div>
      <VideoRow
        enabled={!!action.video_enabled}
        durationS={action.video_duration_s ?? 4}
        onToggle={(v) =>
          onUpdate({
            video_enabled: v,
            video_duration_s: action.video_duration_s ?? 4,
          })
        }
        onDurationChange={(d) => onUpdate({ video_duration_s: d })}
      />
    </div>
  );
}

/* ─────────────── 通用子组件 ─────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: "var(--ink-500)",
        fontWeight: 500,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {children}
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

/* ─────────────── 视频开关行(动态供应商文案) ─────────────── */

function VideoRow({
  enabled,
  durationS,
  onToggle,
  onDurationChange,
}: {
  enabled: boolean;
  durationS: number;
  onToggle: (v: boolean) => void;
  onDurationChange: (d: number) => void;
}) {
  const settings = useSettingsStore((s) => s.settings);
  const provider: VideoGenProviderName =
    settings?.video_gen_provider ?? "gemini";
  const meta = videoProviderMeta(provider);
  const hasKey =
    provider === "comfyui" || (settings?.video_gen_api_key.trim().length ?? 0) > 0;
  const cost = (durationS * meta.perSecondCNY).toFixed(2);
  const disabled = !hasKey;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        background: enabled ? "var(--moss-100)" : "var(--paper-3)",
        border: `1px dashed ${
          enabled ? "var(--moss-600)" : "var(--rule-line-strong)"
        }`,
        borderRadius: 10,
        opacity: disabled && !enabled ? 0.55 : 1,
        transition: "all 140ms ease",
      }}
    >
      <button
        type="button"
        onClick={() => !disabled && onToggle(!enabled)}
        disabled={disabled && !enabled}
        title={
          disabled && !enabled
            ? `${meta.label} 还没配置 API Key,请先去设置面板填写`
            : `启用 ${meta.label} 生成 ${durationS}s 循环视频(覆盖静态帧)`
        }
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: 999,
          border: "none",
          background: enabled ? "var(--moss-600)" : "var(--paper-0)",
          color: enabled ? "#fff" : "var(--ink-600)",
          fontSize: 11,
          fontWeight: 600,
          cursor: disabled && !enabled ? "not-allowed" : "pointer",
          boxShadow: enabled
            ? "0 1px 3px rgba(0,0,0,.12)"
            : "inset 0 0 0 1px var(--rule-line-strong)",
          transition: "all 140ms ease",
        }}
      >
        <Icon name="video" size="xs" />
        {enabled ? "视频已启用" : "启用动作视频"}
      </button>
      {enabled && (
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--ink-600)",
          }}
        >
          时长
          <select
            value={durationS}
            onChange={(e) => onDurationChange(Number(e.target.value))}
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid var(--rule-line-strong)",
              fontSize: 12,
              background: "var(--paper-0)",
              outline: "none",
            }}
          >
            <option value={4}>4s</option>
            <option value={6}>6s</option>
            <option value={8}>8s</option>
          </select>
        </label>
      )}
      <span
        style={{
          fontSize: 10,
          color: "var(--ink-500)",
          marginLeft: "auto",
        }}
      >
        {meta.perSecondCNY === 0
          ? `${meta.shortLabel} · 本地免费`
          : `${meta.shortLabel} 图生视频 · ~¥${cost}/条`}
      </span>
    </div>
  );
}

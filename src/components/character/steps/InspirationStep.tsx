import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/shared/Icon";
import { useCharacterDraftStore } from "@/stores/useCharacterDraftStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { refineDescription } from "@/services/characterGenerator";
import WizardFooter from "../WizardFooter";

export default function InspirationStep() {
  const { draft, updatePayload, setStep } = useCharacterDraftStore();
  const settings = useSettingsStore((s) => s.settings);
  const needsImgConfig =
    !!settings &&
    settings.image_gen_provider === "jimeng" &&
    !settings.image_gen_api_key.trim();
  const [name, setName] = useState(draft?.payload.name ?? "");
  const [description, setDescription] = useState(draft?.payload.description ?? "");
  const [refined, setRefined] = useState(draft?.payload.refined_prompt ?? "");
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);

  useEffect(() => {
    setName(draft?.payload.name ?? "");
    setDescription(draft?.payload.description ?? "");
    setRefined(draft?.payload.refined_prompt ?? "");
  }, [draft?.id]);

  const handleRefine = useCallback(async () => {
    if (!description.trim()) return;
    setRefining(true);
    setRefineError(null);
    try {
      const out = await refineDescription(description);
      setRefined(out);
    } catch (e) {
      setRefineError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefining(false);
    }
  }, [description]);

  const canNext = !!name.trim() && !!description.trim();

  const handleNext = useCallback(async () => {
    await updatePayload({
      name: name.trim(),
      description: description.trim(),
      refined_prompt: refined.trim(),
    });
    await setStep(2);
  }, [name, description, refined, updatePayload, setStep]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {needsImgConfig && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(220,38,38,0.08)",
            border: "1px solid rgba(220,38,38,0.2)",
            fontSize: 12,
            color: "var(--seal-red)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            lineHeight: 1.5,
          }}
        >
          <Icon name="alert-triangle" size="sm" accent />
          <span>
            即梦 API Key 还没填，Step 2 无法生图。请先到 设置 → 图像生成 配置。
          </span>
        </div>
      )}
      <LabeledField label="角色名字" hint="会显示在桌宠右键菜单与 Gallery">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：阿莓"
          style={inputStyle}
        />
      </LabeledField>

      <LabeledField
        label="一句话描述"
        hint="中文即可，描述角色的外观、性格、姿态"
      >
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例如：戴贝雷帽的柴犬艺术家，叼着画笔，软萌治愈"
          rows={3}
          style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
        />
      </LabeledField>

      <div
        style={{
          padding: 16,
          borderRadius: 14,
          border: "1px solid var(--rule-line)",
          background: "var(--paper-0)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink-900)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Icon name="wand-2" size="sm" />
            AI 润色（可选）
          </div>
          <button
            className="btn btn-ghost"
            onClick={handleRefine}
            disabled={refining || !description.trim()}
            style={{ padding: "6px 12px", fontSize: 12 }}
          >
            <Icon
              name="refresh-cw"
              size="xs"
              style={{
                marginRight: 6,
                animation: refining ? "spin 1.2s linear infinite" : "none",
              }}
            />
            {refining ? "润色中…" : "润色为英文 prompt"}
          </button>
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-500)", lineHeight: 1.5 }}>
          润色会调用已配置的 LLM，把中文描述扩写为含风格、构图、绿幕约定的英文 prompt。不润色也可以继续，系统会用模板自动补齐。
        </div>
        <textarea
          value={refined}
          onChange={(e) => setRefined(e.target.value)}
          placeholder={
            description.trim()
              ? "点击右侧按钮自动生成，或直接粘贴你自己的 prompt"
              : "先填写一句话描述，再点击润色"
          }
          rows={4}
          style={{
            ...inputStyle,
            fontFamily:
              "var(--font-mono, 'SF Mono', Menlo, monospace)",
            fontSize: 12,
            resize: "vertical",
            minHeight: 88,
          }}
        />
        {refineError && (
          <div style={{ fontSize: 11, color: "var(--seal-red)" }}>
            润色失败：{refineError}
          </div>
        )}
      </div>

      <WizardFooter
        rightLabel="下一步：生成基准图"
        rightDisabled={!canNext}
        onRight={handleNext}
      />
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--rule-line-strong)",
  borderRadius: 10,
  fontSize: 13,
  background: "var(--paper-0)",
  color: "var(--ink-900)",
  outline: "none",
  boxSizing: "border-box",
};

function LabeledField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          fontSize: 12,
          color: "var(--ink-700)",
          fontWeight: 500,
          letterSpacing: "0.01em",
        }}
      >
        {label}
      </div>
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: "var(--ink-400)" }}>{hint}</div>
      )}
    </label>
  );
}

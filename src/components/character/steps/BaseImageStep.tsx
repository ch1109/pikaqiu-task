import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "@/components/shared/Icon";
import { useCharacterDraftStore } from "@/stores/useCharacterDraftStore";
import {
  applyChromaKey,
  b64ToDataUrl,
  finalizeBasePrompt,
  generateBaseCandidates,
} from "@/services/characterGenerator";
import { getImageProvider } from "@/services/image";
import WizardFooter from "../WizardFooter";

interface Candidate {
  b64: string;
  seed: number | undefined;
}

/**
 * Step 2：基准图。
 * - 生成 4 张候选 → 用户点一张
 * - 选中后通过色键抠图生成透明 PNG
 * - tolerance / feather 滑块实时重算
 */
export default function BaseImageStep() {
  const { draft, updatePayload, setStep } = useCharacterDraftStore();
  const [candidates, setCandidates] = useState<Candidate[]>(() =>
    (draft?.payload.base_image_candidates ?? []).map((b64) => ({
      b64,
      seed: undefined,
    }))
  );
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [cutoutB64, setCutoutB64] = useState<string | null>(
    draft?.payload.base_image_b64 ?? null
  );
  const [tolerance, setTolerance] = useState(45);
  const [feather, setFeather] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerName, setProviderName] = useState<string>(
    draft?.payload.base_image_provider ?? ""
  );

  const prompt = useMemo(
    () =>
      finalizeBasePrompt(
        draft?.payload.refined_prompt || draft?.payload.description || ""
      ),
    [draft?.payload.refined_prompt, draft?.payload.description]
  );

  const handleGenerate = useCallback(async () => {
    if (!draft) return;
    if (!prompt.trim()) {
      setError("请回到 Step 1 补全描述");
      return;
    }
    setGenerating(true);
    setError(null);
    setSelectedIdx(null);
    setCutoutB64(null);
    try {
      const provider = await getImageProvider();
      setProviderName(provider.name);
      const out = await generateBaseCandidates({
        draftId: draft.id,
        prompt,
        count: 4,
      });
      const list: Candidate[] = out.map((o) => ({ b64: o.b64, seed: o.seed }));
      setCandidates(list);
      await updatePayload({
        base_image_candidates: list.map((c) => c.b64),
        base_image_provider: provider.name,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }, [draft, prompt, updatePayload]);

  const applyCut = useCallback(
    async (candidate: Candidate) => {
      setProcessing(true);
      setError(null);
      try {
        const b64 = await applyChromaKey(candidate.b64, {
          tolerance,
          featherPx: feather,
          despill: true,
        });
        setCutoutB64(b64);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setProcessing(false);
      }
    },
    [tolerance, feather]
  );

  // 参数变化时自动重算抠图
  useEffect(() => {
    if (selectedIdx === null) return;
    const c = candidates[selectedIdx];
    if (!c) return;
    const id = window.setTimeout(() => {
      void applyCut(c);
    }, 120);
    return () => window.clearTimeout(id);
  }, [tolerance, feather, selectedIdx, candidates, applyCut]);

  const handleSelect = useCallback(
    (idx: number) => {
      setSelectedIdx(idx);
      const c = candidates[idx];
      if (c) void applyCut(c);
    },
    [candidates, applyCut]
  );

  const handleNext = useCallback(async () => {
    if (!cutoutB64) return;
    const selected =
      selectedIdx !== null ? candidates[selectedIdx] : undefined;
    await updatePayload({
      base_image_b64: cutoutB64,
      base_image_seed:
        selected?.seed ?? draft?.payload.base_image_seed ?? null,
      base_image_provider: providerName,
    });
    await setStep(3);
  }, [
    cutoutB64,
    selectedIdx,
    candidates,
    draft?.payload.base_image_seed,
    providerName,
    updatePayload,
    setStep,
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 生成控制条 */}
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
        <button
          className="btn btn-cyan"
          onClick={handleGenerate}
          disabled={generating}
          style={{ fontSize: 13 }}
        >
          <Icon
            name="sparkles"
            size="xs"
            style={{ marginRight: 6 }}
          />
          {candidates.length > 0 ? "重新生成 4 张" : "生成 4 张候选"}
        </button>
        <div
          style={{
            fontSize: 11,
            color: "var(--ink-500)",
            flex: 1,
            lineHeight: 1.5,
            wordBreak: "break-all",
          }}
          title={prompt}
        >
          {prompt ? `prompt: ${prompt.slice(0, 90)}${prompt.length > 90 ? "…" : ""}` : "请先回到 Step 1 补全描述"}
        </div>
        {generating && (
          <div style={{ fontSize: 11, color: "var(--vermilion-600)" }}>
            正在生成…
          </div>
        )}
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

      {/* 候选网格 */}
      {candidates.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              color: "var(--ink-600)",
              marginBottom: 8,
            }}
          >
            点击选择一张作为基准图
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 10,
            }}
          >
            {candidates.map((c, i) => (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                style={{
                  aspectRatio: "1 / 1",
                  border:
                    selectedIdx === i
                      ? "2px solid var(--vermilion-600)"
                      : "1px solid var(--rule-line-strong)",
                  borderRadius: 12,
                  padding: 0,
                  cursor: "pointer",
                  overflow: "hidden",
                  background: "#00FF00",
                  boxShadow:
                    selectedIdx === i
                      ? "0 0 0 4px var(--vermilion-200)"
                      : "none",
                  transition: "all 160ms ease",
                }}
              >
                <img
                  src={b64ToDataUrl(c.b64)}
                  alt={`candidate ${i + 1}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 抠图预览 + 滑块 */}
      {selectedIdx !== null && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          <div
            style={{
              aspectRatio: "1 / 1",
              borderRadius: 14,
              border: "1px solid var(--rule-line)",
              overflow: "hidden",
              background:
                "conic-gradient(var(--ink-100) 0 25%, var(--paper-0) 0 50%, var(--ink-100) 0 75%, var(--paper-0) 0) 0 0 / 16px 16px",
              display: "grid",
              placeItems: "center",
              position: "relative",
            }}
          >
            {cutoutB64 ? (
              <img
                src={b64ToDataUrl(cutoutB64)}
                alt="透明抠图"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <div style={{ color: "var(--ink-400)", fontSize: 12 }}>
                {processing ? "抠图处理中…" : "尚未生成抠图"}
              </div>
            )}
            {processing && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(255,255,255,0.35)",
                  backdropFilter: "blur(1px)",
                  display: "grid",
                  placeItems: "center",
                  color: "var(--vermilion-600)",
                  fontSize: 11,
                }}
              >
                重新抠图…
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SliderField
              label="颜色容差"
              value={tolerance}
              min={10}
              max={120}
              onChange={setTolerance}
              hint="越大越激进去绿；偏大会伤角色边缘"
            />
            <SliderField
              label="边缘羽化"
              value={feather}
              min={0}
              max={4}
              onChange={setFeather}
              hint="0 = 硬边；1-2 像素足以消除锯齿"
            />
            <div
              style={{
                fontSize: 11,
                color: "var(--ink-500)",
                padding: 10,
                background: "var(--paper-3)",
                borderRadius: 10,
                lineHeight: 1.6,
              }}
            >
              抠图在前端本地完成，不再消耗 API 配额。若边缘有绿晕请加大容差，若角色被抠破请减小容差。
            </div>
          </div>
        </div>
      )}

      <WizardFooter
        rightLabel="下一步：动作清单"
        rightDisabled={!cutoutB64}
        onRight={handleNext}
      />
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <label
      style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: "var(--ink-700)",
          fontWeight: 500,
        }}
      >
        <span>{label}</span>
        <span style={{ color: "var(--vermilion-600)" }}>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%" }}
      />
      {hint && (
        <div style={{ fontSize: 11, color: "var(--ink-400)" }}>{hint}</div>
      )}
    </label>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "@/components/shared/Icon";
import { useCharacterDraftStore } from "@/stores/useCharacterDraftStore";
import type { WizardStep } from "@/types/character";
import InspirationStep from "./steps/InspirationStep";
import BaseImageStep from "./steps/BaseImageStep";
import ActionListStep from "./steps/ActionListStep";
import FrameGenStep from "./steps/FrameGenStep";
import PreviewStep from "./steps/PreviewStep";

const STEP_TITLES: Record<WizardStep, { title: string; subtitle: string }> = {
  1: { title: "灵感", subtitle: "说说你想要的角色" },
  2: { title: "基准图", subtitle: "生成主视觉与透明抠图" },
  3: { title: "动作清单", subtitle: "选择角色能做哪些动作" },
  4: { title: "帧生成", subtitle: "为每个动作生成 PNG 序列" },
  5: { title: "预览确认", subtitle: "预览动画并保存角色" },
};

export default function CharacterWizard() {
  const { draft, loaded, createNew, setStep, discard } =
    useCharacterDraftStore();
  const [starting, setStarting] = useState(false);

  const step = draft?.step ?? 1;

  const handleStart = useCallback(async () => {
    setStarting(true);
    try {
      await createNew();
    } finally {
      setStarting(false);
    }
  }, [createNew]);

  const handleDiscard = useCallback(async () => {
    if (!confirm("放弃当前草稿？已生成的图像将被清理。")) return;
    await discard();
  }, [discard]);

  useEffect(() => {
    // 首次打开时不自动新建，让用户看到"继续 / 新建"选项
  }, []);

  // 未加载完成 → 骨架
  if (!loaded) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-400)",
          fontSize: 13,
        }}
      >
        加载中…
      </div>
    );
  }

  // 没有进行中的草稿 → 空态
  if (!draft) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 48,
          gap: 16,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(46,111,235,0.14), rgba(46,111,235,0) 70%)",
            display: "grid",
            placeItems: "center",
            color: "var(--vermilion-600)",
          }}
        >
          <Icon name="sparkles" size={36} />
        </div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            fontWeight: 600,
            color: "var(--ink-900)",
          }}
        >
          为你的桌宠创造新形象
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--ink-500)",
            textAlign: "center",
            maxWidth: 420,
            lineHeight: 1.6,
          }}
        >
          5 步引导：灵感描述 → 基准图 → 动作清单 → 帧生成 → 预览确认。
          <br />
          过程中可随时暂停，草稿会保留。
        </div>
        <button
          className="btn btn-cyan"
          onClick={handleStart}
          disabled={starting}
          style={{ marginTop: 12, fontSize: 14 }}
        >
          {starting ? "正在创建…" : "开始创建"}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <StepperBar
        current={step as WizardStep}
        onJump={(s) => {
          // 只允许跳到已完成的步骤；未完成的不允许跳转
          if (s <= step) void setStep(s);
        }}
      />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "20px 28px 16px",
        }}
      >
        <StepHeader step={step as WizardStep} onDiscard={handleDiscard} />
        <StepRenderer step={step as WizardStep} />
      </div>
    </div>
  );
}

function StepHeader({
  step,
  onDiscard,
}: {
  step: WizardStep;
  onDiscard: () => void;
}) {
  const meta = STEP_TITLES[step];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 18,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "var(--ink-900)",
          }}
        >
          {meta.title}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 3 }}>
          {meta.subtitle}
        </div>
      </div>
      <button
        onClick={onDiscard}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--ink-400)",
          fontSize: 12,
          cursor: "pointer",
          padding: "4px 8px",
        }}
        title="放弃草稿"
      >
        放弃
      </button>
    </div>
  );
}

function StepperBar({
  current,
  onJump,
}: {
  current: WizardStep;
  onJump: (s: WizardStep) => void;
}) {
  const steps = useMemo<WizardStep[]>(() => [1, 2, 3, 4, 5], []);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "14px 28px 0",
      }}
    >
      {steps.map((s, idx) => {
        const done = s < current;
        const active = s === current;
        return (
          <div
            key={s}
            style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}
          >
            <button
              onClick={() => onJump(s)}
              disabled={s > current}
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                border: "none",
                cursor: s <= current ? "pointer" : "not-allowed",
                background: done
                  ? "var(--moss-600)"
                  : active
                  ? "var(--vermilion-600)"
                  : "var(--ink-100)",
                color: done || active ? "#fff" : "var(--ink-400)",
                fontSize: 12,
                fontWeight: 600,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                boxShadow: active
                  ? "0 0 0 4px var(--vermilion-200)"
                  : "none",
                transition: "all 160ms ease",
              }}
            >
              {done ? <Icon name="check" size={13} /> : s}
            </button>
            {idx < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  borderRadius: 2,
                  background: done ? "var(--moss-600)" : "var(--ink-100)",
                  opacity: 0.7,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepRenderer({ step }: { step: WizardStep }) {
  switch (step) {
    case 1:
      return <InspirationStep />;
    case 2:
      return <BaseImageStep />;
    case 3:
      return <ActionListStep />;
    case 4:
      return <FrameGenStep />;
    case 5:
      return <PreviewStep />;
  }
}

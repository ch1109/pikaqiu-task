import { useCallback, useMemo, useState } from "react";
import Icon from "@/components/shared/Icon";
import { useCharacterDraftStore } from "@/stores/useCharacterDraftStore";
import { useCharacterStore } from "@/stores/useCharacterStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import {
  allocCharacterId,
  generateVideoForAction,
  promoteDraftToCharacter,
} from "@/services/characterGenerator";
import { setActiveCharacter } from "@/services/character";
import WizardFooter from "../WizardFooter";
import FramePreviewPlayer from "../FramePreviewPlayer";
import type { VideoProgress } from "@/services/video";

type VideoTaskStatus =
  | { state: "pending" }
  | { state: "running"; progress: VideoProgress }
  | { state: "done" }
  | { state: "failed"; message: string };

export default function PreviewStep() {
  const { draft, discard } = useCharacterDraftStore();
  const { reload } = useCharacterStore();
  const { settings } = useSettingsStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [setAsActive, setSetAsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoTasks, setVideoTasks] = useState<Record<string, VideoTaskStatus>>(
    {}
  );
  const [videoPhase, setVideoPhase] = useState<"idle" | "running" | "done">(
    "idle"
  );

  const actions = draft?.payload.actions ?? [];
  const frames = draft?.payload.frames ?? {};
  const videoActions = useMemo(
    () => actions.filter((a) => a.video_enabled),
    [actions]
  );
  const hasVideoJobs = videoActions.length > 0;

  const canSave =
    !!draft &&
    !!draft.payload.base_image_b64 &&
    actions.length > 0 &&
    actions.every(
      (a) => (frames[a.action_name]?.length ?? 0) >= a.frame_count
    );

  const handleSave = useCallback(async () => {
    if (!draft || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      // 若有视频任务：先分配角色 ID，保证后续视频 invoke 能落到正式目录
      const characterId = hasVideoJobs
        ? allocCharacterId()
        : crypto.randomUUID();

      await promoteDraftToCharacter({
        draftId: draft.id,
        characterId,
        name: draft.payload.name,
        description: draft.payload.description,
        refPrompt: draft.payload.refined_prompt || draft.payload.description,
        baseB64: draft.payload.base_image_b64!,
        baseSeed: draft.payload.base_image_seed ?? null,
        providerName: draft.payload.base_image_provider || "unknown",
        costTotal: 0,
        actions: actions.map((a) => ({
          spec: a,
          frames: frames[a.action_name] ?? [],
        })),
      });

      // 视频生成阶段：串行逐个动作生成（各家视频 API 单账号并发有限制，串行稳）
      if (hasVideoJobs) {
        if (!settings?.video_gen_api_key.trim()) {
          throw new Error(
            "未配置视频生成 API Key —— 请先在设置面板填入后重试，或在动作列表里关闭视频开关。"
          );
        }
        setVideoPhase("running");
        setVideoTasks(
          Object.fromEntries(
            videoActions.map((a) => [a.action_name, { state: "pending" as const }])
          )
        );
        for (const action of videoActions) {
          try {
            await generateVideoForAction({
              characterId,
              action,
              characterDescription:
                draft.payload.refined_prompt || draft.payload.description,
              baseImageB64: draft.payload.base_image_b64!,
              settings: settings!,
              onProgress: (progress) => {
                setVideoTasks((prev) => ({
                  ...prev,
                  [action.action_name]: { state: "running", progress },
                }));
              },
            });
            setVideoTasks((prev) => ({
              ...prev,
              [action.action_name]: { state: "done" },
            }));
          } catch (err) {
            setVideoTasks((prev) => ({
              ...prev,
              [action.action_name]: {
                state: "failed",
                message: err instanceof Error ? err.message : String(err),
              },
            }));
          }
        }
        setVideoPhase("done");
      }

      if (setAsActive) {
        await setActiveCharacter(characterId);
      }
      await reload();
      await discard();
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [
    draft,
    canSave,
    actions,
    frames,
    hasVideoJobs,
    videoActions,
    settings,
    setAsActive,
    discard,
    reload,
  ]);

  if (saved) {
    return (
      <div
        style={{
          padding: 36,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "var(--moss-100)",
            display: "grid",
            placeItems: "center",
            color: "var(--moss-600)",
          }}
        >
          <Icon name="check" size={36} />
        </div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 20,
            fontWeight: 600,
            color: "var(--ink-900)",
          }}
        >
          角色已保存
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-500)" }}>
          {setAsActive
            ? "已设为当前桌宠，关闭本窗口即可看到新形象。"
            : "未激活。可在设置面板的角色列表中切换。"}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          fontSize: 12,
          color: "var(--ink-500)",
          padding: "10px 12px",
          background: "var(--paper-3)",
          borderRadius: 10,
        }}
      >
        下方为各动作的实际播放效果。确认无误后保存为正式角色，帧文件会被归档到应用数据目录。
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 14,
        }}
      >
        {actions.map((a) => (
          <div
            key={a.action_name}
            style={{
              padding: 12,
              borderRadius: 14,
              border: "1px solid var(--rule-line)",
              background: "var(--paper-0)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <FramePreviewPlayer
              frames={frames[a.action_name] ?? []}
              fps={a.fps}
              loop={a.loop_mode}
              size={128}
            />
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink-900)",
              }}
            >
              {a.action_name}
            </div>
            <div style={{ fontSize: 10, color: "var(--ink-400)" }}>
              {a.frame_count} 帧 · {a.fps}fps · {a.loop_mode}
            </div>
          </div>
        ))}
      </div>

      {hasVideoJobs && (
        <VideoJobsPanel
          actions={videoActions.map((a) => a.action_name)}
          tasks={videoTasks}
          phase={videoPhase}
        />
      )}

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: "var(--ink-700)",
          padding: 12,
          borderRadius: 10,
          background: "var(--paper-3)",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={setAsActive}
          onChange={(e) => setSetAsActive(e.target.checked)}
          style={{ width: 16, height: 16, cursor: "pointer" }}
        />
        立即设为当前桌宠形象
      </label>

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

      <WizardFooter
        rightLabel={
          saving
            ? videoPhase === "running"
              ? "生成视频中…"
              : "保存中…"
            : hasVideoJobs
            ? "保存并生成视频"
            : "保存角色"
        }
        rightDisabled={!canSave}
        rightLoading={saving}
        onRight={handleSave}
      />
    </div>
  );
}

function VideoJobsPanel({
  actions,
  tasks,
  phase,
}: {
  actions: string[];
  tasks: Record<string, VideoTaskStatus>;
  phase: "idle" | "running" | "done";
}) {
  return (
    <div
      style={{
        padding: 14,
        border: "1px solid var(--moss-600)",
        borderRadius: 12,
        background: "var(--moss-100)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "var(--moss-600)",
          fontWeight: 600,
          letterSpacing: "-0.01em",
        }}
      >
        <Icon name="video" size="sm" />
        动作视频生成（Gemini Veo）
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: "var(--ink-500)",
            marginLeft: "auto",
          }}
        >
          {phase === "idle"
            ? "待触发"
            : phase === "running"
            ? "进行中"
            : "完成"}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {actions.map((name) => {
          const t: VideoTaskStatus = tasks[name] ?? { state: "pending" };
          return (
            <div
              key={name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 8,
                background: "var(--paper-0)",
                fontSize: 12,
              }}
            >
              <span style={{ fontWeight: 600, minWidth: 96 }}>{name}</span>
              <VideoTaskLabel task={t} />
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-500)", lineHeight: 1.5 }}>
        每条 4s 视频约需 60–120 秒；失败的动作保留静态帧兜底，后续可在角色面板单独重试。
      </div>
    </div>
  );
}

function VideoTaskLabel({ task }: { task: VideoTaskStatus }) {
  if (task.state === "pending") {
    return (
      <span style={{ color: "var(--ink-400)" }}>等待中</span>
    );
  }
  if (task.state === "running") {
    const p = task.progress;
    const label =
      p.message ??
      (p.phase === "polling"
        ? `生成中 · ${p.pollAttempt ?? 0}×`
        : p.phase);
    return (
      <>
        <Icon name="refresh-cw" size="xs" style={{ animation: "spin 1.4s linear infinite" }} />
        <span style={{ color: "var(--ink-700)" }}>{label}</span>
      </>
    );
  }
  if (task.state === "done") {
    return (
      <>
        <Icon name="check" size="xs" accent />
        <span style={{ color: "var(--moss-600)", fontWeight: 600 }}>完成</span>
      </>
    );
  }
  return (
    <>
      <Icon name="x" size="xs" accent />
      <span
        style={{
          color: "var(--seal-red)",
          fontSize: 11,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={task.message}
      >
        失败：{task.message.slice(0, 40)}
      </span>
    </>
  );
}

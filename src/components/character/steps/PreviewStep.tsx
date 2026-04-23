import { useCallback, useState } from "react";
import Icon from "@/components/shared/Icon";
import { useCharacterDraftStore } from "@/stores/useCharacterDraftStore";
import { useCharacterStore } from "@/stores/useCharacterStore";
import { promoteDraftToCharacter } from "@/services/characterGenerator";
import { setActiveCharacter } from "@/services/character";
import WizardFooter from "../WizardFooter";
import FramePreviewPlayer from "../FramePreviewPlayer";

export default function PreviewStep() {
  const { draft, discard } = useCharacterDraftStore();
  const { reload } = useCharacterStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [setAsActive, setSetAsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const actions = draft?.payload.actions ?? [];
  const frames = draft?.payload.frames ?? {};

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
      const characterId = await promoteDraftToCharacter({
        draftId: draft.id,
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
  }, [draft, canSave, actions, frames, setAsActive, discard, reload]);

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
        rightLabel={saving ? "保存中…" : "保存角色"}
        rightDisabled={!canSave}
        rightLoading={saving}
        onRight={handleSave}
      />
    </div>
  );
}

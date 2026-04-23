import { useEffect } from "react";
import WindowTitleBar from "@/components/shared/WindowTitleBar";
import CharacterWizard from "@/components/character/CharacterWizard";
import { useCharacterDraftStore } from "@/stores/useCharacterDraftStore";
import { useSettingsStore } from "@/stores/useSettingsStore";

/**
 * 角色工坊独立窗口（label: "character-studio"）。
 * 尺寸由 Rust 端 create_character_studio_window 控制（860×640 默认）。
 */
export default function CharacterStudio() {
  const { loaded, loadLatest } = useCharacterDraftStore();
  const { settings, load } = useSettingsStore();

  useEffect(() => {
    if (!loaded) void loadLatest();
    if (!settings) void load();
  }, [loaded, loadLatest, settings, load]);

  return (
    <div
      className="glass-panel"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background:
          "linear-gradient(180deg, var(--paper-1) 0%, var(--paper-2) 100%)",
      }}
    >
      <WindowTitleBar title="角色工坊" />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <CharacterWizard />
      </div>
    </div>
  );
}

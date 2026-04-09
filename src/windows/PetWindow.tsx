import { useEffect, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

export default function PetWindow() {
  const handleDoubleClick = useCallback(async () => {
    await invoke("create_chat_window");
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    // Phase 1 会实现右键菜单
  }, []);

  useEffect(() => {
    // 确保窗口透明和置顶
    const win = getCurrentWindow();
    win.setAlwaysOnTop(true);
  }, []);

  return (
    <div
      data-tauri-drag-region
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "grab",
        background: "transparent",
      }}
    >
      {/* 桌宠占位 - Phase 1 替换为 Lottie */}
      <div
        className="animate-float"
        style={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: "radial-gradient(circle at 40% 35%, #00F0FF 0%, #0A8A94 40%, #0E1226 80%)",
          boxShadow: "0 0 24px rgba(0, 240, 255, 0.35), inset 0 0 20px rgba(255, 60, 172, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* 眼睛 */}
        <div style={{ display: "flex", gap: 16, marginTop: -8 }}>
          <div
            style={{
              width: 14,
              height: 18,
              borderRadius: "50%",
              background: "#FF3CAC",
              boxShadow: "0 0 8px rgba(255, 60, 172, 0.6)",
            }}
          />
          <div
            style={{
              width: 14,
              height: 18,
              borderRadius: "50%",
              background: "#FF3CAC",
              boxShadow: "0 0 8px rgba(255, 60, 172, 0.6)",
            }}
          />
        </div>
      </div>

      {/* 气泡提示 */}
      <div
        className="animate-bubble"
        style={{
          marginTop: 8,
          padding: "4px 12px",
          background: "rgba(14, 18, 38, 0.85)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(0, 240, 255, 0.2)",
          borderRadius: 12,
          fontSize: 11,
          fontFamily: "var(--font-body)",
          color: "var(--text-secondary)",
          textAlign: "center",
        }}
      >
        双击我开始规划今天~
      </div>
    </div>
  );
}

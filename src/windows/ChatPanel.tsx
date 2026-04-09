import { getCurrentWindow } from "@tauri-apps/api/window";

export default function ChatPanel() {
  const handleClose = () => {
    getCurrentWindow().close();
  };

  return (
    <div
      className="glass-panel"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 自定义标题栏 */}
      <div
        data-tauri-drag-region
        style={{
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          borderBottom: "1px solid rgba(0, 240, 255, 0.1)",
          cursor: "grab",
          flexShrink: 0,
        }}
      >
        <span
          className="heading-display"
          style={{ fontSize: 13, color: "var(--cyan-glow)", letterSpacing: "0.1em" }}
        >
          CYBERPET // CHAT
        </span>
        <button
          onClick={handleClose}
          style={{
            width: 20,
            height: 20,
            border: "none",
            background: "rgba(255, 60, 172, 0.15)",
            borderRadius: "50%",
            color: "var(--magenta-glow)",
            fontSize: 11,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "var(--transition-fast)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255, 60, 172, 0.35)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 60, 172, 0.15)";
          }}
        >
          ✕
        </button>
      </div>

      {/* 消息区域占位 */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: 13,
        }}
      >
        对话面板 — Phase 4 实现
      </div>

      {/* 输入区占位 */}
      <div
        style={{
          padding: 12,
          borderTop: "1px solid rgba(0, 240, 255, 0.08)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            background: "var(--bg-input)",
            border: "var(--border-glow)",
            borderRadius: "var(--radius-md)",
            padding: "10px 14px",
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          告诉我你今天要做什么...
        </div>
      </div>
    </div>
  );
}

import { getCurrentWindow } from "@tauri-apps/api/window";

export default function TaskPanel() {
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
          CYBERPET // TASKS
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

      {/* Tab 导航占位 */}
      <div
        style={{
          display: "flex",
          gap: 0,
          padding: "0 12px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
          flexShrink: 0,
        }}
      >
        {["日程", "任务", "复盘"].map((tab, i) => (
          <div
            key={tab}
            style={{
              padding: "8px 16px",
              fontSize: 12,
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              letterSpacing: "0.05em",
              color: i === 0 ? "var(--cyan-glow)" : "var(--text-muted)",
              borderBottom: i === 0 ? "2px solid var(--cyan-glow)" : "2px solid transparent",
              cursor: "pointer",
              transition: "var(--transition-fast)",
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* 内容区域占位 */}
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
        任务面板 — Phase 5 实现
      </div>
    </div>
  );
}

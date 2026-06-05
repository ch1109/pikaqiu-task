import type { ReactNode } from "react";

interface Tab {
  key: string;
  label: string;
  icon: ReactNode;
}

interface TabBarProps {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
}

/**
 * 高级简约 · 横向分段式 Tab（segmented control）
 *   浅灰 track + 白色浮起激活 pill（soft shadow）+ 宝蓝图标/文字。
 *   图标与文字并排，去掉旧版的竖排 + 下划线滑块。
 */
export default function TabBar({ tabs, activeKey, onChange }: TabBarProps) {
  return (
    <div style={{ padding: "12px 18px 8px" }}>
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 4,
          padding: 4,
          background: "var(--surface-shade)",
          border: "1px solid var(--rule-line-dim)",
          borderRadius: 14,
        }}
      >
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <button
              key={tab.key}
              className="btn"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.key)}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "8px 6px",
                borderRadius: 10,
                background: active ? "var(--surface-card)" : "transparent",
                color: active ? "var(--brand-600)" : "var(--ink-500)",
                boxShadow: active ? "var(--shadow-sm)" : "none",
                transition:
                  "background 220ms var(--ease-out-expo), color 180ms ease, box-shadow 220ms ease",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  color: active ? "var(--brand-600)" : "var(--ink-400)",
                  transition: "color 180ms ease",
                }}
              >
                {tab.icon}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 12.5,
                  fontWeight: active ? 600 : 500,
                  letterSpacing: "-0.005em",
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

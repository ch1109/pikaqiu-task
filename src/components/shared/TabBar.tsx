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

export default function TabBar({ tabs, activeKey, onChange }: TabBarProps) {
  const activeIndex = tabs.findIndex((t) => t.key === activeKey);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        gap: 2,
        padding: "10px 18px 0",
        flexShrink: 0,
        borderBottom: "1px solid var(--rule-line-dim)",
      }}
    >
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            className="btn"
            onClick={() => onChange(tab.key)}
            style={{
              flex: 1,
              padding: "10px 0 14px",
              borderRadius: 0,
              background: "transparent",
              color: active ? "var(--ink-900)" : "var(--ink-500)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                color: active ? "var(--ink-900)" : "var(--ink-400)",
                transition: "color 180ms ease",
              }}
            >
              {tab.icon}
            </span>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 12,
                letterSpacing: "-0.005em",
                color: active ? "var(--vermilion-600)" : "var(--ink-500)",
                fontWeight: active ? 600 : 500,
                transition: "color 180ms ease",
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}

      {/* 滑动指示器 —— 朱砂短线 */}
      <div
        style={{
          position: "absolute",
          bottom: -1,
          left: `calc(18px + ${activeIndex} * (100% - 36px) / ${tabs.length})`,
          width: `calc((100% - 36px) / ${tabs.length})`,
          height: 2,
          background: "var(--vermilion-600)",
          transition: "left 320ms var(--ease-out-expo)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

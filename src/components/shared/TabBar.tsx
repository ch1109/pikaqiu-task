interface Tab {
  key: string;
  label: string;
  icon: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
}

export default function TabBar({ tabs, activeKey, onChange }: TabBarProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        padding: "6px 12px",
        borderBottom: "1px solid rgba(0, 240, 255, 0.08)",
        flexShrink: 0,
      }}
    >
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              flex: 1,
              padding: "6px 0",
              border: "none",
              borderRadius: "var(--radius-sm)",
              background: active ? "rgba(0, 240, 255, 0.1)" : "transparent",
              color: active ? "var(--cyan-glow)" : "var(--text-secondary)",
              fontSize: 12,
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              letterSpacing: "0.06em",
              cursor: "pointer",
              transition: "var(--transition-fast)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
            }}
          >
            <span style={{ fontSize: 13 }}>{tab.icon}</span>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

import type { ConflictSuggestion } from "@/services/conflictDetector";

interface ConflictAlertProps {
  items: ConflictSuggestion[];
}

export default function ConflictAlert({ items }: ConflictAlertProps) {
  if (items.length === 0) return null;

  return (
    <div
      style={{
        margin: "8px 12px",
        padding: "8px 12px",
        borderRadius: "var(--radius-sm)",
        background: "rgba(255, 184, 0, 0.06)",
        border: "1px solid rgba(255, 184, 0, 0.2)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          color: "var(--amber-glow)",
          letterSpacing: "0.06em",
          marginBottom: 4,
        }}
      >
        ⚠ 时间冲突
      </div>
      {items.map((item, i) => (
        <div
          key={i}
          style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3 }}
        >
          <div>{item.conflict.message}</div>
          <div style={{ color: "var(--text-muted)", fontSize: 10, marginTop: 1 }}>
            → {item.suggestion}
          </div>
        </div>
      ))}
    </div>
  );
}

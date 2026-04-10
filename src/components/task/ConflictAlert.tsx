import type { ConflictSuggestion } from "@/services/conflictDetector";
import Icon from "@/components/shared/Icon";

interface ConflictAlertProps {
  items: ConflictSuggestion[];
}

export default function ConflictAlert({ items }: ConflictAlertProps) {
  if (items.length === 0) return null;

  return (
    <div
      className="animate-panel-enter"
      style={{
        margin: "14px 22px 0",
        padding: "14px 18px 16px",
        background: "var(--paper-0)",
        border: "1px solid var(--rule-line)",
        borderLeft: "3px solid var(--amber-600)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-paper-low)",
      }}
    >
      {/* 眉题行 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <span style={{ display: "inline-flex", color: "var(--amber-600)" }}>
          <Icon name="alert-triangle" size="xs" color="var(--amber-600)" />
        </span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 12,
            color: "var(--amber-600)",
            fontWeight: 600,
            letterSpacing: "-0.005em",
          }}
        >
          排程冲突
        </span>
        <span
          className="text-mono"
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: "var(--ink-400)",
          }}
        >
          ×{items.length}
        </span>
      </div>

      {items.map((item, i) => (
        <div
          key={i}
          style={{
            paddingTop: i === 0 ? 0 : 10,
            marginTop: i === 0 ? 0 : 10,
            borderTop: i === 0 ? "none" : "1px solid var(--rule-line)",
          }}
        >
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.55,
              color: "var(--ink-800)",
              fontWeight: 500,
            }}
          >
            {item.conflict.message}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              marginTop: 6,
              fontSize: 12,
              color: "var(--ink-500)",
              lineHeight: 1.6,
            }}
          >
            <span style={{ display: "inline-flex", color: "var(--amber-600)" }}>
              <Icon name="arrow-right" size="xs" color="var(--amber-600)" accent />
            </span>
            <span>{item.suggestion}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

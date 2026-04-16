import { useState, type CSSProperties } from "react";
import Icon, { type IconName } from "@/components/shared/Icon";

interface Props {
  icon: IconName;
  label: string;
  variant: "primary" | "ghost" | "success";
  onClick: () => void;
}

const baseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  letterSpacing: "0.02em",
  cursor: "pointer",
  transition:
    "transform 140ms ease, box-shadow 140ms ease, background 140ms ease, color 140ms ease",
  lineHeight: 1,
};

const primaryStyle: CSSProperties = {
  ...baseStyle,
  background:
    "linear-gradient(180deg, var(--vermilion-600) 0%, var(--vermilion-700) 100%)",
  color: "#fff",
  border: "1px solid transparent",
  boxShadow:
    "0 2px 6px rgba(230, 57, 70, 0.24), inset 0 1px 0 rgba(255,255,255,0.18)",
};

const ghostStyle: CSSProperties = {
  ...baseStyle,
  background: "transparent",
  color: "var(--ink-600)",
  border: "1px solid var(--rule-line)",
};

const successStyle: CSSProperties = {
  ...baseStyle,
  background:
    "linear-gradient(180deg, #34D399 0%, var(--moss-600) 100%)",
  color: "#fff",
  border: "1px solid transparent",
  boxShadow:
    "0 2px 6px rgba(16, 185, 129, 0.30), inset 0 1px 0 rgba(255,255,255,0.22)",
};

export default function TaskActionButton({
  icon,
  label,
  variant,
  onClick,
}: Props) {
  const [hover, setHover] = useState(false);
  const base =
    variant === "primary"
      ? primaryStyle
      : variant === "success"
        ? successStyle
        : ghostStyle;

  const hoverOverride: CSSProperties = hover
    ? variant === "primary"
      ? {
          transform: "translateY(-1px)",
          boxShadow:
            "0 4px 10px rgba(230, 57, 70, 0.32), inset 0 1px 0 rgba(255,255,255,0.24)",
        }
      : variant === "success"
        ? {
            transform: "translateY(-1px)",
            boxShadow:
              "0 4px 12px rgba(16, 185, 129, 0.42), inset 0 1px 0 rgba(255,255,255,0.26)",
          }
        : {
            transform: "translateY(-1px)",
            background: "var(--vermilion-100)",
            color: "var(--vermilion-600)",
            border: "1px solid var(--vermilion-200)",
          }
    : {};

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={label}
      style={{ ...base, ...hoverOverride }}
    >
      <Icon name={icon} size="xs" fill={icon === "play"} color="currentColor" />
      {label}
    </button>
  );
}

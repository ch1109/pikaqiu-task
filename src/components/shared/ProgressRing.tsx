interface ProgressRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  label?: string;
}

export default function ProgressRing({
  percent,
  size = 72,
  strokeWidth = 4,
  color = "var(--accent-primary)",
  bgColor = "rgba(26, 26, 46, 0.08)",
  label,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(percent, 100) / 100);

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 600ms cubic-bezier(0.4, 0, 0.2, 1)",
            filter:
              percent >= 100
                ? "drop-shadow(0 1px 4px rgba(82, 121, 111, 0.35))"
                : "drop-shadow(0 1px 3px rgba(230, 57, 70, 0.2))",
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          fontSize: label ? 10 : 14,
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
          color: percent >= 100 ? "var(--accent-success)" : "var(--text-primary)",
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        {label || `${Math.round(percent)}%`}
      </div>
    </div>
  );
}

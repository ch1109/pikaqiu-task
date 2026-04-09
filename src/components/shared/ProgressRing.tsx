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
  color = "var(--cyan-glow)",
  bgColor = "rgba(0, 240, 255, 0.1)",
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
                ? "drop-shadow(0 0 6px rgba(57, 255, 20, 0.5))"
                : `drop-shadow(0 0 4px ${color === "var(--cyan-glow)" ? "rgba(0, 240, 255, 0.3)" : "currentColor"})`,
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          fontSize: label ? 10 : 14,
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
          color: percent >= 100 ? "var(--neon-green)" : "var(--text-primary)",
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        {label || `${Math.round(percent)}%`}
      </div>
    </div>
  );
}

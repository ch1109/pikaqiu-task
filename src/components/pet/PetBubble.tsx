interface PetBubbleProps {
  text: string;
}

export default function PetBubble({ text }: PetBubbleProps) {
  return (
    <div
      className="animate-bubble"
      style={{
        maxWidth: 170,
        padding: "6px 14px",
        background: "rgba(14, 18, 38, 0.9)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(0, 240, 255, 0.25)",
        borderRadius: 14,
        fontSize: 12,
        fontFamily: "var(--font-body)",
        color: "var(--text-secondary)",
        textAlign: "center",
        lineHeight: 1.4,
        boxShadow: "0 2px 12px rgba(0, 240, 255, 0.1)",
        pointerEvents: "none",
      }}
    >
      {text}
    </div>
  );
}

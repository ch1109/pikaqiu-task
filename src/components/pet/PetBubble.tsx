import { useState, useEffect } from "react";

interface PetBubbleProps {
  text: string;
  fading?: boolean;
}

const kaomoji: [RegExp, string][] = [
  [/规划|计划|安排/, "(ﾉ◕ヮ◕)ﾉ "],
  [/完成|做到|搞定/, "✧(≖ ◡ ≖✿) "],
  [/休息|睡|累/, "(˘ω˘) "],
  [/加油|努力|冲/, "ᕙ(⇀‸↼)ᕗ "],
  [/打开|正在/, "(◕ᴗ◕✿) "],
];

function getKaomoji(text: string): string {
  for (const [pattern, face] of kaomoji) {
    if (pattern.test(text)) return face;
  }
  return "";
}

function useTypewriter(text: string, speed = 35) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  return displayed;
}

export default function PetBubble({ text, fading }: PetBubbleProps) {
  const prefix = getKaomoji(text);
  const fullText = prefix + text;
  const displayed = useTypewriter(fullText, 30);

  return (
    <div
      className={fading ? "animate-bubble-exit" : "animate-bubble"}
      style={{
        maxWidth: 188,
        padding: "10px 16px",
        background: "var(--paper-0)",
        border: "1px solid var(--rule-line)",
        borderRadius: "var(--radius-lg)",
        fontSize: 12,
        fontFamily: "var(--font-body)",
        color: "var(--ink-800)",
        textAlign: "center",
        lineHeight: 1.55,
        boxShadow:
          "0 6px 24px rgba(46, 111, 235, 0.14), 0 2px 8px rgba(15, 23, 42, 0.06)",
        pointerEvents: "none",
      }}
    >
      {displayed}
      <span
        style={{
          display: "inline-block",
          width: 1,
          height: 12,
          background: "var(--accent-primary)",
          marginLeft: 1,
          opacity: displayed.length < fullText.length ? 1 : 0,
          animation: "neon-pulse 1s ease-in-out infinite",
          verticalAlign: "middle",
        }}
      />
    </div>
  );
}

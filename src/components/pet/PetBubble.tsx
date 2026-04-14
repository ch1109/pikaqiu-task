import { useState, useEffect, type CSSProperties } from "react";
import type { BubbleAction } from "@/stores/usePetStore";
import Icon from "@/components/shared/Icon";

interface PetBubbleProps {
  text: string;
  fading?: boolean;
  actions?: BubbleAction[] | null;
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

const primaryBtnBase: CSSProperties = {
  background:
    "linear-gradient(180deg, var(--vermilion-600) 0%, var(--vermilion-700) 100%)",
  color: "#fff",
  border: "none",
  borderRadius: 999,
  padding: "7px 16px",
  fontSize: 12,
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  cursor: "pointer",
  letterSpacing: "0.04em",
  boxShadow:
    "0 3px 10px rgba(46, 111, 235, 0.32), inset 0 1px 0 rgba(255,255,255,0.18)",
  transition: "transform 140ms ease, box-shadow 140ms ease",
};

const ghostBtnBase: CSSProperties = {
  background: "var(--paper-3)",
  color: "var(--ink-700)",
  border: "1px solid var(--rule-line-strong)",
  borderRadius: 999,
  padding: "7px 14px",
  fontSize: 12,
  fontFamily: "var(--font-body)",
  fontWeight: 500,
  cursor: "pointer",
  letterSpacing: "0.04em",
  transition: "background 140ms ease, color 140ms ease, transform 140ms ease",
};

function ActionButton({ action }: { action: BubbleAction }) {
  const [hover, setHover] = useState(false);
  const isGhost = action.variant === "ghost";
  const base = isGhost ? ghostBtnBase : primaryBtnBase;

  const hoverStyle: CSSProperties = hover
    ? isGhost
      ? {
          background: "var(--vermilion-100)",
          color: "var(--vermilion-600)",
          transform: "translateY(-1px)",
        }
      : {
          transform: "translateY(-1px)",
          boxShadow:
            "0 5px 14px rgba(46, 111, 235, 0.42), inset 0 1px 0 rgba(255,255,255,0.24)",
        }
    : {};

  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onMouseDown={(e) => (e.currentTarget.style.transform = "translateY(0)")}
      style={{ ...base, ...hoverStyle }}
      onClick={action.onClick}
    >
      {action.label}
    </button>
  );
}

export default function PetBubble({ text, fading, actions }: PetBubbleProps) {
  const hasActions = !!actions?.length;
  // 提醒文案池已内嵌颜文字，普通气泡才做关键词联想
  const prefix = hasActions ? "" : getKaomoji(text);
  const fullText = prefix + text;
  const displayed = useTypewriter(fullText, 30);
  const typingDone = displayed.length >= fullText.length;

  return (
    <div
      className={fading ? "animate-bubble-exit" : "animate-bubble"}
      style={{
        position: "relative",
        maxWidth: 272,
        minWidth: 180,
        padding: hasActions ? "14px 18px 14px" : "11px 18px",
        background:
          "linear-gradient(180deg, #FFFFFF 0%, var(--paper-3) 100%)",
        border: "1px solid var(--rule-line)",
        borderRadius: 22,
        fontSize: 13,
        fontFamily: "var(--font-body)",
        color: "var(--ink-800)",
        textAlign: "center",
        lineHeight: 1.65,
        wordBreak: "keep-all",
        overflowWrap: "normal",
        boxShadow:
          "0 12px 32px rgba(46, 111, 235, 0.16), 0 4px 12px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
        pointerEvents: hasActions ? "auto" : "none",
      }}
    >
      {hasActions && (
        <span
          style={{
            position: "absolute",
            top: 10,
            right: 12,
            color: "var(--amber-600)",
            filter: "drop-shadow(0 0 4px rgba(245, 158, 11, 0.45))",
            animation: "bell-swing 1.2s ease-in-out infinite",
            display: "inline-flex",
          }}
        >
          <Icon name="bell-ring" size="sm" accent />
        </span>
      )}

      <div
        style={{
          paddingRight: hasActions ? 20 : 0,
          whiteSpace: "pre-wrap",
        }}
      >
        {displayed}
        <span
          style={{
            display: "inline-block",
            width: 1,
            height: 13,
            background: "var(--vermilion-600)",
            marginLeft: 1,
            opacity: typingDone ? 0 : 1,
            animation: "neon-pulse 1s ease-in-out infinite",
            verticalAlign: "middle",
          }}
        />
      </div>

      {hasActions && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 10,
            marginTop: 12,
            opacity: typingDone ? 1 : 0,
            transform: typingDone ? "translateY(0)" : "translateY(6px)",
            transition: "opacity 220ms ease, transform 260ms ease",
            pointerEvents: typingDone ? "auto" : "none",
          }}
        >
          {actions!.map((a) => (
            <ActionButton key={a.id} action={a} />
          ))}
        </div>
      )}

      {/* 底部三角指针朝桌宠 */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          bottom: -6,
          transform: "translateX(-50%)",
          width: 12,
          height: 6,
          background:
            "linear-gradient(180deg, var(--paper-3) 0%, var(--paper-3) 100%)",
          clipPath: "polygon(50% 100%, 0 0, 100% 0)",
          borderLeft: "1px solid var(--rule-line)",
          borderRight: "1px solid var(--rule-line)",
          filter: "drop-shadow(0 2px 3px rgba(46, 111, 235, 0.08))",
        }}
      />
    </div>
  );
}

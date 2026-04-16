import type { IdleAction, PetState } from "@/types/pet";

interface PetPropsProps {
  state: PetState;
  idleAction: IdleAction | null;
}

/**
 * 桌宠配件层：状态级道具（彩屑/乌云/问号/光环）与
 * 待机小动作级道具（帽子/镜子/爱心星星/音符）。
 * 返回一组 SVG 元素，由 PetSprite 的主 <svg> 内联承载。
 */
export default function PetProps({ state, idleAction }: PetPropsProps) {
  return (
    <>
      {state === "celebrating" && <ConfettiBurst />}
      {state === "curious" && <QuestionMark />}
      {state === "sulking" && <RainCloud />}
      {state === "focused" && <FocusHalo />}
      {state === "idle" && idleAction === "hat" && <BeretHat />}
      {state === "idle" && idleAction === "mirror" && <HandMirror />}
      {state === "idle" && idleAction === "sparkle" && <HeartSparkles />}
      {state === "idle" && idleAction === "dance" && <MusicNotes />}
      {state === "idle" && idleAction === "yawn" && <YawnPuff />}
    </>
  );
}

/* ============ 状态级道具 ============ */

function ConfettiBurst() {
  const pieces = [
    { x: 60, y: 40, color: "#FF3CAC", rot: -20, delay: 0 },
    { x: 78, y: 28, color: "#00F0FF", rot: 15, delay: 0.15 },
    { x: 100, y: 22, color: "#FFD23F", rot: -5, delay: 0.08 },
    { x: 122, y: 28, color: "#8FD88F", rot: 25, delay: 0.22 },
    { x: 140, y: 40, color: "#A287FF", rot: -12, delay: 0.05 },
    { x: 50, y: 70, color: "#FFB4D8", rot: 30, delay: 0.3 },
    { x: 150, y: 70, color: "#7ED7FF", rot: -25, delay: 0.12 },
    { x: 100, y: 52, color: "#FF9966", rot: 8, delay: 0.2 },
  ];
  return (
    <g className="pet-prop-confetti">
      {pieces.map((p, i) => (
        <rect
          key={i}
          className="confetti-piece"
          x={p.x - 3}
          y={p.y - 5}
          width={6}
          height={10}
          rx={1.4}
          fill={p.color}
          transform={`rotate(${p.rot} ${p.x} ${p.y})`}
          style={{ animationDelay: `${p.delay}s` }}
        />
      ))}
    </g>
  );
}

function QuestionMark() {
  return (
    <g className="pet-prop-question">
      <circle cx="138" cy="56" r="14" fill="white" stroke="#2E6FEB" strokeWidth="2.4" />
      <text
        x="138"
        y="62"
        textAnchor="middle"
        fontSize="18"
        fontWeight="800"
        fill="#2E6FEB"
        fontFamily="var(--font-display, 'Rajdhani', sans-serif)"
      >
        ?
      </text>
    </g>
  );
}

function RainCloud() {
  return (
    <g className="pet-prop-cloud">
      <ellipse cx="100" cy="42" rx="28" ry="12" fill="#8B95A8" opacity="0.85" />
      <ellipse cx="84" cy="46" rx="14" ry="10" fill="#8B95A8" opacity="0.85" />
      <ellipse cx="116" cy="46" rx="14" ry="10" fill="#8B95A8" opacity="0.85" />
      <ellipse cx="100" cy="36" rx="16" ry="10" fill="#A7B0C0" opacity="0.9" />
      <line className="rain-drop rain-drop-1" x1="88" y1="56" x2="86" y2="68" stroke="#6DA8E0" strokeWidth="2.2" strokeLinecap="round" />
      <line className="rain-drop rain-drop-2" x1="100" y1="58" x2="98" y2="72" stroke="#6DA8E0" strokeWidth="2.2" strokeLinecap="round" />
      <line className="rain-drop rain-drop-3" x1="112" y1="56" x2="110" y2="68" stroke="#6DA8E0" strokeWidth="2.2" strokeLinecap="round" />
    </g>
  );
}

function FocusHalo() {
  return (
    <g className="pet-prop-halo">
      <ellipse
        cx="100"
        cy="30"
        rx="34"
        ry="7"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.4"
        opacity="0.95"
      />
      <ellipse
        cx="100"
        cy="30"
        rx="38"
        ry="9"
        fill="none"
        stroke="#00F0FF"
        strokeWidth="1.2"
        opacity="0.5"
      />
    </g>
  );
}

/* ============ 待机小动作道具 ============ */

function BeretHat() {
  return (
    <g className="pet-prop-hat">
      {/* 帽檐 */}
      <ellipse cx="100" cy="56" rx="46" ry="10" fill="#B5172D" />
      {/* 帽身 */}
      <ellipse cx="100" cy="44" rx="38" ry="16" fill="#D8203A" />
      {/* 帽尖小茎 */}
      <circle cx="118" cy="30" r="4" fill="#8B0F22" />
      <line x1="118" y1="30" x2="124" y2="22" stroke="#8B0F22" strokeWidth="2" strokeLinecap="round" />
      {/* 高光 */}
      <ellipse cx="88" cy="38" rx="12" ry="5" fill="#F05369" opacity="0.65" />
    </g>
  );
}

function HandMirror() {
  return (
    <g className="pet-prop-mirror">
      {/* 手柄 */}
      <rect x="150" y="132" width="5" height="22" rx="2" fill="#D4AF37" transform="rotate(18 152 143)" />
      {/* 镜框 */}
      <circle cx="160" cy="120" r="14" fill="#D4AF37" />
      <circle cx="160" cy="120" r="11" fill="#E8F3FA" />
      {/* 镜面闪光 */}
      <path d="M 154 115 L 158 119 M 156 113 L 162 119" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
      <circle cx="165" cy="116" r="1.4" fill="white" />
    </g>
  );
}

function HeartSparkles() {
  return (
    <g className="pet-prop-sparkles">
      <text className="spark spark-1" x="70" y="52" fontSize="16" fill="#FF3CAC">♥</text>
      <text className="spark spark-2" x="132" y="44" fontSize="14" fill="#FFD23F">✦</text>
      <text className="spark spark-3" x="100" y="32" fontSize="18" fill="#00F0FF">✧</text>
      <text className="spark spark-4" x="148" y="70" fontSize="12" fill="#FF9FD1">♥</text>
      <text className="spark spark-5" x="58" y="74" fontSize="13" fill="#8FE3FF">✦</text>
    </g>
  );
}

function MusicNotes() {
  return (
    <g className="pet-prop-notes">
      <text className="note note-1" x="54" y="104" fontSize="18" fontWeight="700" fill="#A287FF">♪</text>
      <text className="note note-2" x="144" y="96" fontSize="16" fontWeight="700" fill="#FF3CAC">♫</text>
      <text className="note note-3" x="60" y="70" fontSize="14" fontWeight="700" fill="#00C2D1">♪</text>
    </g>
  );
}

function YawnPuff() {
  return (
    <g className="pet-prop-yawn">
      <ellipse className="yawn-puff yawn-puff-1" cx="132" cy="120" rx="5" ry="4" fill="#D8E8F5" opacity="0.75" />
      <ellipse className="yawn-puff yawn-puff-2" cx="140" cy="110" rx="4" ry="3" fill="#E4EFF8" opacity="0.65" />
      <ellipse className="yawn-puff yawn-puff-3" cx="150" cy="104" rx="3" ry="2.5" fill="#F0F5FA" opacity="0.55" />
    </g>
  );
}

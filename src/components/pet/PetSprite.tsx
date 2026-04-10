import type { PetState } from "@/types/pet";

const glowColors: Record<PetState, string> = {
  idle: "rgba(255, 215, 0, 0.35)",
  thinking: "rgba(29, 53, 87, 0.28)",
  encourage: "rgba(230, 57, 70, 0.3)",
  rest: "rgba(125, 91, 166, 0.28)",
};

const stateClass: Record<PetState, string> = {
  idle: "pika-state-idle",
  thinking: "pika-state-thinking",
  encourage: "pika-state-encourage",
  rest: "pika-state-rest",
};

interface PetSpriteProps {
  state: PetState;
  size?: number;
}

export default function PetSprite({ state, size = 140 }: PetSpriteProps) {
  const isResting = state === "rest";

  return (
    <div
      className={stateClass[state]}
      style={{
        width: size,
        height: size,
        position: "relative",
        pointerEvents: "none",
      }}
    >
      <svg
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "100%", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="pikaBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFDC32" />
            <stop offset="100%" stopColor="#FFE968" />
          </linearGradient>
          <radialGradient id="pikaEye">
            <stop offset="0%" stopColor="#1a1a2e" />
            <stop offset="100%" stopColor="#2A2A2A" />
          </radialGradient>
          <filter id="pikaBlush">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <filter id="pikaGlow">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>

        {/* 发光 */}
        <ellipse
          className="pika-glow"
          cx="100" cy="118" rx="72" ry="62"
          fill={glowColors[state]}
          filter="url(#pikaGlow)"
        />

        {/* 尾巴 */}
        <g className="pika-tail">
          <polygon
            points="140,110 156,92 151,96 174,54 161,74 167,68 147,102"
            fill="#FFDC32"
          />
          <polygon
            points="140,110 147,102 144,108"
            fill="var(--pika-brown)" opacity="0.3"
          />
        </g>

        {/* 脚掌 */}
        <ellipse cx="80" cy="156" rx="14" ry="6" fill="#FFDC32" />
        <ellipse cx="120" cy="156" rx="14" ry="6" fill="#FFDC32" />

        {/* 身体 */}
        <ellipse cx="100" cy="116" rx="47" ry="44" fill="url(#pikaBody)" />

        {/* 肚皮高光 */}
        <ellipse cx="100" cy="130" rx="30" ry="20" fill="#FFF5B8" opacity="0.5" />

        {/* 背部条纹 */}
        <path d="M 78,140 Q 100,147 122,140" fill="none" stroke="var(--pika-brown)" strokeWidth="3.5" strokeLinecap="round" opacity="0.28" />
        <path d="M 83,146 Q 100,152 117,146" fill="none" stroke="var(--pika-brown)" strokeWidth="2.8" strokeLinecap="round" opacity="0.2" />

        {/* 左耳 */}
        <path d="M 74,86 C 62,58 52,34 50,16 C 58,34 74,64 94,82 Z" fill="var(--pika-yellow)" />
        <path d="M 50,16 C 53,28 57,35 62,40 L 55,30 Z" fill="var(--pika-dark)" />

        {/* 右耳 */}
        <path d="M 126,86 C 138,58 148,34 150,16 C 142,34 126,64 106,82 Z" fill="var(--pika-yellow)" />
        <path d="M 150,16 C 147,28 143,35 138,40 L 145,30 Z" fill="var(--pika-dark)" />

        {/* 腮红 */}
        <ellipse cx="66" cy="122" rx="12" ry="9" fill="#FF8FA3" opacity="0.5" filter="url(#pikaBlush)" />
        <ellipse cx="134" cy="122" rx="12" ry="9" fill="#FF8FA3" opacity="0.5" filter="url(#pikaBlush)" />

        {/* 眼睛 */}
        {isResting ? (
          <g className="pika-rest-eyes">
            <path d="M 76,108 Q 85,115 94,108" fill="none" stroke="var(--pika-dark)" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M 106,108 Q 115,115 124,108" fill="none" stroke="var(--pika-dark)" strokeWidth="2.8" strokeLinecap="round" />
          </g>
        ) : (
          <g className="pika-eyes">
            <circle cx="85" cy="108" r="8.5" fill="url(#pikaEye)" />
            <circle cx="88" cy="105" r="3.2" fill="white" />
            <circle cx="82.5" cy="111" r="1.4" fill="white" opacity="0.55" />
            <circle cx="115" cy="108" r="8.5" fill="url(#pikaEye)" />
            <circle cx="118" cy="105" r="3.2" fill="white" />
            <circle cx="112.5" cy="111" r="1.4" fill="white" opacity="0.55" />
          </g>
        )}

        {/* 鼻子 */}
        <path d="M 100,117.5 L 98.2,120.5 L 101.8,120.5 Z" fill="#555" />

        {/* 嘴巴 */}
        {state === "idle" && (
          <path d="M 92,124 Q 96,129 100,124 Q 104,129 108,124" fill="none" stroke="var(--pika-dark)" strokeWidth="1.8" strokeLinecap="round" />
        )}
        {state === "thinking" && (
          <ellipse cx="100" cy="126" rx="4" ry="3.2" fill="none" stroke="var(--pika-dark)" strokeWidth="1.6" />
        )}
        {state === "encourage" && (
          <path d="M 88,122 Q 100,138 112,122" fill="rgba(60,30,30,0.1)" stroke="var(--pika-dark)" strokeWidth="2" strokeLinecap="round" />
        )}
        {state === "rest" && (
          <path d="M 96,124 Q 100,126.5 104,124" fill="none" stroke="var(--pika-dark)" strokeWidth="1.3" strokeLinecap="round" />
        )}

        {/* ZZZ */}
        {isResting && (
          <>
            <text className="pika-zzz-1" x="136" y="88" fontSize="15" fill="var(--amber-600)" fontFamily="var(--font-display)" fontWeight="700">Z</text>
            <text className="pika-zzz-2" x="147" y="73" fontSize="12" fill="var(--amber-600)" fontFamily="var(--font-display)" fontWeight="700">z</text>
            <text className="pika-zzz-3" x="155" y="60" fontSize="9" fill="var(--amber-600)" fontFamily="var(--font-display)" fontWeight="700">z</text>
          </>
        )}
      </svg>
    </div>
  );
}

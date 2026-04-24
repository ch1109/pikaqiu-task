/**
 * 默认 Pika 静态缩略 —— 角色库首卡用。
 *
 * 从 PetSprite 抽出 idle 状态最小子集：
 * - 不读 useCharacterStore（首卡永远显示默认形象）
 * - 不绑定 pika-state-* / pika-idle-* 动画 class
 * - 省略 glow / ZZZ / PetProps 配件
 */
export default function DefaultCharacterThumb({ size = 90 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: size, height: size, overflow: "visible" }}
    >
      <defs>
        <linearGradient id="defaultPikaBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFDC32" />
          <stop offset="100%" stopColor="#FFE968" />
        </linearGradient>
        <radialGradient id="defaultPikaEye">
          <stop offset="0%" stopColor="#1a1a2e" />
          <stop offset="100%" stopColor="#2A2A2A" />
        </radialGradient>
        <filter id="defaultPikaBlush">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* 尾巴 */}
      <polygon
        points="140,110 156,92 151,96 174,54 161,74 167,68 147,102"
        fill="#FFDC32"
      />

      {/* 脚 */}
      <ellipse cx="80" cy="156" rx="14" ry="6" fill="#FFDC32" />
      <ellipse cx="120" cy="156" rx="14" ry="6" fill="#FFDC32" />

      {/* 身体 */}
      <ellipse cx="100" cy="116" rx="47" ry="44" fill="url(#defaultPikaBody)" />
      <ellipse cx="100" cy="130" rx="30" ry="20" fill="#FFF5B8" opacity="0.5" />

      {/* 耳朵 */}
      <path
        d="M 74,86 C 62,58 52,34 50,16 C 58,34 74,64 94,82 Z"
        fill="var(--pika-yellow)"
      />
      <path d="M 50,16 C 53,28 57,35 62,40 L 55,30 Z" fill="var(--pika-dark)" />
      <path
        d="M 126,86 C 138,58 148,34 150,16 C 142,34 126,64 106,82 Z"
        fill="var(--pika-yellow)"
      />
      <path
        d="M 150,16 C 147,28 143,35 138,40 L 145,30 Z"
        fill="var(--pika-dark)"
      />

      {/* 腮红 */}
      <ellipse
        cx="66"
        cy="122"
        rx="12"
        ry="9"
        fill="#FF8FA3"
        opacity="0.5"
        filter="url(#defaultPikaBlush)"
      />
      <ellipse
        cx="134"
        cy="122"
        rx="12"
        ry="9"
        fill="#FF8FA3"
        opacity="0.5"
        filter="url(#defaultPikaBlush)"
      />

      {/* 眼睛 */}
      <circle cx="85" cy="108" r="8.5" fill="url(#defaultPikaEye)" />
      <circle cx="88" cy="105" r="3.2" fill="white" />
      <circle cx="115" cy="108" r="8.5" fill="url(#defaultPikaEye)" />
      <circle cx="118" cy="105" r="3.2" fill="white" />

      {/* 鼻子 */}
      <path d="M 100,117.5 L 98.2,120.5 L 101.8,120.5 Z" fill="#555" />

      {/* 嘴巴 */}
      <path
        d="M 92,124 Q 96,129 100,124 Q 104,129 108,124"
        fill="none"
        stroke="var(--pika-dark)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

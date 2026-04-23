import { useEffect, useRef, useState } from "react";
import type { LoopMode } from "@/types/character";

interface Props {
  /** 帧的 b64（不含 data URL 前缀） */
  frames: string[];
  fps: number;
  loop: LoopMode;
  size?: number;
}

/**
 * 纯前端 PNG 帧播放器 —— 向导 Step 5 预览用。
 * 正式 PetWindow 渲染器（SpriteRenderer）会复用这套思路，但直接读 Rust 返回的 data URL。
 */
export default function FramePreviewPlayer({
  frames,
  fps,
  loop,
  size = 128,
}: Props) {
  const [idx, setIdx] = useState(0);
  const dir = useRef<1 | -1>(1);

  useEffect(() => {
    setIdx(0);
    dir.current = 1;
  }, [frames]);

  useEffect(() => {
    if (frames.length === 0) return;
    if (frames.length === 1) return;

    const interval = 1000 / Math.max(1, fps);
    const id = window.setInterval(() => {
      setIdx((cur) => {
        if (loop === "once") {
          if (cur >= frames.length - 1) return cur;
          return cur + 1;
        }
        if (loop === "pingpong") {
          const nxt = cur + dir.current;
          if (nxt >= frames.length - 1) dir.current = -1;
          else if (nxt <= 0) dir.current = 1;
          return Math.max(0, Math.min(frames.length - 1, nxt));
        }
        // loop
        return (cur + 1) % frames.length;
      });
    }, interval);
    return () => window.clearInterval(id);
  }, [frames, fps, loop]);

  if (frames.length === 0) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 14,
          background: "var(--paper-3)",
          display: "grid",
          placeItems: "center",
          color: "var(--ink-300)",
          fontSize: 11,
        }}
      >
        无帧
      </div>
    );
  }

  return (
    <img
      src={`data:image/png;base64,${frames[idx]}`}
      alt={`frame ${idx}`}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        borderRadius: 14,
        background:
          "conic-gradient(var(--ink-100) 0 25%, var(--paper-0) 0 50%, var(--ink-100) 0 75%, var(--paper-0) 0) 0 0 / 14px 14px",
      }}
    />
  );
}

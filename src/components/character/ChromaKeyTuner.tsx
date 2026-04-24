import { useEffect, useRef, useState } from "react";
import {
  applyChromaKeyToImageData,
  parseColor,
} from "@/services/image/chromaKey";

interface Props {
  videoFile: File;
  onChange: (cfg: { color: string; tolerance: number }) => void;
}

/**
 * 色键可视化调参：点击首帧背景采样 → 滑动容差 → 实时预览抠色效果。
 *
 * 布局：左画布（原始首帧）+ 右画布（抠色预览，棋盘格透明底）
 * 尺寸按视频宽高比自适应，上限 240×140，避免拉伸。
 */

const MAX_W = 240;
const MAX_H = 140;

const DEFAULT_COLOR = "#00FF00";
const DEFAULT_TOL = 80;

export default function ChromaKeyTuner({ videoFile, onChange }: Props) {
  const origRef = useRef<HTMLCanvasElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [tolerance, setTolerance] = useState(DEFAULT_TOL);
  const [dim, setDim] = useState<{ w: number; h: number }>({
    w: MAX_W,
    h: MAX_H,
  });

  useEffect(() => {
    setReady(false);
    const origCv = origRef.current;
    const prevCv = previewRef.current;
    if (!origCv || !prevCv) return;

    const url = URL.createObjectURL(videoFile);
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    const onMeta = () => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;
      // contain 进 240×140
      const scale = Math.min(MAX_W / vw, MAX_H / vh);
      const w = Math.round(vw * scale);
      const h = Math.round(vh * scale);
      origCv.width = w;
      origCv.height = h;
      prevCv.width = w;
      prevCv.height = h;
      setDim({ w, h });
      // 触发 seek 到首帧，部分浏览器不 fire seeked 当 currentTime=0
      video.currentTime = Math.min(0.01, (video.duration || 1) - 0.001);
    };

    const onSeeked = () => {
      const ctx = origCv.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, origCv.width, origCv.height);
      setReady(true);
    };

    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("seeked", onSeeked);

    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("seeked", onSeeked);
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
  }, [videoFile]);

  // color / tolerance 变化 → 重算预览 + 通知父组件
  useEffect(() => {
    if (!ready) return;
    const origCv = origRef.current;
    const prevCv = previewRef.current;
    if (!origCv || !prevCv) return;
    const origCtx = origCv.getContext("2d", { willReadFrequently: true });
    const prevCtx = prevCv.getContext("2d");
    if (!origCtx || !prevCtx) return;

    const img = origCtx.getImageData(0, 0, origCv.width, origCv.height);
    applyChromaKeyToImageData(img.data, parseColor(color), tolerance, true);
    prevCtx.clearRect(0, 0, prevCv.width, prevCv.height);
    prevCtx.putImageData(img, 0, 0);

    onChange({ color, tolerance });
  }, [color, tolerance, ready, onChange]);

  const handlePick: React.MouseEventHandler<HTMLCanvasElement> = (e) => {
    const cv = origRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const rect = cv.getBoundingClientRect();
    const sx = cv.width / rect.width;
    const sy = cv.height / rect.height;
    const x = Math.max(0, Math.min(cv.width - 1, Math.round((e.clientX - rect.left) * sx)));
    const y = Math.max(0, Math.min(cv.height - 1, Math.round((e.clientY - rect.top) * sy)));
    const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
    const hex = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
    setColor(hex);
  };

  const checkerStyle: React.CSSProperties = {
    background:
      "conic-gradient(var(--ink-100) 0 25%, var(--paper-0) 0 50%, var(--ink-100) 0 75%, var(--paper-0) 0) 0 0 / 12px 12px",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "0 0 auto" }}>
          <div style={{ fontSize: 10, color: "var(--ink-500)" }}>原始首帧（点击取色）</div>
          <canvas
            ref={origRef}
            onClick={handlePick}
            style={{
              width: dim.w,
              height: dim.h,
              cursor: ready ? "crosshair" : "wait",
              borderRadius: 6,
              border: "1px solid var(--rule-line)",
              background: "var(--paper-3)",
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "0 0 auto" }}>
          <div style={{ fontSize: 10, color: "var(--ink-500)" }}>抠色预览</div>
          <div
            style={{
              ...checkerStyle,
              borderRadius: 6,
              border: "1px solid var(--rule-line)",
              width: dim.w,
              height: dim.h,
            }}
          >
            <canvas
              ref={previewRef}
              style={{ width: dim.w, height: dim.h, display: "block" }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11 }}>
        <span style={{ color: "var(--ink-500)" }}>背景色</span>
        <span
          style={{
            display: "inline-block",
            width: 16,
            height: 16,
            borderRadius: 4,
            border: "1px solid var(--rule-line)",
            background: color,
          }}
        />
        <code style={{ color: "var(--ink-700)", fontFamily: "var(--font-mono)" }}>{color}</code>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value.toUpperCase())}
          style={{ width: 28, height: 22, padding: 0, border: "none", background: "transparent", cursor: "pointer" }}
          title="或直接选色"
        />
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11 }}>
        <span style={{ color: "var(--ink-500)", minWidth: 40 }}>容差</span>
        <input
          type="range"
          min={10}
          max={200}
          step={5}
          value={tolerance}
          onChange={(e) => setTolerance(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ color: "var(--ink-700)", minWidth: 28, textAlign: "right" }}>{tolerance}</span>
      </label>
    </div>
  );
}

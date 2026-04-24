import { useEffect, useRef } from "react";
import {
  applyChromaKeyToImageData,
  parseColor,
} from "@/services/image/chromaKey";

interface Props {
  src: string;
  size: number;
  loop: boolean;
  /** 色键目标色（如 "#00FF00"）。默认 #00FF00 —— AI Veo 视频链路 */
  keyColor?: string;
  /** 欧氏距离阈值 0-255。默认 80，适配 Veo 绿色渐变；本地纯色可调小 */
  tolerance?: number;
  /** 是否抠除近黑像素（Veo 首尾 fade-to-black 需要；本地视频通常关） */
  clipBlack?: boolean;
  /**
   * 视频内容填充策略。
   *   - cover（默认）：按长边填满 canvas，超出部分被 clip；适配 AI 视频
   *     （Veo/即梦/ComfyUI 故意把角色居中并留白，放大后视觉刚好）。
   *   - contain：按短边缩放并留白；适配本地导入视频（用户构图未知，
   *     对 9:16 全身像需完整显示，不能裁掉头/脚）。
   */
  objectFit?: "cover" | "contain";
}

/**
 * 视频实时色键抠图渲染器。
 *
 * 为什么不直接 <video>：Chromium 对 WebM VP9 alpha 的支持依赖 Track 级
 * `AlphaMode` element，而 ffmpeg 8.0 的 libvpx-vp9 muxer 只写容器级 TAG，
 * 导致播放时整张绿幕会显示在透明桌宠窗口里。
 *
 * 方案：离屏 <video> 作画面源 → rAF 每帧 drawImage 到 <canvas> →
 *       getImageData → 逐像素欧氏距离抠色 + despill → putImageData。
 * 本地导入视频的 keyColor / tolerance 由动作记录提供；AI 生成走默认值。
 */

const DEFAULT_KEY = "#00FF00";
const DEFAULT_TOLERANCE = 80;
/** 首尾帧 fade-in/out 可能产生近黑像素，用单独阈值一并抠除 */
const BLACK_THRESHOLD = 28;

export default function ChromaKeyVideo({
  src,
  size,
  loop,
  keyColor,
  tolerance,
  clipBlack = true,
  objectFit = "cover",
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const key = parseColor(keyColor ?? DEFAULT_KEY);
    const tol = tolerance ?? DEFAULT_TOLERANCE;
    const blackThreshold = clipBlack ? BLACK_THRESHOLD : 0;

    const video = document.createElement("video");
    video.src = src;
    video.muted = true;
    video.playsInline = true;
    video.loop = loop;
    video.crossOrigin = "anonymous";
    videoRef.current = video;

    // 仅在视频帧真的推进时才做抠色处理——rAF 固定 60Hz 但视频通常 24/30fps，
    // 避免对同一帧重复 getImageData / putImageData（桌宠独立窗口下最大的 CPU 消耗）。
    let lastProcessedTime = -1;

    const processFrame = () => {
      if (video.readyState < 2 || video.videoWidth === 0) return;
      const t = video.currentTime;
      if (t === lastProcessedTime) return;
      lastProcessedTime = t;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const scale =
        objectFit === "contain"
          ? Math.min(size / vw, size / vh)
          : Math.max(size / vw, size / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (size - dw) / 2;
      const dy = (size - dh) / 2;

      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(video, 0, 0, vw, vh, dx, dy, dw, dh);

      const img = ctx.getImageData(0, 0, size, size);
      applyChromaKeyToImageData(img.data, key, tol, true, blackThreshold);
      ctx.putImageData(img, 0, 0);
    };

    const tick = () => {
      // 窗口不可见或视频暂停时彻底停下，别占主线程
      if (!document.hidden && !video.paused) {
        processFrame();
      }
      rafIdRef.current = requestAnimationFrame(tick);
    };

    const onLoaded = () => {
      video.play().catch(() => {});
      if (rafIdRef.current == null) {
        rafIdRef.current = requestAnimationFrame(tick);
      }
    };
    video.addEventListener("loadeddata", onLoaded);

    return () => {
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      video.removeEventListener("loadeddata", onLoaded);
      video.pause();
      video.src = "";
      video.load();
      videoRef.current = null;
    };
  }, [src, size, loop, keyColor, tolerance, clipBlack, objectFit]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        userSelect: "none",
      }}
    />
  );
}

/**
 * 前端 Canvas 色键抠图。
 *
 * 输入：PNG Blob（AI 生成，背景为接近纯色的 chroma 色，默认绿 #00FF00）
 * 输出：带 alpha 通道的 PNG Blob（目标色像素透明，其余保留）
 *
 * 算法：
 *   1. 硬阈值：RGB 欧氏距离 < tolerance → alpha = 0
 *   2. 软边：tolerance ~ tolerance * 1.5 区间 → alpha 线性下降
 *   3. despill：对保留像素，若 G 通道异常高于 R/B（绿晕），按 G = min(G, max(R,B)) 修正
 *   4. 可选 N×N box blur 羽化 alpha 通道（featherPx）
 */

export interface ChromaKeyOptions {
  /** 目标色（#RRGGBB 或 rgb/rgba）。默认 #00FF00 */
  keyColor?: string;
  /** 硬阈值，0-255 的 RGB 欧氏距离。默认 45 */
  tolerance?: number;
  /** 是否去绿晕。默认 true */
  despill?: boolean;
  /** alpha 通道羽化半径（像素）。0 表示不羽化。默认 1 */
  featherPx?: number;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

const DEFAULTS: Required<ChromaKeyOptions> = {
  keyColor: "#00FF00",
  tolerance: 45,
  despill: true,
  featherPx: 1,
};

/** 把 `#RRGGBB` / `#RGB` / `rgb(...)` 解析为 RGB 三元组 */
export function parseColor(input: string): RGB {
  const s = input.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return { r, g, b };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
  }
  const m = s.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    return { r: +m[1], g: +m[2], b: +m[3] };
  }
  return { r: 0, g: 255, b: 0 };
}

async function blobToImageBitmap(blob: Blob): Promise<ImageBitmap> {
  return await createImageBitmap(blob);
}

function canvasFromBitmap(bmp: ImageBitmap): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D 上下文不可用");
  ctx.drawImage(bmp, 0, 0);
  return { canvas, ctx };
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("canvas.toBlob 返回 null"));
    }, "image/png");
  });
}

/** 对 alpha 通道做 (2r+1)×(2r+1) 均值模糊 */
function boxBlurAlpha(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): void {
  if (radius <= 0) return;
  const n = width * height;
  const copy = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) copy[i] = data[i * 4 + 3];

  const tmp = new Uint8ClampedArray(n);

  // 横向
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let cnt = 0;
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        if (nx < 0 || nx >= width) continue;
        sum += copy[y * width + nx];
        cnt++;
      }
      tmp[y * width + x] = Math.round(sum / cnt);
    }
  }

  // 纵向
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let cnt = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        sum += tmp[ny * width + x];
        cnt++;
      }
      data[(y * width + x) * 4 + 3] = Math.round(sum / cnt);
    }
  }
}

/**
 * 主函数：Blob → Blob。
 * 失败时抛异常，由调用方处理（Step 2 里呈现"抠图失败"并允许重试）。
 */
export async function chromaKeyRemove(
  imageBlob: Blob,
  opts: ChromaKeyOptions = {}
): Promise<Blob> {
  const { keyColor, tolerance, despill, featherPx } = { ...DEFAULTS, ...opts };
  const key = parseColor(keyColor);
  const softMax = tolerance * 1.5;

  const bmp = await blobToImageBitmap(imageBlob);
  const { canvas, ctx } = canvasFromBitmap(bmp);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const dr = r - key.r;
    const dg = g - key.g;
    const db = b - key.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    if (dist < tolerance) {
      d[i + 3] = 0;
    } else if (dist < softMax) {
      const t = (dist - tolerance) / (softMax - tolerance);
      d[i + 3] = Math.round(d[i + 3] * t);
    }

    // despill: 保留像素若绿色明显高于 R/B，压制 G
    if (despill && d[i + 3] > 0) {
      const maxRB = Math.max(r, b);
      if (g > maxRB) {
        d[i + 1] = maxRB;
      }
    }
  }

  if (featherPx > 0) {
    boxBlurAlpha(d, canvas.width, canvas.height, featherPx);
  }

  ctx.putImageData(img, 0, 0);
  bmp.close?.();
  return canvasToPngBlob(canvas);
}

/** 把 data URL 转 Blob（向导里上一步拿到 b64 data URL，这里统一转 Blob 喂给抠图函数） */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

/** Blob → base64 data URL（无前缀 data:image/png;base64,）裸字符串 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

import { createPortal } from "react-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * 无边框窗口（decorations:false + transparent:true）的自定义缩放手柄。
 *
 * 为什么需要：transparent + 无边框窗口在 macOS 上原生的边缘命中区只有 1~4px 的
 * 不可见薄条，用户几乎摸不到，导致「窗口拉不动」。`startResizeDragging` 是
 * **程序化**触发 OS 缩放循环，完全不依赖边缘命中检测 —— 我们在窗口四边/四角铺一层
 * 透明热区，mousedown 即调它，从而获得可靠且明确的缩放手感。
 *
 * 挂载方式：createPortal 到 document.body，避开 `.stagger-child` 等带 transform 的
 * 祖先把 position:fixed 劫持成相对容器的陷阱（见 CLAUDE.md「fixed 弹窗陷阱」）。
 *
 * 角部热区固定 ≤14px：标题栏关闭/主题按钮位于 top:16 / right:14，14px 的 NE 角
 * 正好让位，不会抢按钮点击。
 */

// startResizeDragging 接受的方向（@tauri-apps/api 的 ResizeDirection 字符串联合，未导出为值）
type Dir =
  | "North"
  | "South"
  | "East"
  | "West"
  | "NorthEast"
  | "NorthWest"
  | "SouthEast"
  | "SouthWest";

const EDGE = 6; // 边缘热区厚度
const CORNER = 14; // 角部热区尺寸（≤14 以避开标题栏按钮）

const HANDLES: { dir: Dir; cursor: string; style: React.CSSProperties }[] = [
  { dir: "North", cursor: "ns-resize", style: { top: 0, left: CORNER, right: CORNER, height: EDGE } },
  { dir: "South", cursor: "ns-resize", style: { bottom: 0, left: CORNER, right: CORNER, height: EDGE } },
  { dir: "West", cursor: "ew-resize", style: { left: 0, top: CORNER, bottom: CORNER, width: EDGE } },
  { dir: "East", cursor: "ew-resize", style: { right: 0, top: CORNER, bottom: CORNER, width: EDGE } },
  { dir: "NorthWest", cursor: "nwse-resize", style: { top: 0, left: 0, width: CORNER, height: CORNER } },
  { dir: "NorthEast", cursor: "nesw-resize", style: { top: 0, right: 0, width: CORNER, height: CORNER } },
  { dir: "SouthWest", cursor: "nesw-resize", style: { bottom: 0, left: 0, width: CORNER, height: CORNER } },
  { dir: "SouthEast", cursor: "nwse-resize", style: { bottom: 0, right: 0, width: CORNER, height: CORNER } },
];

export default function WindowResizeHandle() {
  const startResize = (dir: Dir) => (e: React.MouseEvent) => {
    if (e.button !== 0) return; // 仅左键
    e.preventDefault();
    void getCurrentWindow().startResizeDragging(dir);
  };

  return createPortal(
    <>
      {HANDLES.map((h) => (
        <div
          key={h.dir}
          data-tauri-drag-region="false"
          onMouseDown={startResize(h.dir)}
          style={{
            position: "fixed",
            zIndex: 9999,
            cursor: h.cursor,
            ...h.style,
          }}
        >
          {/* 右下角可见把手：交错斜纹，提示「这里可以缩放」 */}
          {h.dir === "SouthEast" && (
            <svg
              width="11"
              height="11"
              viewBox="0 0 11 11"
              style={{ position: "absolute", right: 2, bottom: 2, pointerEvents: "none", opacity: 0.55 }}
            >
              <path
                d="M10 1 L1 10 M10 5 L5 10 M10 9 L9 10"
                stroke="var(--ink-400)"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>
      ))}
    </>,
    document.body
  );
}

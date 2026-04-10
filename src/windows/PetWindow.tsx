import { useState, useCallback, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import PetSprite from "@/components/pet/PetSprite";
import PetBubble from "@/components/pet/PetBubble";
import PetContextMenu from "@/components/pet/PetContextMenu";
import { usePetStore } from "@/stores/usePetStore";
import type { PetState } from "@/types/pet";

/** 桌宠本体尺寸 */
const PET_SIZE = 140;
/** 右键菜单大致尺寸，用于边界夹紧 */
const MENU_W = 184;
const MENU_H = 300;
/** 边缘留白，避免菜单贴死窗口边 */
const MENU_MARGIN = 6;

export default function PetWindow() {
  const { state, bubbleText, showBubble, setState } = usePetStore();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const handleDoubleClick = useCallback(async () => {
    showBubble("正在打开对话...", 2000);
    await invoke("create_chat_window");
  }, [showBubble]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 将菜单位置夹紧到窗口内，避免开在可视区域外
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const clampedX = Math.min(
      Math.max(MENU_MARGIN, e.clientX),
      winW - MENU_W - MENU_MARGIN
    );
    const clampedY = Math.min(
      Math.max(MENU_MARGIN, e.clientY),
      winH - MENU_H - MENU_MARGIN
    );
    setMenu({ x: clampedX, y: clampedY });
  }, []);

  useEffect(() => {
    const win = getCurrentWindow();
    win.setAlwaysOnTop(true);

    // 监听跨窗口桌宠状态变更
    const unlistenState = listen<{ state: PetState }>("pet-state", (event) => {
      setState(event.payload.state);
    });

    // 监听进度气泡事件
    const unlistenBubble = listen<{ text: string }>("pet-bubble", (event) => {
      showBubble(event.payload.text, 3000);
    });

    return () => {
      unlistenState.then((fn) => fn());
      unlistenBubble.then((fn) => fn());
    };
  }, [setState, showBubble]);

  // 外层容器 pointer-events: none，让空白区的点击穿透到桌面
  // 只有桌宠本体 / 气泡 / 菜单这些 pointerEvents: auto 的节点才捕获鼠标
  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: "transparent",
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/* 气泡：位于桌宠正上方，绝对定位 */}
      {bubbleText && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, calc(-50% - ${PET_SIZE / 2 + 14}px))`,
            pointerEvents: "none",
          }}
        >
          <PetBubble text={bubbleText} />
        </div>
      )}

      {/* 桌宠本体：绝对居中，独占拖拽与事件捕获 */}
      <div
        data-tauri-drag-region
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: PET_SIZE,
          height: PET_SIZE,
          transform: "translate(-50%, -50%)",
          cursor: "grab",
          pointerEvents: "auto",
        }}
      >
        <PetSprite state={state} size={PET_SIZE} />
      </div>

      {/* 右键菜单：独立 pointerEvents: auto 的覆盖层 */}
      {menu && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "auto",
          }}
        >
          <PetContextMenu
            x={menu.x}
            y={menu.y}
            onClose={() => setMenu(null)}
          />
        </div>
      )}
    </div>
  );
}

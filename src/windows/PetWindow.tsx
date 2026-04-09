import { useState, useCallback, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import PetSprite from "@/components/pet/PetSprite";
import PetBubble from "@/components/pet/PetBubble";
import PetContextMenu from "@/components/pet/PetContextMenu";
import { usePetStore } from "@/stores/usePetStore";
import type { PetState } from "@/types/pet";

export default function PetWindow() {
  const { state, bubbleText, showBubble, setState } = usePetStore();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const handleDoubleClick = useCallback(async () => {
    showBubble("正在打开对话...", 2000);
    await invoke("create_chat_window");
  }, [showBubble]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    const win = getCurrentWindow();
    win.setAlwaysOnTop(true);

    // 监听跨窗口桌宠状态变更
    const unlisten = listen<{ state: PetState }>("pet-state", (event) => {
      setState(event.payload.state);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setState]);

  return (
    <div
      data-tauri-drag-region
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "grab",
        background: "transparent",
      }}
    >
      <PetSprite state={state} size={140} />

      {bubbleText && <PetBubble text={bubbleText} />}

      {menu && (
        <PetContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

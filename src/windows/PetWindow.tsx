import { useState, useCallback, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import PetSprite from "@/components/pet/PetSprite";
import PetBubble from "@/components/pet/PetBubble";
import PetContextMenu from "@/components/pet/PetContextMenu";
import { usePetStore } from "@/stores/usePetStore";

export default function PetWindow() {
  const { state, bubbleText, showBubble } = usePetStore();
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
  }, []);

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
      {/* 桌宠角色 */}
      <PetSprite state={state} size={140} />

      {/* 气泡提示 */}
      {bubbleText && <PetBubble text={bubbleText} />}

      {/* 右键菜单 */}
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

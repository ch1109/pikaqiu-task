import { useState, useCallback, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import PetSprite from "@/components/pet/PetSprite";
import PetBubble from "@/components/pet/PetBubble";
import PetContextMenu from "@/components/pet/PetContextMenu";
import { usePetStore } from "@/stores/usePetStore";
import { useReminderStore } from "@/stores/useReminderStore";
import {
  setupCustomReminders,
  clearCustomReminders,
} from "@/services/customReminder";
import type { PetState } from "@/types/pet";

/** 桌宠本体尺寸 */
const PET_SIZE = 140;
/** 右键菜单大致尺寸，用于边界夹紧 */
const MENU_W = 184;
const MENU_H = 300;
/** 边缘留白，避免菜单贴死窗口边 */
const MENU_MARGIN = 6;
/** 气泡到确认按钮自动 snooze 的超时 */
const ACK_TIMEOUT_MS = 3 * 60 * 1000;
const SNOOZE_MINUTES = 5;

interface ReminderBubblePayload {
  text: string;
  reminderId?: number;
  requireAck?: boolean;
}

export default function PetWindow() {
  const { state, bubbleText, bubbleActions, showBubble, showActionBubble, hideBubble, setState } =
    usePetStore();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<{ x: number; y: number } | null>(null);
  menuRef.current = menu;

  const bubbleWrapRef = useRef<HTMLDivElement | null>(null);
  const ackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAckTimer = useCallback(() => {
    if (ackTimerRef.current) {
      clearTimeout(ackTimerRef.current);
      ackTimerRef.current = null;
    }
  }, []);

  const handleDoubleClick = useCallback(async () => {
    showBubble("正在打开对话...", 2000);
    await invoke("create_chat_window");
  }, [showBubble]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

    const unlistenState = listen<{ state: PetState }>("pet-state", (event) => {
      setState(event.payload.state);
    });

    // 提醒气泡：requireAck 走按钮分支；普通气泡 3 秒自动消失
    const unlistenBubble = listen<ReminderBubblePayload>(
      "pet-bubble",
      (event) => {
        const { text, reminderId, requireAck } = event.payload;

        if (requireAck && reminderId != null) {
          clearAckTimer();
          const rid = reminderId;
          const dismissAndReset = () => {
            clearAckTimer();
            hideBubble();
            setState("idle");
          };

          showActionBubble(text, [
            {
              id: "ack",
              label: "看到了",
              variant: "primary",
              onClick: () => {
                useReminderStore.getState().advance(rid);
                dismissAndReset();
              },
            },
            {
              id: "snooze",
              label: "稍后提醒",
              variant: "ghost",
              onClick: () => {
                useReminderStore.getState().snooze(rid, SNOOZE_MINUTES);
                dismissAndReset();
              },
            },
          ]);

          ackTimerRef.current = setTimeout(() => {
            useReminderStore.getState().snooze(rid, SNOOZE_MINUTES);
            dismissAndReset();
          }, ACK_TIMEOUT_MS);
        } else {
          showBubble(text, 3000);
        }
      }
    );

    return () => {
      clearAckTimer();
      unlistenState.then((fn) => fn());
      unlistenBubble.then((fn) => fn());
    };
  }, [setState, showBubble, showActionBubble, hideBubble, clearAckTimer]);

  // 鼠标穿透：窗口层面动态切换 ignoreCursorEvents
  useEffect(() => {
    const win = getCurrentWindow();
    const ignoreRef = { current: true };
    win.setIgnoreCursorEvents(true);

    const id = setInterval(async () => {
      try {
        const pos = await invoke<[number, number] | null>(
          "get_pet_cursor_local_pos"
        );
        if (!pos) return;
        const [x, y] = pos;
        const w = window.innerWidth;
        const h = window.innerHeight;

        // 桌宠本体：中心矩形 + 4px 容差
        const half = PET_SIZE / 2 + 4;
        const overPet =
          Math.abs(x - w / 2) <= half && Math.abs(y - h / 2) <= half;

        const m = menuRef.current;
        const overMenu =
          !!m &&
          x >= m.x &&
          x <= m.x + MENU_W &&
          y >= m.y &&
          y <= m.y + MENU_H;

        // 可交互气泡（带按钮）命中区：按实际 rect 判定，否则按钮收不到鼠标
        let overBubble = false;
        const wrap = bubbleWrapRef.current;
        if (wrap) {
          const r = wrap.getBoundingClientRect();
          overBubble =
            x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        }

        const shouldIgnore = !(overPet || overMenu || overBubble);
        if (shouldIgnore !== ignoreRef.current) {
          ignoreRef.current = shouldIgnore;
          win.setIgnoreCursorEvents(shouldIgnore);
        }
      } catch {
        // 忽略：可能窗口尚未完全就绪
      }
    }, 60);

    return () => {
      clearInterval(id);
      win.setIgnoreCursorEvents(true);
    };
  }, []);

  // 自定义定时提醒：PetWindow 是主窗口生命周期≈App，在此挂调度器更稳
  useEffect(() => {
    const { load } = useReminderStore.getState();

    const refresh = async () => {
      const list = await load();
      setupCustomReminders(list);
    };

    refresh();

    // 24h 窗口外的条目要等到进入窗口才能被 setTimeout 安排，靠每小时扫一次推进
    const watchdog = setInterval(refresh, 60 * 60 * 1000);

    // 跨窗口：TaskPanel CRUD 或本窗口 advance/snooze 后广播，这里重排
    const unlisten = listen("reminders-changed", () => refresh());

    return () => {
      clearInterval(watchdog);
      clearCustomReminders();
      unlisten.then((fn) => fn());
    };
  }, []);

  const hasBubbleActions = !!bubbleActions?.length;

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
          ref={bubbleWrapRef}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, calc(-50% - ${PET_SIZE / 2 - 40}px - 100%))`,
            pointerEvents: hasBubbleActions ? "auto" : "none",
          }}
        >
          <PetBubble text={bubbleText} actions={bubbleActions} />
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

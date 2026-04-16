import { useState, useCallback, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import PetSprite from "@/components/pet/PetSprite";
import PetBubble from "@/components/pet/PetBubble";
import PetContextMenu from "@/components/pet/PetContextMenu";
import { usePetStore } from "@/stores/usePetStore";
import { useReminderStore } from "@/stores/useReminderStore";
import { useTaskStore } from "@/stores/useTaskStore";
import {
  setupCustomReminders,
  clearCustomReminders,
} from "@/services/customReminder";
import {
  setupTaskAlarms,
  clearTaskAlarms,
} from "@/services/taskAlarm";
import type { BubblePayload } from "@/types/bubble";
import type { IdleAction, PetState } from "@/types/pet";

const IDLE_ACTIONS: IdleAction[] = [
  "stretch",
  "yawn",
  "hat",
  "mirror",
  "peek",
  "waving",
  "sparkle",
  "dance",
];

/** 待机小动作随机间隔：90~180 秒（稀疏节奏） */
const IDLE_ACTION_MIN_MS = 90_000;
const IDLE_ACTION_MAX_MS = 180_000;

/** 单击延迟：给 dblclick 让路，避免双击也被当作单击触发 curious */
const SINGLE_CLICK_DELAY_MS = 260;

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

/** "稍后 5 分钟"的临时重排使用的 Map：taskId → timer */
const TASK_SNOOZE_MINUTES = 5;

export default function PetWindow() {
  const taskSnoozeTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const {
    state,
    idleAction,
    bubbleText,
    bubbleActions,
    showBubble,
    showActionBubble,
    hideBubble,
    setState,
    triggerIdleAction,
  } = usePetStore();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<{ x: number; y: number } | null>(null);
  menuRef.current = menu;

  const bubbleWrapRef = useRef<HTMLDivElement | null>(null);
  const ackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const singleClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAckTimer = useCallback(() => {
    if (ackTimerRef.current) {
      clearTimeout(ackTimerRef.current);
      ackTimerRef.current = null;
    }
  }, []);

  const clearSingleClickTimer = useCallback(() => {
    if (singleClickTimerRef.current) {
      clearTimeout(singleClickTimerRef.current);
      singleClickTimerRef.current = null;
    }
  }, []);

  const handleClick = useCallback(() => {
    // 等待 260ms，若期间未触发 dblclick，则视为真正单击 → 好奇歪头
    clearSingleClickTimer();
    singleClickTimerRef.current = setTimeout(() => {
      singleClickTimerRef.current = null;
      // 仅当当前处于 idle 时才抢占为 curious；其他形态（提醒/专注等）尊重原有交互
      if (usePetStore.getState().state === "idle") {
        setState("curious");
      }
    }, SINGLE_CLICK_DELAY_MS);
  }, [clearSingleClickTimer, setState]);

  const handleDoubleClick = useCallback(async () => {
    clearSingleClickTimer();
    showBubble("正在打开对话...", 2000);
    await invoke("create_chat_window");
  }, [clearSingleClickTimer, showBubble]);

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

    // 气泡分发：reminder（requireAck）、task-start / task-end、普通文本
    const unlistenBubble = listen<BubblePayload>("pet-bubble", (event) => {
      const p = event.payload;
      const dismissAndReset = () => {
        clearAckTimer();
        hideBubble();
        setState("idle");
      };

      if (p.kind === "task-start") {
        const tid = p.taskId;
        const taskName = (() => {
          const t = useTaskStore.getState().tasks.find((x) => x.id === tid);
          return t?.name ?? "";
        })();

        showActionBubble(p.text, [
          {
            id: "start",
            label: "现在开始",
            variant: "primary",
            onClick: async () => {
              await useTaskStore.getState().startTask(tid);
              dismissAndReset();
            },
          },
          {
            id: "snooze",
            label: "稍后 5 分钟",
            variant: "ghost",
            onClick: () => {
              const prev = taskSnoozeTimersRef.current.get(tid);
              if (prev) clearTimeout(prev);
              const timer = setTimeout(() => {
                taskSnoozeTimersRef.current.delete(tid);
                const latest = useTaskStore
                  .getState()
                  .tasks.find((x) => x.id === tid);
                if (latest && latest.status === "pending") {
                  emit("pet-bubble", {
                    kind: "task-start",
                    text: `该开始「${latest.name || taskName}」了`,
                    taskId: tid,
                  });
                  emit("pet-state", { state: "reminding" });
                }
              }, TASK_SNOOZE_MINUTES * 60 * 1000);
              taskSnoozeTimersRef.current.set(tid, timer);
              dismissAndReset();
            },
          },
        ]);
        return;
      }

      if (p.kind === "task-end") {
        const tid = p.taskId;
        showActionBubble(p.text, [
          {
            id: "done",
            label: "已完成",
            variant: "primary",
            onClick: async () => {
              await useTaskStore.getState().completeTask(tid);
              dismissAndReset();
            },
          },
          {
            id: "not-yet",
            label: "还没完成",
            variant: "ghost",
            onClick: () => {
              // 保留为未完成态（isOvertime 由派生计算渲染琥珀色标记）。
              // 保留 dedup key，避免 watchdog 周期性 refresh 再次弹窗骚扰；
              // 真正允许再次提醒的动作是"顺延时间"——那里会 clearAlarmDedup。
              dismissAndReset();
            },
          },
        ]);
        return;
      }

      // 兼容老的 reminder / 纯文本气泡
      const { text, reminderId, requireAck } = p;
      if (requireAck && reminderId != null) {
        clearAckTimer();
        const rid = reminderId;

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
    });

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

  // 待机小动作调度：90~180s 随机间隔，仅在 idle 且无气泡时触发
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = () => {
      const delay =
        IDLE_ACTION_MIN_MS +
        Math.random() * (IDLE_ACTION_MAX_MS - IDLE_ACTION_MIN_MS);
      timer = setTimeout(() => {
        const { state: s, bubbleText: b, idleAction: cur } =
          usePetStore.getState();
        // 非 idle、有气泡、或正在播放上一动作时跳过本轮，仍排下次
        if (s === "idle" && !b && !cur) {
          const pick =
            IDLE_ACTIONS[Math.floor(Math.random() * IDLE_ACTIONS.length)];
          triggerIdleAction(pick);
        }
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [triggerIdleAction]);

  // 组件卸载时清理单击延迟定时器
  useEffect(() => {
    return () => clearSingleClickTimer();
  }, [clearSingleClickTimer]);

  // 任务时间锚点闹钟：PetWindow 独立 zustand 实例，需主动 loadToday 取最新 tasks
  useEffect(() => {
    const snoozeTimers = taskSnoozeTimersRef.current;
    const refresh = async () => {
      await useTaskStore.getState().loadToday();
      setupTaskAlarms(useTaskStore.getState().tasks);
    };

    refresh();

    const watchdog = setInterval(refresh, 60 * 60 * 1000);
    const unlisten = listen("tasks-changed", () => refresh());

    return () => {
      clearInterval(watchdog);
      clearTaskAlarms();
      for (const t of snoozeTimers.values()) clearTimeout(t);
      snoozeTimers.clear();
      unlisten.then((fn) => fn());
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
        onClick={handleClick}
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
        <PetSprite state={state} idleAction={idleAction} size={PET_SIZE} />
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

import { create } from "zustand";
import type { IdleAction, PetState } from "@/types/pet";

export interface BubbleAction {
  id: string;
  label: string;
  variant?: "primary" | "ghost";
  onClick: () => void;
}

interface PetStore {
  state: PetState;
  idleAction: IdleAction | null;
  bubbleText: string | null;
  bubbleActions: BubbleAction[] | null;
  /** durationMs 缺省走 STATE_TTL；传 0 表示常驻，不自动回 idle */
  setState: (state: PetState, durationMs?: number) => void;
  /** 在 idle 下临时播放一段生活化小动作，durationMs 缺省 4500 */
  triggerIdleAction: (action: IdleAction, durationMs?: number) => void;
  /** durationMs=0 表示常驻，不自动消失 */
  showBubble: (text: string, durationMs?: number) => void;
  showActionBubble: (text: string, actions: BubbleAction[]) => void;
  hideBubble: () => void;
}

/**
 * 各形态自动回 idle 的默认时长（毫秒）。
 * idle=0 表示常驻；reminding=0 等待用户手动确认；focused=0 由菜单再次点击退出。
 */
const STATE_TTL: Record<PetState, number> = {
  idle: 0,
  thinking: 0,
  encourage: 2500,
  rest: 0,
  reminding: 0,
  celebrating: 4000,
  curious: 1200,
  sulking: 3000,
  focused: 0,
  coquette: 0,
};

let bubbleTimer: ReturnType<typeof setTimeout> | null = null;
let stateResetTimer: ReturnType<typeof setTimeout> | null = null;
let idleActionTimer: ReturnType<typeof setTimeout> | null = null;

function clearBubbleTimer() {
  if (bubbleTimer) {
    clearTimeout(bubbleTimer);
    bubbleTimer = null;
  }
}

function clearStateResetTimer() {
  if (stateResetTimer) {
    clearTimeout(stateResetTimer);
    stateResetTimer = null;
  }
}

function clearIdleActionTimer() {
  if (idleActionTimer) {
    clearTimeout(idleActionTimer);
    idleActionTimer = null;
  }
}

export const usePetStore = create<PetStore>((set) => ({
  state: "idle",
  idleAction: null,
  bubbleText: "双击我开始规划~",
  bubbleActions: null,

  setState: (state, durationMs) => {
    clearStateResetTimer();
    // 切换到非 idle 时中断进行中的待机小动作
    if (state !== "idle") {
      clearIdleActionTimer();
      set({ state, idleAction: null });
    } else {
      set({ state });
    }
    const ttl = durationMs ?? STATE_TTL[state];
    if (ttl > 0) {
      stateResetTimer = setTimeout(() => {
        set({ state: "idle" });
        stateResetTimer = null;
      }, ttl);
    }
  },

  triggerIdleAction: (action, durationMs = 4500) => {
    clearIdleActionTimer();
    set({ idleAction: action });
    idleActionTimer = setTimeout(() => {
      set({ idleAction: null });
      idleActionTimer = null;
    }, durationMs);
  },

  showBubble: (text, durationMs = 4000) => {
    clearBubbleTimer();
    set({ bubbleText: text, bubbleActions: null });
    if (durationMs > 0) {
      bubbleTimer = setTimeout(() => {
        set({ bubbleText: null });
        bubbleTimer = null;
      }, durationMs);
    }
  },

  showActionBubble: (text, actions) => {
    clearBubbleTimer();
    set({ bubbleText: text, bubbleActions: actions });
  },

  hideBubble: () => {
    clearBubbleTimer();
    set({ bubbleText: null, bubbleActions: null });
  },
}));

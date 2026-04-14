import { create } from "zustand";
import type { PetState } from "@/types/pet";

export interface BubbleAction {
  id: string;
  label: string;
  variant?: "primary" | "ghost";
  onClick: () => void;
}

interface PetStore {
  state: PetState;
  bubbleText: string | null;
  bubbleActions: BubbleAction[] | null;
  setState: (state: PetState) => void;
  /** durationMs=0 表示常驻，不自动消失 */
  showBubble: (text: string, durationMs?: number) => void;
  showActionBubble: (text: string, actions: BubbleAction[]) => void;
  hideBubble: () => void;
}

let bubbleTimer: ReturnType<typeof setTimeout> | null = null;

function clearBubbleTimer() {
  if (bubbleTimer) {
    clearTimeout(bubbleTimer);
    bubbleTimer = null;
  }
}

export const usePetStore = create<PetStore>((set) => ({
  state: "idle",
  bubbleText: "双击我开始规划~",
  bubbleActions: null,

  setState: (state) => set({ state }),

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

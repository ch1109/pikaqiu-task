import { create } from "zustand";
import type { PetState } from "@/types/pet";

interface PetStore {
  state: PetState;
  bubbleText: string | null;
  setState: (state: PetState) => void;
  showBubble: (text: string, durationMs?: number) => void;
  hideBubble: () => void;
}

let bubbleTimer: ReturnType<typeof setTimeout> | null = null;

export const usePetStore = create<PetStore>((set) => ({
  state: "idle",
  bubbleText: "双击我开始规划~",

  setState: (state) => set({ state }),

  showBubble: (text, durationMs = 4000) => {
    if (bubbleTimer) clearTimeout(bubbleTimer);
    set({ bubbleText: text });
    bubbleTimer = setTimeout(() => {
      set({ bubbleText: null });
      bubbleTimer = null;
    }, durationMs);
  },

  hideBubble: () => {
    if (bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = null;
    set({ bubbleText: null });
  },
}));

import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import {
  CHARACTER_CHANGED,
  deleteCharacter as deleteCharacterSvc,
  getActiveCharacter,
  listCharacters,
  listAnimations,
  setActiveCharacter as setActiveCharacterSvc,
} from "@/services/character";
import type {
  CharacterAnimation,
  CustomCharacter,
} from "@/types/character";

interface CharacterStore {
  characters: CustomCharacter[];
  active: CustomCharacter | null;
  activeAnimations: CharacterAnimation[];
  loaded: boolean;

  /** 首次加载（幂等） */
  init: () => Promise<void>;
  /** 强制重载（CRUD 后调用） */
  reload: () => Promise<void>;

  setActive: (id: string | null) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

let subscribed = false;

export const useCharacterStore = create<CharacterStore>((set, get) => ({
  characters: [],
  active: null,
  activeAnimations: [],
  loaded: false,

  init: async () => {
    if (get().loaded) return;
    await get().reload();
    if (!subscribed) {
      subscribed = true;
      await listen(CHARACTER_CHANGED, () => {
        void get().reload();
      });
    }
  },

  reload: async () => {
    const [characters, active] = await Promise.all([
      listCharacters(),
      getActiveCharacter(),
    ]);
    const activeAnimations = active ? await listAnimations(active.id) : [];
    set({ characters, active, activeAnimations, loaded: true });
  },

  setActive: async (id) => {
    await setActiveCharacterSvc(id);
    await get().reload();
  },

  remove: async (id) => {
    await deleteCharacterSvc(id);
    await get().reload();
  },
}));

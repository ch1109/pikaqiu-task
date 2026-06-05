import { create } from "zustand";
import { emit, listen } from "@tauri-apps/api/event";
import { getDB } from "@/services/db";
import type { Theme } from "@/types/settings";

const LS_KEY = "cyberpet:theme";
const EVT = "theme-changed";

type Resolved = "light" | "dark";

interface ThemeStore {
  /** 用户配置：跟随系统 / 强制浅 / 强制深 */
  mode: Theme;
  /** 实际生效（auto 模式下解析后的最终值） */
  resolved: Resolved;
  /** 已 hydrated（从 DB 读入完成） */
  hydrated: boolean;

  /** 初始化：监听 prefers-color-scheme + Tauri 跨窗口事件，从 DB 拉取持久值 */
  init: () => Promise<void>;
  /** 设置主题（同步写 localStorage 镜像 + DB + html data-theme + 跨窗口广播） */
  setMode: (mode: Theme) => Promise<void>;
}

function applyDataTheme(resolved: Resolved) {
  document.documentElement.setAttribute("data-theme", resolved);
}

function readSystemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveMode(mode: Theme): Resolved {
  if (mode === "auto") return readSystemPrefersDark() ? "dark" : "light";
  return mode;
}

/** 启动期间在 main.tsx 同步调用：避免首屏白闪 */
export function syncBootTheme(): Resolved {
  let mode: Theme = "auto";
  try {
    const cached = localStorage.getItem(LS_KEY);
    if (cached === "auto" || cached === "light" || cached === "dark") {
      mode = cached;
    }
  } catch {
    // localStorage 在 Tauri WebView 偶发不可用，回退 auto
  }
  const resolved = resolveMode(mode);
  applyDataTheme(resolved);
  return resolved;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  mode: "auto",
  resolved: "light",
  hydrated: false,

  init: async () => {
    if (get().hydrated) return;

    // 先用 localStorage 镜像（如果 main.tsx 已经 syncBootTheme，这里只是同步 store 状态）
    let mode: Theme = "auto";
    try {
      const cached = localStorage.getItem(LS_KEY);
      if (cached === "auto" || cached === "light" || cached === "dark") {
        mode = cached;
      }
    } catch {
      // ignore
    }

    // 从 DB 取真源（settings.theme），覆盖 localStorage
    try {
      const db = await getDB();
      const rows = await db.select<{ theme: Theme }[]>(
        "SELECT theme FROM settings WHERE id = 1"
      );
      const dbTheme = rows[0]?.theme;
      if (dbTheme === "auto" || dbTheme === "light" || dbTheme === "dark") {
        mode = dbTheme;
      }
    } catch {
      // 首次启动 DB 还没迁移到 018 等情况，沿用 localStorage 值
    }

    const resolved = resolveMode(mode);
    applyDataTheme(resolved);
    try {
      localStorage.setItem(LS_KEY, mode);
    } catch {
      // ignore
    }
    set({ mode, resolved, hydrated: true });

    // 系统外观切换（macOS 偏好设置）→ 在 auto 模式下实时跟随
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (get().mode !== "auto") return;
      const next = readSystemPrefersDark() ? "dark" : "light";
      applyDataTheme(next);
      set({ resolved: next });
    };
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onSystemChange);
    } else {
      // Safari < 14 fallback
      mql.addListener(onSystemChange);
    }

    // Tauri 跨窗口同步：另一个窗口 setMode 后广播过来
    listen<{ mode: Theme }>(EVT, (e) => {
      const next = e.payload.mode;
      const nextResolved = resolveMode(next);
      applyDataTheme(nextResolved);
      try {
        localStorage.setItem(LS_KEY, next);
      } catch {
        // ignore
      }
      set({ mode: next, resolved: nextResolved });
    }).catch(() => {});
  },

  setMode: async (mode) => {
    const resolved = resolveMode(mode);
    applyDataTheme(resolved);
    try {
      localStorage.setItem(LS_KEY, mode);
    } catch {
      // ignore
    }
    set({ mode, resolved });

    // DB 持久化：直接 UPDATE，避开 useSettingsStore 循环引用
    try {
      const db = await getDB();
      await db.execute(
        "UPDATE settings SET theme = $1, updated_at = datetime('now','localtime') WHERE id = 1",
        [mode]
      );
    } catch {
      // DB 不可用时 localStorage 兜底，下次启动仍能恢复
    }

    await emit(EVT, { mode });
  },
}));

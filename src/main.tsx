import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import PetWindow from "./windows/PetWindow";
import ChatPanel from "./windows/ChatPanel";
import TaskPanel from "./windows/TaskPanel";
import SettingsPanel from "./windows/SettingsPanel";
import CharacterStudio from "./windows/CharacterStudio";
import { syncBootTheme, useThemeStore } from "./stores/useThemeStore";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/globals.css";
import "./styles/animations.css";

// 同步注入 data-theme 防首屏白闪 —— 必须在 ReactDOM.render 之前执行
syncBootTheme();
// 异步从 DB 拉取真源并订阅 prefers-color-scheme + 跨窗口事件
useThemeStore.getState().init();

function App() {
  const label = getCurrentWindow().label;

  switch (label) {
    case "chat":
      return <ChatPanel />;
    case "task":
      return <TaskPanel />;
    case "settings":
      return <SettingsPanel />;
    case "character-studio":
      return <CharacterStudio />;
    default:
      return <PetWindow />;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

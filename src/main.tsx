import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import PetWindow from "./windows/PetWindow";
import ChatPanel from "./windows/ChatPanel";
import TaskPanel from "./windows/TaskPanel";
import SettingsPanel from "./windows/SettingsPanel";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/globals.css";
import "./styles/animations.css";

function App() {
  const label = getCurrentWindow().label;

  switch (label) {
    case "chat":
      return <ChatPanel />;
    case "task":
      return <TaskPanel />;
    case "settings":
      return <SettingsPanel />;
    default:
      return <PetWindow />;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

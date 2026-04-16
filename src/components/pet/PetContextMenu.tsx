import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { exit } from "@tauri-apps/plugin-process";
import Icon, { type IconName } from "@/components/shared/Icon";
import { usePetStore } from "@/stores/usePetStore";

interface MenuItem {
  label: string;
  icon: IconName;
  action: () => void;
  danger?: boolean;
}

interface PetContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
}

export default function PetContextMenu({ x, y, onClose }: PetContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const petState = usePetStore((s) => s.state);
  const isFocused = petState === "focused";

  const items: MenuItem[] = [
    {
      label: "今日计划",
      icon: "scroll-text",
      action: () => invoke("create_chat_window"),
    },
    {
      label: "任务面板",
      icon: "list-todo",
      action: () => invoke("create_task_window"),
    },
    {
      label: isFocused ? "退出专注" : "专注模式",
      icon: "target",
      action: () => {
        const { setState, showBubble, hideBubble } = usePetStore.getState();
        if (isFocused) {
          setState("idle");
          hideBubble();
        } else {
          setState("focused");
          showBubble("专注中…右键选「退出专注」结束", 0);
        }
      },
    },
    {
      label: "设置",
      icon: "settings-2",
      action: () => invoke("create_settings_window"),
    },
    {
      label: "最小化",
      icon: "chevron-down",
      action: () => getCurrentWindow().hide(),
    },
    {
      label: "退出",
      icon: "log-out",
      action: () => exit(0),
      danger: true,
    },
  ];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="animate-panel-enter"
      style={{
        position: "fixed",
        left: x,
        top: y,
        minWidth: 188,
        background: "var(--paper-0)",
        border: "1px solid var(--rule-line)",
        borderRadius: "var(--radius-md)",
        padding: "8px 0",
        boxShadow: "var(--shadow-paper-lift)",
        zIndex: 9999,
      }}
    >
      {items.map((item, index) => (
        <div key={item.label}>
          {item.danger && (
            <div
              style={{
                height: 1,
                margin: "6px 14px",
                background: "var(--rule-line)",
              }}
            />
          )}
          <button
            className={`menu-item stagger-child ${item.danger ? "menu-item--danger" : ""}`}
            onClick={() => {
              item.action();
              onClose();
            }}
            style={{
              padding: "11px 20px",
              fontSize: 13,
              gap: 12,
              "--stagger-index": index,
            } as React.CSSProperties}
          >
            <span
              style={{
                width: 18,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: item.danger ? "var(--seal-red)" : "var(--ink-500)",
              }}
            >
              <Icon
                name={item.icon}
                size={14}
                color={item.danger ? "var(--seal-red)" : "var(--ink-600)"}
              />
            </span>
            <span>{item.label}</span>
          </button>
        </div>
      ))}
    </div>
  );
}

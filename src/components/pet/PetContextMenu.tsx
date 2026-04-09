import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { exit } from "@tauri-apps/plugin-process";

interface MenuItem {
  label: string;
  icon: string;
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

  const items: MenuItem[] = [
    {
      label: "今日计划",
      icon: "📋",
      action: () => invoke("create_chat_window"),
    },
    {
      label: "任务面板",
      icon: "⚡",
      action: () => invoke("create_task_window"),
    },
    {
      label: "专注模式",
      icon: "🎯",
      action: () => {
        /* Phase 6 实现 */
      },
    },
    {
      label: "设置",
      icon: "⚙",
      action: () => {
        /* Phase 8 实现 */
      },
    },
    {
      label: "退出",
      icon: "✕",
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
        minWidth: 140,
        background: "rgba(14, 18, 38, 0.95)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(0, 240, 255, 0.15)",
        borderRadius: 10,
        padding: "4px 0",
        boxShadow:
          "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 1px rgba(0, 240, 255, 0.2)",
        zIndex: 9999,
      }}
    >
      {items.map((item) => (
        <div key={item.label}>
          {item.danger && (
            <div
              style={{
                height: 1,
                background: "rgba(255, 255, 255, 0.06)",
                margin: "3px 8px",
              }}
            />
          )}
          <button
            onClick={() => {
              item.action();
              onClose();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "7px 14px",
              border: "none",
              background: "transparent",
              color: item.danger ? "var(--coral-warn)" : "var(--text-primary)",
              fontSize: 12,
              fontFamily: "var(--font-body)",
              cursor: "pointer",
              transition: "var(--transition-fast)",
              textAlign: "left",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = item.danger
                ? "rgba(255, 107, 107, 0.1)"
                : "rgba(0, 240, 255, 0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <span style={{ fontSize: 13, width: 18, textAlign: "center" }}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        </div>
      ))}
    </div>
  );
}

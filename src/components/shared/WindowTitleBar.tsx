import type { ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Icon from "@/components/shared/Icon";

interface WindowTitleBarProps {
  /** 主标题，如 "任务"、"对话"、"设置" */
  title: string;
  /** 隐藏关闭按钮 */
  hideClose?: boolean;
  /**
   * 右侧附加操作（渲染在关闭按钮左边）。
   * 子节点应自行设置 `data-tauri-drag-region="false"`，否则会被 OS 拖拽截获 mousedown。
   */
  rightActions?: ReactNode;
}

/**
 * WildCard Airy Light 标题栏：
 *   48px 高度 · 左对齐 DM Sans 600 15px title · 右侧圆形关闭按钮
 *   底部 1px 细墨线分隔
 *
 * 关键修复：关闭按钮 + 其子树设置 data-tauri-drag-region="false"，
 * 将按钮排除在 OS 拖拽区之外，否则 mousedown 被 Tauri 截获为窗口拖拽、
 * 不会触发 DOM click 事件。
 */
export default function WindowTitleBar({
  title,
  hideClose = false,
  rightActions,
}: WindowTitleBarProps) {
  return (
    <div
      data-tauri-drag-region
      style={{
        position: "relative",
        height: 48,
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        cursor: "grab",
        flexShrink: 0,
        borderBottom: "1px solid var(--rule-line)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: "var(--ink-900)",
          lineHeight: 1,
          pointerEvents: "none",
        }}
      >
        {title}
      </span>

      {rightActions && (
        <div
          data-tauri-drag-region="false"
          style={{
            position: "absolute",
            top: "50%",
            // 关闭按钮占 14+28=42px 宽；留 8px gap → 50px
            right: hideClose ? 14 : 50,
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {rightActions}
        </div>
      )}

      {!hideClose && (
        <button
          data-tauri-drag-region="false"
          className="btn btn-icon btn-close"
          onClick={() => getCurrentWindow().close()}
          style={{
            position: "absolute",
            top: "50%",
            right: 14,
            transform: "translateY(-50%)",
            width: 28,
            height: 28,
            flexShrink: 0,
          }}
          title="关闭"
        >
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}

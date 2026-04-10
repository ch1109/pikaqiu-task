import { getCurrentWindow } from "@tauri-apps/api/window";
import Icon from "@/components/shared/Icon";

interface WindowTitleBarProps {
  /** 主标题，如 "任务"、"对话"、"设置" */
  title: string;
  /** 隐藏关闭按钮 */
  hideClose?: boolean;
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

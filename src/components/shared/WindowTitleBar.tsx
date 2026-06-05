import type { ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Icon, { type IconName } from "@/components/shared/Icon";
import { useThemeStore } from "@/stores/useThemeStore";
import type { Theme } from "@/types/settings";

interface WindowTitleBarProps {
  /** 主标题，如 "任务"、"对话"、"设置"；masthead 态可用 "今日任务" 这类大标题 */
  title: string;
  /** masthead 态的副标题（如状态统计串），仅 size="masthead" 时显示 */
  subtitle?: string;
  /** compact（默认，48px 紧凑条）| masthead（醒目大标题 + 副标题） */
  size?: "compact" | "masthead";
  /** 隐藏关闭按钮 */
  hideClose?: boolean;
  /** 隐藏主题切换按钮（pet 等无窗口框的场景可关闭） */
  hideThemeToggle?: boolean;
  /**
   * 右侧附加操作（渲染在主题/关闭按钮之间）。
   * 子节点应自行设置 `data-tauri-drag-region="false"`，否则会被 OS 拖拽截获 mousedown。
   */
  rightActions?: ReactNode;
}

const THEME_CYCLE: Theme[] = ["auto", "light", "dark"];
const THEME_ICON: Record<Theme, IconName> = {
  auto: "monitor",
  light: "sun",
  dark: "moon",
};
const THEME_LABEL: Record<Theme, string> = {
  auto: "跟随系统",
  light: "浅色模式",
  dark: "深色模式",
};

/**
 * 高级简约标题栏，两种形态：
 *   compact  — 48px 紧凑条：宝蓝品牌竖线（无发光）+ 标题 · 底部 1px 尺线
 *   masthead — 醒目大标题（heading-display 26px）+ 副标题，无竖线、无底线
 * 两态右上角统一 [主题切换] [用户 actions] [关闭]，整条仍是拖拽区。
 *
 * data-tauri-drag-region="false" 必须显式设置在右侧容器和按钮上，否则 mousedown 被 OS 拖拽截获。
 */
export default function WindowTitleBar({
  title,
  subtitle,
  size = "compact",
  hideClose = false,
  hideThemeToggle = false,
  rightActions,
}: WindowTitleBarProps) {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const isMasthead = size === "masthead";

  const handleThemeToggle = () => {
    const idx = THEME_CYCLE.indexOf(mode);
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    setMode(next);
  };

  return (
    <div
      data-tauri-drag-region
      style={{
        position: "relative",
        display: "flex",
        alignItems: isMasthead ? "flex-start" : "center",
        height: isMasthead ? "auto" : 48,
        padding: isMasthead ? "18px 20px 14px" : "0 20px",
        cursor: "grab",
        flexShrink: 0,
        borderBottom: isMasthead ? "none" : "1px solid var(--rule-line)",
      }}
    >
      {isMasthead ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            minWidth: 0,
            paddingRight: 76, // 给右上角控件让位
            pointerEvents: "none",
          }}
        >
          <span
            className="heading-display"
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              color: "var(--ink-900)",
            }}
          >
            {title}
          </span>
          {subtitle && (
            <span
              style={{
                fontSize: 12.5,
                fontFamily: "var(--font-body)",
                color: "var(--ink-500)",
                lineHeight: 1.4,
              }}
            >
              {subtitle}
            </span>
          )}
        </div>
      ) : (
        <>
          {/* 宝蓝品牌竖线（无发光，高级简约）*/}
          <span
            aria-hidden="true"
            style={{
              width: 3,
              height: 16,
              marginRight: 10,
              background:
                "linear-gradient(180deg, var(--brand-400), var(--brand-700))",
              borderRadius: 2,
              flexShrink: 0,
              pointerEvents: "none",
            }}
          />
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
        </>
      )}

      {/* 右侧 cluster：主题切换 → 用户 actions → 关闭 */}
      <div
        data-tauri-drag-region="false"
        style={{
          position: "absolute",
          top: isMasthead ? 16 : "50%",
          right: 14,
          transform: isMasthead ? "none" : "translateY(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {!hideThemeToggle && (
          <button
            data-tauri-drag-region="false"
            className="btn btn-icon btn-ghost"
            onClick={handleThemeToggle}
            style={{ width: 28, height: 28, flexShrink: 0 }}
            title={`主题：${THEME_LABEL[mode]}（点击循环切换）`}
          >
            <Icon name={THEME_ICON[mode]} size={15} />
          </button>
        )}

        {rightActions}

        {!hideClose && (
          <button
            data-tauri-drag-region="false"
            className="btn btn-icon btn-close"
            onClick={() => getCurrentWindow().close()}
            style={{ width: 28, height: 28, flexShrink: 0 }}
            title="关闭"
          >
            <Icon name="x" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

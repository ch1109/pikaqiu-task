import { useEffect, useMemo } from "react";
import dayjs from "dayjs";
import Icon from "@/components/shared/Icon";
import type { ChatSession } from "@/types/chat";
import { useChatSessionStore } from "@/stores/useChatSessionStore";
import { useChatStore } from "@/stores/useChatStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** 分组标签 */
type Bucket = "今天" | "昨天" | "本周" | "更早";
const BUCKET_ORDER: Bucket[] = ["今天", "昨天", "本周", "更早"];

/** 把 session.date 归入分组桶（基于本地时区） */
function bucketOf(date: string): Bucket {
  const today = dayjs().startOf("day");
  const d = dayjs(date);
  if (d.isSame(today, "day")) return "今天";
  if (d.isSame(today.subtract(1, "day"), "day")) return "昨天";
  // 本周：距今 2~6 天（今天/昨天已单独分组）
  if (d.isAfter(today.subtract(7, "day"))) return "本周";
  return "更早";
}

export default function ChatHistoryDrawer({ open, onClose }: Props) {
  const { sessions, loadAll } = useChatSessionStore();
  const { currentSessionId, loadSession } = useChatStore();

  useEffect(() => {
    if (open) loadAll();
  }, [open, loadAll]);

  const grouped = useMemo(() => {
    const groups: Record<Bucket, ChatSession[]> = {
      今天: [],
      昨天: [],
      本周: [],
      更早: [],
    };
    for (const s of sessions) groups[bucketOf(s.date)].push(s);
    return groups;
  }, [sessions]);

  const handlePick = async (id: number) => {
    if (id !== currentSessionId) {
      await loadSession(id);
    }
    onClose();
  };

  return (
    <>
      {/* 遮罩 —— 点击空白处关闭，透明度极低只求语义 */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(17, 17, 20, 0.18)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 220ms ease-out",
          zIndex: 20,
        }}
      />
      <aside
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: 280,
          background: "var(--paper-0)",
          borderLeft: "1px solid var(--rule-line)",
          boxShadow: "var(--shadow-paper-lift)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
          zIndex: 21,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* 抽屉头 */}
        <div
          style={{
            height: 48,
            padding: "0 16px 0 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--rule-line)",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: "var(--ink-900)",
              textTransform: "uppercase",
            }}
          >
            历史会话
          </span>
          <button
            className="btn btn-icon"
            onClick={onClose}
            title="关闭"
            style={{ width: 24, height: 24 }}
          >
            <Icon name="x" size="xs" />
          </button>
        </div>

        {/* 列表 */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 10px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {sessions.length === 0 ? (
            <div
              style={{
                padding: "28px 14px",
                textAlign: "center",
                color: "var(--ink-500)",
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              还没有历史会话，
              <br />
              聊几句就会出现在这里 ~
            </div>
          ) : (
            BUCKET_ORDER.filter((b) => grouped[b].length > 0).map((bucket) => (
              <section
                key={bucket}
                style={{ display: "flex", flexDirection: "column", gap: 4 }}
              >
                <div
                  style={{
                    padding: "2px 10px",
                    fontSize: 10,
                    fontWeight: 500,
                    color: "var(--ink-500)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  {bucket}
                </div>
                {grouped[bucket].map((s) => {
                  const active = s.id === currentSessionId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => handlePick(s.id)}
                      style={{
                        position: "relative",
                        textAlign: "left",
                        padding: "10px 12px 10px 14px",
                        borderRadius: "var(--radius-sm)",
                        background: active
                          ? "var(--paper-1)"
                          : "transparent",
                        border: "1px solid",
                        borderColor: active
                          ? "var(--rule-line)"
                          : "transparent",
                        cursor: "pointer",
                        transition: "background 160ms, border-color 160ms",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                      onMouseEnter={(e) => {
                        if (!active)
                          e.currentTarget.style.background =
                            "var(--paper-1)";
                      }}
                      onMouseLeave={(e) => {
                        if (!active)
                          e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {active && (
                        <span
                          style={{
                            position: "absolute",
                            left: 4,
                            top: 10,
                            bottom: 10,
                            width: 2,
                            borderRadius: 1,
                            background: "var(--vermilion-600)",
                          }}
                        />
                      )}
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: "var(--ink-900)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          lineHeight: 1.3,
                        }}
                      >
                        {s.title}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--ink-500)",
                          lineHeight: 1.3,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {dayjs(s.updated_at).format("MM-DD HH:mm")}
                      </span>
                    </button>
                  );
                })}
              </section>
            ))
          )}
        </div>
      </aside>
    </>
  );
}

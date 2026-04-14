import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useReminderStore } from "@/stores/useReminderStore";
import Icon from "@/components/shared/Icon";
import type { Reminder } from "@/types/reminder";
import ReminderItem from "./ReminderItem";
import ReminderForm from "./ReminderForm";

type Editing = { mode: "create" } | { mode: "edit"; target: Reminder } | null;

export default function ReminderPanel() {
  const { reminders, loading, load, create, update, remove, toggle } =
    useReminderStore();
  const [editing, setEditing] = useState<Editing>(null);

  useEffect(() => {
    load();
  }, [load]);

  // 跨窗口同步：PetWindow 里 advance 后会 emit reminders-changed，本面板也需要刷新
  useEffect(() => {
    const unlisten = listen("reminders-changed", () => load());
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [load]);

  const handleSubmit = async (data: Parameters<typeof create>[0]) => {
    if (editing?.mode === "edit") {
      await update(editing.target.id, data);
    } else {
      await create(data);
    }
    setEditing(null);
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* 眉题 */}
      <div style={{ padding: "16px 18px 4px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--ink-900)",
                margin: 0,
                lineHeight: 1.15,
              }}
            >
              提醒
            </h2>
            <p
              style={{
                marginTop: 4,
                marginBottom: 0,
                fontSize: 12,
                color: "var(--ink-500)",
                letterSpacing: "-0.005em",
              }}
            >
              到点由桌宠主动气泡提醒
            </p>
          </div>
          {!editing && (
            <button
              type="button"
              className="btn btn-cyan"
              onClick={() => setEditing({ mode: "create" })}
              style={{
                padding: "7px 14px",
                fontSize: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="plus" size="xs" color="currentColor" accent />
              新建
            </button>
          )}
        </div>
      </div>

      {/* 列表 + 表单 */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 18px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {editing && (
          <ReminderForm
            key={editing.mode === "edit" ? editing.target.id : "create"}
            initial={editing.mode === "edit" ? editing.target : undefined}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(null)}
          />
        )}

        {loading && reminders.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="skeleton-bar" style={{ height: 56 }} />
            <div className="skeleton-bar" style={{ height: 56 }} />
          </div>
        )}

        {!loading && reminders.length === 0 && !editing && (
          <EmptyState onCreate={() => setEditing({ mode: "create" })} />
        )}

        {reminders.map((r, i) => (
          <ReminderItem
            key={r.id}
            reminder={r}
            index={i}
            onEdit={() => setEditing({ mode: "edit", target: r })}
            onDelete={() => {
              if (confirm(`删除提醒「${r.title}」？`)) remove(r.id);
            }}
            onToggle={(enabled) => toggle(r.id, enabled)}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 240,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        color: "var(--ink-400)",
        textAlign: "center",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          width: 44,
          height: 44,
          borderRadius: 999,
          background: "var(--paper-2)",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-400)",
        }}
      >
        <Icon name="bell-ring" size={22} color="currentColor" />
      </span>
      <div
        style={{
          fontSize: 13,
          color: "var(--ink-500)",
          fontFamily: "var(--font-display)",
          letterSpacing: "-0.005em",
        }}
      >
        还没有提醒 —— 点「新建」加一条
      </div>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={onCreate}
        style={{ padding: "6px 14px", fontSize: 12 }}
      >
        + 新建提醒
      </button>
    </div>
  );
}

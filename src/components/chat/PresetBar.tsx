import { useEffect, useState, useRef } from "react";
import { usePresetStore } from "@/stores/usePresetStore";
import Icon, { type IconName } from "@/components/shared/Icon";

export default function PresetBar() {
  const { presets, loadAll, addPreset, deletePreset } = usePresetStore();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleAdd = async () => {
    const name = newName.trim();
    const content = newContent.trim();
    if (!name || !content) return;
    await addPreset(name, content);
    setNewName("");
    setNewContent("");
    setAdding(false);
  };

  const handleChipClick = (content: string) => {
    // 找到 ChatInput 的 textarea 并填入内容
    const textarea = document.querySelector<HTMLTextAreaElement>(
      ".chat-input-textarea"
    );
    if (textarea) {
      const nativeSet = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      nativeSet?.call(textarea, content);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.focus();
    }
  };

  if (presets.length === 0 && !adding) return null;

  return (
    <div
      style={{
        padding: "8px 20px 0",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          alignItems: "center",
          scrollbarWidth: "none",
        }}
      >
        {presets.map((p) => {
          const iconName = (
            ["sparkles", "pen-line", "scroll-text", "lightbulb", "target", "heart", "briefcase"].includes(p.icon)
              ? p.icon
              : "sparkles"
          ) as IconName;

          return (
            <button
              key={p.id}
              className="btn btn-ghost"
              onClick={() => handleChipClick(p.content)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!p.is_builtin) {
                  deletePreset(p.id);
                }
              }}
              title={p.is_builtin ? p.content : `${p.content}\n（右键删除）`}
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 12px",
                fontSize: 12,
                fontFamily: "var(--font-display)",
                fontWeight: 500,
                borderRadius: "var(--radius-sm)",
                background: "var(--paper-0)",
                border: "1px solid var(--rule-line)",
                color: "var(--ink-600)",
                cursor: "pointer",
                transition: "border-color 150ms ease, color 150ms ease",
                whiteSpace: "nowrap",
              }}
            >
              <Icon name={iconName} size="xs" color="var(--vermilion-600)" />
              {p.name}
            </button>
          );
        })}

        {/* 添加按钮 */}
        {!adding && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              setAdding(true);
              setTimeout(() => nameRef.current?.focus(), 50);
            }}
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 10px",
              fontSize: 12,
              borderRadius: "var(--radius-sm)",
              background: "transparent",
              border: "1px dashed var(--ink-200)",
              color: "var(--ink-400)",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <Icon name="plus" size="xs" color="var(--ink-400)" />
          </button>
        )}
      </div>

      {/* 内联添加表单 */}
      {adding && (
        <div
          style={{
            display: "flex",
            gap: 6,
            marginTop: 8,
            alignItems: "center",
          }}
        >
          <input
            ref={nameRef}
            className="input-field"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="名称"
            style={{ width: 60, padding: "5px 8px", fontSize: 12 }}
          />
          <input
            className="input-field"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="提示词内容"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") setAdding(false);
            }}
            style={{ flex: 1, padding: "5px 8px", fontSize: 12 }}
          />
          <button
            className="btn btn-cyan"
            onClick={handleAdd}
            disabled={!newName.trim() || !newContent.trim()}
            style={{ padding: "5px 10px", fontSize: 11, flexShrink: 0 }}
          >
            添加
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => setAdding(false)}
            style={{ padding: "5px 8px", fontSize: 11, flexShrink: 0 }}
          >
            <Icon name="x" size="xs" />
          </button>
        </div>
      )}
    </div>
  );
}

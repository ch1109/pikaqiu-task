import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Icon from "@/components/shared/Icon";
import { useCharacterStore } from "@/stores/useCharacterStore";
import { readCharacterBaseImage } from "@/services/character";
import type { CustomCharacter } from "@/types/character";

/**
 * 自定义角色列表：展示 base.png 缩略 + 名称，支持激活/删除/新建角色。
 * - "恢复默认"通过把 active 置为 null 实现 → 回落到原 Pika SVG
 * - 缩略图用 lazy load 单独取 base.png data URL，避免一次加载所有角色的帧
 */
export default function CharacterGallery() {
  const { characters, active, loaded, init, setActive, remove } =
    useCharacterStore();
  const [opening, setOpening] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    void init();
  }, [init]);

  const handleOpenStudio = useCallback(async () => {
    setOpening(true);
    try {
      await invoke("create_character_studio_window");
    } finally {
      setOpening(false);
    }
  }, []);

  const handleActivate = useCallback(
    async (id: string) => {
      if (active?.id === id) return;
      await setActive(id);
    },
    [active, setActive]
  );

  const handleResetDefault = useCallback(async () => {
    if (!active) return;
    await setActive(null);
  }, [active, setActive]);

  const handleDelete = useCallback(
    async (c: CustomCharacter) => {
      if (!confirm(`删除「${c.name}」？该角色的全部帧素材会被清理。`)) return;
      setDeleting(c.id);
      try {
        await remove(c.id);
      } finally {
        setDeleting(null);
      }
    },
    [remove]
  );

  if (!loaded) {
    return (
      <div
        style={{
          fontSize: 12,
          color: "var(--ink-400)",
          padding: "10px 0",
        }}
      >
        加载角色列表…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 当前状态 */}
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          background: active ? "var(--moss-100)" : "var(--paper-3)",
          border: `1px solid ${
            active ? "var(--moss-200)" : "var(--rule-line)"
          }`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 12,
        }}
      >
        <Icon
          name={active ? "sparkles" : "circle"}
          size="sm"
          accent
          color={active ? "var(--moss-600)" : "var(--ink-400)"}
        />
        <div style={{ flex: 1 }}>
          <div style={{ color: "var(--ink-900)", fontWeight: 600 }}>
            {active ? `当前：${active.name}` : "当前：默认 Pika"}
          </div>
          <div style={{ color: "var(--ink-500)", fontSize: 11, marginTop: 2 }}>
            {active
              ? "使用自定义 PNG 序列帧渲染"
              : "使用内置 SVG 角色"}
          </div>
        </div>
        {active && (
          <button
            onClick={handleResetDefault}
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: "6px 10px" }}
          >
            切回默认
          </button>
        )}
      </div>

      {/* 角色网格 */}
      {characters.length === 0 ? (
        <div
          style={{
            padding: 24,
            textAlign: "center",
            color: "var(--ink-500)",
            fontSize: 12,
            background: "var(--paper-3)",
            borderRadius: 10,
            border: "1px dashed var(--rule-line-strong)",
          }}
        >
          还没有自定义角色，点击下方"创建新角色"开始
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          {characters.map((c) => (
            <CharacterCard
              key={c.id}
              character={c}
              isActive={active?.id === c.id}
              deleting={deleting === c.id}
              onActivate={() => handleActivate(c.id)}
              onDelete={() => handleDelete(c)}
            />
          ))}
        </div>
      )}

      {/* 操作区 */}
      <button
        onClick={handleOpenStudio}
        disabled={opening}
        className="btn btn-cyan"
        style={{
          alignSelf: "flex-start",
          fontSize: 12,
          padding: "8px 14px",
        }}
      >
        <Icon name="wand-2" size="xs" style={{ marginRight: 6 }} />
        {opening ? "打开中…" : "创建新角色"}
      </button>
    </div>
  );
}

function CharacterCard({
  character,
  isActive,
  deleting,
  onActivate,
  onDelete,
}: {
  character: CustomCharacter;
  isActive: boolean;
  deleting: boolean;
  onActivate: () => void;
  onDelete: () => void;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    readCharacterBaseImage(character.id).then((url) => {
      if (!cancelled) setThumbUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [character.id]);

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 12,
        border: isActive
          ? "2px solid var(--moss-600)"
          : "1px solid var(--rule-line)",
        background: "var(--paper-0)",
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        boxShadow: isActive
          ? "0 0 0 4px rgba(120, 185, 104, 0.18)"
          : "var(--shadow-paper-low)",
        transition: "all 160ms ease",
        opacity: deleting ? 0.4 : 1,
      }}
    >
      <button
        onClick={onActivate}
        disabled={isActive}
        style={{
          aspectRatio: "1 / 1",
          borderRadius: 10,
          border: "none",
          padding: 0,
          cursor: isActive ? "default" : "pointer",
          overflow: "hidden",
          background:
            "conic-gradient(var(--ink-100) 0 25%, var(--paper-0) 0 50%, var(--ink-100) 0 75%, var(--paper-0) 0) 0 0 / 14px 14px",
          display: "grid",
          placeItems: "center",
        }}
        title={isActive ? "已是当前角色" : "点击设为当前"}
      >
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={character.name}
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              userSelect: "none",
            }}
          />
        ) : (
          <div style={{ color: "var(--ink-300)", fontSize: 10 }}>…</div>
        )}
      </button>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          minHeight: 20,
        }}
      >
        <div
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ink-900)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={character.name}
        >
          {character.name}
        </div>
        <button
          onClick={onDelete}
          disabled={deleting}
          title="删除角色"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--ink-400)",
            padding: 2,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon name="trash-2" size="xs" />
        </button>
      </div>
      {isActive && (
        <div
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            background: "var(--moss-600)",
            color: "#fff",
            fontSize: 10,
            padding: "2px 6px",
            borderRadius: 4,
            fontWeight: 600,
          }}
        >
          当前
        </div>
      )}
    </div>
  );
}

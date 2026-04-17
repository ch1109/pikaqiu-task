import { useEffect, useMemo, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import Icon, { type IconName } from "@/components/shared/Icon";
import { useSkillStore, validateSkillName } from "@/stores/useSkillStore";
import { SKILL_ACTION_OPTIONS } from "@/services/skillRegistry";
import type { Skill } from "@/types/skill";

/** 可选 icon 白名单（与 SkillAutocomplete 呼应，避免任意字符串） */
const ICON_CHOICES: IconName[] = [
  "wand-2",
  "sparkles",
  "calendar-days",
  "scroll-text",
  "target",
  "list-todo",
  "pen-line",
  "lightbulb",
  "heart",
  "briefcase",
  "notebook-pen",
  "book-open-text",
];

type DraftSkill = {
  id?: number;
  name: string;
  display_name: string;
  description: string;
  when_to_use: string;
  prompt: string;
  icon: string;
  action_key: string; // "" 表示 null
  enabled: number;
  is_builtin: number;
};

const EMPTY_DRAFT: DraftSkill = {
  name: "",
  display_name: "",
  description: "",
  when_to_use: "",
  prompt: "",
  icon: "wand-2",
  action_key: "",
  enabled: 1,
  is_builtin: 0,
};

/** 后 emit 广播通知 ChatPanel 刷新 */
async function notifySkillsChanged() {
  await emit("skills-updated", {});
}

export default function SkillManager() {
  const { skills, loaded, loadAll, addSkill, updateSkill, deleteSkill, moveSkill } = useSkillStore();
  const [editing, setEditing] = useState<DraftSkill | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const sortedSkills = useMemo(
    () => [...skills].sort((a, b) => a.sort_order - b.sort_order),
    [skills]
  );

  const startCreate = () => {
    setErr(null);
    setEditing({ ...EMPTY_DRAFT });
  };

  const startEdit = (s: Skill) => {
    setErr(null);
    setEditing({
      id: s.id,
      name: s.name,
      display_name: s.display_name,
      description: s.description,
      when_to_use: s.when_to_use,
      prompt: s.prompt,
      icon: s.icon,
      action_key: s.action_key ?? "",
      enabled: s.enabled,
      is_builtin: s.is_builtin,
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setErr(null);
    try {
      if (editing.id) {
        await updateSkill(editing.id, {
          display_name: editing.display_name.trim() || editing.name,
          description: editing.description.trim(),
          when_to_use: editing.when_to_use.trim(),
          prompt: editing.prompt,
          icon: editing.icon,
          action_key: editing.action_key || null,
          enabled: editing.enabled,
        });
      } else {
        const validation = validateSkillName(editing.name);
        if (!validation.valid) {
          setErr(validation.hint ?? "命令名不合法");
          setSaving(false);
          return;
        }
        const normalized = validation.normalized;
        if (skills.some((s) => s.name === normalized)) {
          setErr(`命令 /${normalized} 已存在`);
          setSaving(false);
          return;
        }
        if (!editing.prompt.trim()) {
          setErr("提示词模板不能为空");
          setSaving(false);
          return;
        }
        await addSkill({
          name: normalized,
          display_name: editing.display_name.trim() || normalized,
          description: editing.description.trim() || editing.display_name || normalized,
          when_to_use: editing.when_to_use.trim(),
          prompt: editing.prompt,
          icon: editing.icon,
          action_key: editing.action_key || null,
        });
      }
      await notifySkillsChanged();
      setEditing(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (s: Skill) => {
    await updateSkill(s.id, { enabled: s.enabled === 1 ? 0 : 1 });
    await notifySkillsChanged();
  };

  const handleDelete = async (s: Skill) => {
    if (s.is_builtin) return;
    if (!confirm(`确认删除 /${s.name}？`)) return;
    await deleteSkill(s.id);
    await notifySkillsChanged();
  };

  const handleMove = async (s: Skill, direction: "up" | "down") => {
    await moveSkill(s.id, direction);
    await notifySkillsChanged();
  };

  if (!loaded) {
    return (
      <div style={{ fontSize: 12, color: "var(--ink-400)", padding: 8 }}>
        加载中…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <p
          style={{
            fontSize: 12,
            color: "var(--ink-500)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          技能通过 <code style={{ fontFamily: "var(--font-mono)" }}>/command</code>{" "}
          在对话框触发。在输入框键入 <code style={{ fontFamily: "var(--font-mono)" }}>/</code> 可弹出补全。
        </p>
        <button
          className="btn btn-cyan"
          onClick={startCreate}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Icon name="plus" size="xs" color="currentColor" />
          新建
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {sortedSkills.map((s, i) => (
          <SkillRow
            key={s.id}
            skill={s}
            canMoveUp={i > 0}
            canMoveDown={i < sortedSkills.length - 1}
            onEdit={() => startEdit(s)}
            onDelete={() => handleDelete(s)}
            onToggleEnabled={() => handleToggleEnabled(s)}
            onMoveUp={() => handleMove(s, "up")}
            onMoveDown={() => handleMove(s, "down")}
          />
        ))}
        {sortedSkills.length === 0 && (
          <div
            style={{
              padding: "20px 12px",
              textAlign: "center",
              fontSize: 12,
              color: "var(--ink-400)",
              background: "var(--paper-1)",
              borderRadius: "var(--radius-md)",
              border: "1px dashed var(--rule-line)",
            }}
          >
            暂无技能，点击「新建」创建第一个。
          </div>
        )}
      </div>

      {editing && (
        <SkillEditor
          draft={editing}
          onChange={setEditing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
          saving={saving}
          error={err}
          existingNames={skills.map((s) => s.name)}
        />
      )}
    </div>
  );
}

/* -------------------- Row -------------------- */

function SkillRow({
  skill,
  canMoveUp,
  canMoveDown,
  onEdit,
  onDelete,
  onToggleEnabled,
  onMoveUp,
  onMoveDown,
}: {
  skill: Skill;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const iconName: IconName = (ICON_CHOICES as string[]).includes(skill.icon)
    ? (skill.icon as IconName)
    : "wand-2";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: "var(--paper-0)",
        border: "1px solid var(--rule-line)",
        borderRadius: "var(--radius-md)",
        opacity: skill.enabled === 1 ? 1 : 0.55,
        transition: "opacity 160ms ease",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "var(--radius-sm)",
          background: "var(--paper-1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon name={iconName} size="sm" color="var(--vermilion-600)" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <code
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--vermilion-600)",
              fontWeight: 600,
            }}
          >
            /{skill.name}
          </code>
          <span style={{ fontSize: 13, color: "var(--ink-800)", fontWeight: 500 }}>
            {skill.display_name}
          </span>
          {skill.is_builtin === 1 && (
            <span
              style={{
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 999,
                background: "var(--paper-1)",
                border: "1px solid var(--rule-line)",
                color: "var(--ink-400)",
              }}
            >
              内置
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--ink-500)",
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {skill.description}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <button
            className="btn btn-ghost"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            title="上移"
            style={{ padding: "1px 4px", opacity: canMoveUp ? 1 : 0.25 }}
          >
            <Icon name="chevron-up" size="xs" color="var(--ink-600)" />
          </button>
          <button
            className="btn btn-ghost"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            title="下移"
            style={{ padding: "1px 4px", opacity: canMoveDown ? 1 : 0.25 }}
          >
            <Icon name="chevron-down" size="xs" color="var(--ink-600)" />
          </button>
        </div>
        <button
          className="btn btn-ghost"
          onClick={onToggleEnabled}
          title={skill.enabled === 1 ? "点击禁用" : "点击启用"}
          style={{
            padding: "4px 8px",
            fontSize: 11,
            color: skill.enabled === 1 ? "var(--moss-600)" : "var(--ink-400)",
          }}
        >
          {skill.enabled === 1 ? "已启用" : "已禁用"}
        </button>
        <button
          className="btn btn-ghost"
          onClick={onEdit}
          title="编辑"
          style={{ padding: "4px 6px" }}
        >
          <Icon name="pen-line" size="xs" color="var(--ink-600)" />
        </button>
        {skill.is_builtin === 0 && (
          <button
            className="btn btn-ghost"
            onClick={onDelete}
            title="删除"
            style={{ padding: "4px 6px" }}
          >
            <Icon name="trash-2" size="xs" color="var(--seal-red)" />
          </button>
        )}
      </div>
    </div>
  );
}

/* -------------------- Editor -------------------- */

function SkillEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
  error,
  existingNames,
}: {
  draft: DraftSkill;
  onChange: (d: DraftSkill) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  existingNames: string[];
}) {
  const isEdit = !!draft.id;
  const isBuiltin = draft.is_builtin === 1;

  return (
    <div
      style={{
        marginTop: 6,
        background: "var(--paper-1)",
        border: "1px solid var(--rule-line)",
        borderRadius: "var(--radius-md)",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h4 style={{ margin: 0, fontSize: 13, color: "var(--ink-900)", fontWeight: 600 }}>
          {isEdit ? (isBuiltin ? "编辑内置技能" : "编辑技能") : "新建技能"}
        </h4>
        <button
          className="btn btn-ghost"
          onClick={onCancel}
          style={{ padding: "2px 6px" }}
        >
          <Icon name="x" size="xs" color="var(--ink-500)" />
        </button>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <FieldSmall
          label="命令名"
          hint={
            isEdit
              ? "命令名创建后不可修改"
              : draft.name
              ? (validateSkillName(draft.name).hint ?? `将保存为 /${validateSkillName(draft.name).normalized}`)
              : "仅支持小写字母/数字/连字符，例：summary"
          }
        >
          <input
            className="input-field"
            value={draft.name}
            disabled={isEdit}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder="summary"
            style={{ padding: "6px 10px", fontSize: 12 }}
          />
        </FieldSmall>
        <FieldSmall label="展示名" hint="">
          <input
            className="input-field"
            value={draft.display_name}
            disabled={isBuiltin}
            onChange={(e) => onChange({ ...draft, display_name: e.target.value })}
            placeholder="内容总结"
            style={{ padding: "6px 10px", fontSize: 12 }}
          />
        </FieldSmall>
      </div>

      <FieldSmall label="一行说明" hint="补全下拉显示的描述">
        <input
          className="input-field"
          value={draft.description}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
          placeholder="用 3-5 个要点总结一段文字"
          style={{ padding: "6px 10px", fontSize: 12 }}
        />
      </FieldSmall>

      <FieldSmall
        label="提示词模板"
        hint="支持 {{args}}（参数）· {{now}}（当前时间）· {{current_tasks}}（当前任务列表）· {{pet_name}}（桌宠名）"
      >
        <textarea
          value={draft.prompt}
          onChange={(e) => onChange({ ...draft, prompt: e.target.value })}
          rows={6}
          placeholder={"你是..."}
          style={{
            width: "100%",
            padding: "8px 10px",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            lineHeight: 1.55,
            background: "var(--paper-0)",
            border: "1px solid var(--rule-line)",
            borderRadius: "var(--radius-sm)",
            color: "var(--ink-800)",
            resize: "vertical",
            minHeight: 110,
          }}
        />
      </FieldSmall>

      <div style={{ display: "flex", gap: 8 }}>
        <FieldSmall label="图标" hint="">
          <select
            value={draft.icon}
            onChange={(e) => onChange({ ...draft, icon: e.target.value })}
            style={selectStyle}
          >
            {ICON_CHOICES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </FieldSmall>

        <FieldSmall label="后置动作" hint="LLM 回复后自动触发">
          <select
            value={draft.action_key}
            onChange={(e) => onChange({ ...draft, action_key: e.target.value })}
            style={selectStyle}
          >
            {SKILL_ACTION_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
                {o.hint ? ` — ${o.hint}` : ""}
              </option>
            ))}
          </select>
        </FieldSmall>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: "var(--seal-red)" }}>{error}</div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          className="btn btn-ghost"
          onClick={onCancel}
          style={{ padding: "6px 14px", fontSize: 12 }}
        >
          取消
        </button>
        <button
          className="btn btn-cyan"
          onClick={onSave}
          disabled={saving}
          style={{ padding: "6px 14px", fontSize: 12 }}
        >
          {saving ? "保存中…" : "保存"}
        </button>
      </div>

      {!isEdit && existingNames.length > 0 && (
        <div style={{ fontSize: 10, color: "var(--ink-400)" }}>
          已有命令：{existingNames.map((n) => `/${n}`).join("  ")}
        </div>
      )}
    </div>
  );
}

/* -------------------- shared -------------------- */

const selectStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 12,
  background: "var(--paper-0)",
  border: "1px solid var(--rule-line)",
  borderRadius: "var(--radius-sm)",
  color: "var(--ink-800)",
  width: "100%",
};

function FieldSmall({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <label
        style={{
          fontSize: 10,
          color: "var(--ink-500)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <div style={{ fontSize: 10, color: "var(--ink-400)", lineHeight: 1.5 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

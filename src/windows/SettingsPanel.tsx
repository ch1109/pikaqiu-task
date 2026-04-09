import { useEffect, useState, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { resetProvider } from "@/services/llm";
import type { LLMMode } from "@/types/settings";

export default function SettingsPanel() {
  const { settings, loading, load, update } = useSettingsStore();

  // 本地表单状态
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [breakMins, setBreakMins] = useState(10);
  const [llmMode, setLlmMode] = useState<LLMMode>("api");
  const [apiUrl, setApiUrl] = useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [localModelPath, setLocalModelPath] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (settings) {
      setWorkStart(settings.work_start);
      setWorkEnd(settings.work_end);
      setBreakMins(settings.break_mins);
      setLlmMode(settings.llm_mode);
      setApiUrl(settings.llm_api_url);
      setApiKey(settings.llm_api_key);
      setModel(settings.llm_model);
      setLocalModelPath(settings.local_model_path);
    }
  }, [settings]);

  const handleSave = useCallback(async () => {
    await update({
      work_start: workStart,
      work_end: workEnd,
      break_mins: breakMins,
      llm_mode: llmMode,
      llm_api_url: apiUrl,
      llm_api_key: apiKey,
      llm_model: model,
      local_model_path: localModelPath,
    });
    resetProvider();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [workStart, workEnd, breakMins, llmMode, apiUrl, apiKey, model, localModelPath, update]);

  const handleClose = () => getCurrentWindow().close();

  if (loading || !settings) {
    return (
      <div
        className="glass-panel"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: 12,
        }}
      >
        加载中...
      </div>
    );
  }

  return (
    <div
      className="glass-panel"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 标题栏 */}
      <div
        data-tauri-drag-region
        style={{
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          borderBottom: "1px solid rgba(0, 240, 255, 0.1)",
          cursor: "grab",
          flexShrink: 0,
        }}
      >
        <span
          className="heading-display"
          style={{ fontSize: 13, color: "var(--cyan-glow)", letterSpacing: "0.1em" }}
        >
          CYBERPET // SETTINGS
        </span>
        <button
          onClick={handleClose}
          style={{
            width: 20,
            height: 20,
            border: "none",
            background: "rgba(255, 60, 172, 0.15)",
            borderRadius: "50%",
            color: "var(--magenta-glow)",
            fontSize: 11,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "var(--transition-fast)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255, 60, 172, 0.35)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 60, 172, 0.15)";
          }}
        >
          ✕
        </button>
      </div>

      {/* 设置内容 */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* 工作时间 */}
        <Section title="工作时间">
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Field label="开始" value={workStart} onChange={setWorkStart} type="time" />
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>至</span>
            <Field label="结束" value={workEnd} onChange={setWorkEnd} type="time" />
          </div>
          <Field
            label="休息间隔（分钟）"
            value={String(breakMins)}
            onChange={(v) => setBreakMins(Number(v) || 0)}
            type="number"
          />
        </Section>

        {/* LLM 配置 */}
        <Section title="AI 模型">
          <div style={{ display: "flex", gap: 6 }}>
            <ModeBtn
              active={llmMode === "api"}
              label="API 模式"
              onClick={() => setLlmMode("api")}
            />
            <ModeBtn
              active={llmMode === "local"}
              label="本地模式"
              onClick={() => setLlmMode("local")}
            />
          </div>

          {llmMode === "api" ? (
            <>
              <Field label="API 地址" value={apiUrl} onChange={setApiUrl} />
              <Field
                label="API Key"
                value={apiKey}
                onChange={setApiKey}
                type="password"
              />
              <Field label="模型名称" value={model} onChange={setModel} />
            </>
          ) : (
            <Field
              label="模型文件路径"
              value={localModelPath}
              onChange={setLocalModelPath}
              placeholder="/path/to/model.gguf"
            />
          )}
        </Section>
      </div>

      {/* 底部保存按钮 */}
      <div
        style={{
          padding: "12px 20px",
          borderTop: "1px solid rgba(0, 240, 255, 0.08)",
          flexShrink: 0,
        }}
      >
        <button
          onClick={handleSave}
          style={{
            width: "100%",
            padding: "10px",
            border: "none",
            borderRadius: "var(--radius-sm)",
            background: saved
              ? "rgba(57, 255, 20, 0.15)"
              : "rgba(0, 240, 255, 0.12)",
            color: saved ? "var(--neon-green)" : "var(--cyan-glow)",
            fontSize: 13,
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            letterSpacing: "0.08em",
            cursor: "pointer",
            transition: "var(--transition-normal)",
          }}
        >
          {saved ? "✓ 已保存" : "保存设置"}
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="heading-display"
        style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          letterSpacing: "0.08em",
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          background: "var(--bg-card)",
          border: "var(--border-glass)",
          borderRadius: "var(--radius-md)",
          padding: 12,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label
        style={{ fontSize: 11, color: "var(--text-muted)" }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: "6px 10px",
          border: "var(--border-glow)",
          borderRadius: "var(--radius-sm)",
          background: "var(--bg-input)",
          color: "var(--text-primary)",
          fontSize: 12,
          fontFamily: "var(--font-body)",
          outline: "none",
          width: "100%",
        }}
      />
    </div>
  );
}

function ModeBtn({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "6px 12px",
        border: active
          ? "1px solid rgba(0, 240, 255, 0.3)"
          : "var(--border-glass)",
        borderRadius: "var(--radius-sm)",
        background: active ? "rgba(0, 240, 255, 0.1)" : "transparent",
        color: active ? "var(--cyan-glow)" : "var(--text-muted)",
        fontSize: 12,
        fontFamily: "var(--font-display)",
        fontWeight: 600,
        cursor: "pointer",
        transition: "var(--transition-fast)",
      }}
    >
      {label}
    </button>
  );
}

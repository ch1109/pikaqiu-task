import { useEffect, useState, useCallback } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import WindowTitleBar from "@/components/shared/WindowTitleBar";
import { resetProvider } from "@/services/llm";
import type { LLMMode } from "@/types/settings";
import Icon from "@/components/shared/Icon";

export default function SettingsPanel() {
  const { settings, loading, load, update } = useSettingsStore();

  // 本地表单状态
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [breakMins, setBreakMins] = useState(10);
  const [llmMode, setLlmMode] = useState<LLMMode>("api");
  const [apiUrl, setApiUrl] = useState("https://ark.cn-beijing.volces.com/api/coding/v1");
  const [apiKey, setApiKey] = useState("f634f22e-6059-4430-a3d6-0f4de4a60e8e");
  const [model, setModel] = useState("doubao-seed-2-0-code-preview-260215");
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
      <div className="stagger-child" style={{ "--stagger-index": 0 } as React.CSSProperties}>
        <WindowTitleBar title="设置" />
      </div>

      {/* 设置内容 */}
      <div
        className="stagger-child"
        style={{
          "--stagger-index": 1,
          flex: 1,
          overflowY: "auto",
          padding: "24px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        } as React.CSSProperties}
      >
        {/* 工作时间 */}
        <Section title="工作时间" subtitle="决定今日排程的起止范围">
          <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
            <Field label="开始" value={workStart} onChange={setWorkStart} type="time" />
            <span
              style={{
                color: "var(--ink-400)",
                fontSize: 12,
                paddingBottom: 12,
              }}
            >
              至
            </span>
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
        <Section title="AI 模型" subtitle="对话与任务拆解的大语言模型配置">
          <div style={{ display: "flex", gap: 10 }}>
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
          padding: "16px 28px 20px",
          background: "var(--paper-2)",
          borderTop: "1px solid var(--rule-line)",
          flexShrink: 0,
        }}
      >
        <button
          className={`btn ${saved ? "btn-green" : "btn-cyan"}`}
          onClick={handleSave}
          style={{
            width: "100%",
            padding: "12px",
            fontSize: 13,
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          {saved ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Icon name="check" size="xs" accent color="currentColor" />
              已保存
            </span>
          ) : (
            "保存设置"
          )}
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 16,
            color: "var(--ink-900)",
            letterSpacing: "-0.01em",
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {title}
        </h3>
        {subtitle && (
          <p
            style={{
              fontSize: 13,
              color: "var(--ink-500)",
              margin: "4px 0 0",
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          background: "var(--paper-0)",
          border: "1px solid var(--rule-line)",
          borderRadius: "var(--radius-lg)",
          padding: "20px 22px",
          boxShadow: "var(--shadow-paper-low)",
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
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </label>
      <input
        className="input-field"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: "10px 12px",
          fontSize: 13,
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
      className={`btn ${active ? "btn-cyan" : "btn-ghost"}`}
      onClick={onClick}
      style={{
        flex: 1,
        padding: "10px 14px",
        fontSize: 12,
        fontFamily: "var(--font-display)",
        fontWeight: 500,
      }}
    >
      {label}
    </button>
  );
}

import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "@/stores/useSettingsStore";
import WindowTitleBar from "@/components/shared/WindowTitleBar";
import { resetProvider } from "@/services/llm";
import { resetImageProvider } from "@/services/image";
import type { ImageGenProviderName, LLMMode } from "@/types/settings";
import Icon from "@/components/shared/Icon";
import SkillManager from "@/components/skills/SkillManager";
import CharacterGallery from "@/components/character/CharacterGallery";

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

  // 图像生成配置
  const [imgProvider, setImgProvider] =
    useState<ImageGenProviderName>("jimeng");
  const [imgApiUrl, setImgApiUrl] = useState("");
  const [imgApiKey, setImgApiKey] = useState("");
  const [imgModel, setImgModel] = useState("");
  const [chromaTolerance, setChromaTolerance] = useState(45);
  const [imgDailyQuota, setImgDailyQuota] = useState(200);
  const [comfyPingState, setComfyPingState] = useState<
    "idle" | "pinging" | "ok" | "fail"
  >("idle");

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
      setImgProvider(settings.image_gen_provider);
      setImgApiUrl(settings.image_gen_api_url);
      setImgApiKey(settings.image_gen_api_key);
      setImgModel(settings.image_gen_model);
      setChromaTolerance(settings.chroma_key_tolerance);
      setImgDailyQuota(settings.image_gen_daily_quota);
    }
  }, [settings]);

  const handleComfyPing = useCallback(async () => {
    setComfyPingState("pinging");
    try {
      const ok = await invoke<boolean>("comfyui_ping", {
        apiUrl: imgApiUrl || "http://127.0.0.1:8188",
      });
      setComfyPingState(ok ? "ok" : "fail");
    } catch {
      setComfyPingState("fail");
    }
    setTimeout(() => setComfyPingState("idle"), 3200);
  }, [imgApiUrl]);

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
      image_gen_provider: imgProvider,
      image_gen_api_url: imgApiUrl,
      image_gen_api_key: imgApiKey,
      image_gen_model: imgModel,
      chroma_key_tolerance: chromaTolerance,
      image_gen_daily_quota: imgDailyQuota,
    });
    resetProvider();
    resetImageProvider();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [
    workStart,
    workEnd,
    breakMins,
    llmMode,
    apiUrl,
    apiKey,
    model,
    localModelPath,
    imgProvider,
    imgApiUrl,
    imgApiKey,
    imgModel,
    chromaTolerance,
    imgDailyQuota,
    update,
  ]);

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
            <>
              <Field
                label="服务地址"
                value={apiUrl}
                onChange={setApiUrl}
                placeholder="http://localhost:11434/v1"
              />
              <Field
                label="模型名称"
                value={model}
                onChange={setModel}
                placeholder="qwen2.5:7b"
              />
              <Field
                label="模型文件路径（Sidecar 预留）"
                value={localModelPath}
                onChange={setLocalModelPath}
                placeholder="/path/to/model.gguf"
              />
            </>
          )}
        </Section>

        {/* 桌宠形象 */}
        <Section
          title="桌宠形象"
          subtitle="切换内置 Pika 或你创造的自定义角色"
        >
          <CharacterGallery />
        </Section>

        {/* 图像生成 */}
        <Section
          title="图像生成"
          subtitle="角色生成用的 Provider。即梦走云端 API，ComfyUI 走本地 8188 端口"
        >
          <div style={{ display: "flex", gap: 10 }}>
            <ModeBtn
              active={imgProvider === "jimeng"}
              label="即梦（火山方舟）"
              onClick={() => setImgProvider("jimeng")}
            />
            <ModeBtn
              active={imgProvider === "comfyui"}
              label="ComfyUI 本地"
              onClick={() => setImgProvider("comfyui")}
            />
          </div>

          {imgProvider === "jimeng" ? (
            <>
              <Field
                label="Endpoint"
                value={imgApiUrl}
                onChange={setImgApiUrl}
                placeholder="https://ark.cn-beijing.volces.com/api/v3"
              />
              <Field
                label="API Key"
                value={imgApiKey}
                onChange={setImgApiKey}
                type="password"
              />
              <Field
                label="模型 ID"
                value={imgModel}
                onChange={setImgModel}
                placeholder="doubao-seedream-3-0-t2i-250415"
              />
              <Field
                label="每日调用配额"
                value={String(imgDailyQuota)}
                onChange={(v) => setImgDailyQuota(Number(v) || 0)}
                type="number"
              />
            </>
          ) : (
            <>
              <Field
                label="ComfyUI 地址"
                value={imgApiUrl}
                onChange={setImgApiUrl}
                placeholder="http://127.0.0.1:8188"
              />
              <Field
                label="Checkpoint 名称"
                value={imgModel}
                onChange={setImgModel}
                placeholder="sd_xl_base_1.0.safetensors"
              />
              <div
                style={{
                  fontSize: 11,
                  color: "var(--ink-500)",
                  lineHeight: 1.6,
                  padding: "8px 12px",
                  background: "var(--paper-3)",
                  borderRadius: 8,
                }}
              >
                需先在本地启动 ComfyUI：
                <code
                  style={{
                    fontFamily: "var(--font-mono, monospace)",
                    background: "var(--ink-100)",
                    padding: "1px 6px",
                    borderRadius: 4,
                    marginLeft: 4,
                  }}
                >
                  python main.py --listen --port 8188
                </code>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={handleComfyPing}
                  disabled={comfyPingState === "pinging"}
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                >
                  {comfyPingState === "pinging" ? "检测中…" : "检测连接"}
                </button>
                {comfyPingState === "ok" && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      color: "var(--moss-600)",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <Icon name="check" size="xs" accent />
                    已连通 {imgApiUrl || "http://127.0.0.1:8188"}
                  </span>
                )}
                {comfyPingState === "fail" && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      color: "var(--seal-red)",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <Icon name="x" size="xs" accent />
                    连接失败 —— 请确认 ComfyUI 已启动
                  </span>
                )}
              </div>
            </>
          )}

          <div
            style={{ display: "flex", flexDirection: "column", gap: 6 }}
          >
            <label
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                letterSpacing: "0.04em",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>绿幕抠图容差</span>
              <span style={{ color: "var(--vermilion-600)" }}>
                {chromaTolerance}
              </span>
            </label>
            <input
              type="range"
              min={10}
              max={120}
              value={chromaTolerance}
              onChange={(e) => setChromaTolerance(Number(e.target.value))}
              style={{ width: "100%" }}
            />
            <div style={{ fontSize: 11, color: "var(--ink-400)" }}>
              10 (保守) → 120 (激进)。影响新角色生成时的默认抠图强度。
            </div>
          </div>
        </Section>

        {/* 技能管理 */}
        <Section
          title="技能库"
          subtitle="用 /command 触发的可复用工作流。保存后在对话框输入 / 会看到补全"
        >
          <SkillManager />
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

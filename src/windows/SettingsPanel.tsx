import { useEffect, useState, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "@/stores/useSettingsStore";
import WindowTitleBar from "@/components/shared/WindowTitleBar";
import { resetProvider } from "@/services/llm";
import { resetImageProvider } from "@/services/image";
import type {
  AIVendorId,
  ImageGenProviderName,
  LLMMode,
  VideoGenProviderName,
} from "@/types/settings";
import Icon from "@/components/shared/Icon";
import SkillManager from "@/components/skills/SkillManager";
import CharacterGallery from "@/components/character/CharacterGallery";
import AIProviderCard, {
  type AIProviderCardValue,
} from "@/components/settings/AIProviderCard";
import {
  VENDOR_PRESETS,
  IMAGE_CAPABLE_VENDORS,
  VIDEO_CAPABLE_VENDORS,
  parseCustomConfig,
  serializeCustomConfig,
} from "@/services/providers/presets";

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

  // 抠图容差 + 每日配额 + 桌宠缩放
  const [chromaTolerance, setChromaTolerance] = useState(45);
  const [imgDailyQuota, setImgDailyQuota] = useState(200);
  const [petScale, setPetScale] = useState(1);

  // AI 创作 Provider —— 单 vendor 模式（默认：图像 + 视频同一家）
  const [advancedMode, setAdvancedMode] = useState(false);
  const [unifiedValue, setUnifiedValue] = useState<AIProviderCardValue>({
    vendor: "jimeng",
    apiUrl: "",
    apiKey: "",
    imageModel: "",
    videoModel: "",
    klingSecretKey: "",
    customConfig: {},
  });
  const [imageValue, setImageValue] = useState<AIProviderCardValue>({
    vendor: "jimeng",
    apiUrl: "",
    apiKey: "",
    imageModel: "",
    videoModel: "",
    klingSecretKey: "",
    customConfig: {},
  });
  const [videoValue, setVideoValue] = useState<AIProviderCardValue>({
    vendor: "gemini",
    apiUrl: "",
    apiKey: "",
    imageModel: "",
    videoModel: "",
    klingSecretKey: "",
    customConfig: {},
  });

  const [ffmpegState, setFfmpegState] = useState<
    "idle" | "checking" | "ok" | "fail"
  >("idle");

  // AIProviderCard 的 onChange 稳定引用 —— 避免 SettingsPanel 其他字段（工作时段、LLM URL 等）
  // 打字导致 AIProviderCard 的 674 行 JSX 跟着重渲染。React.memo 下游靠这个闭包稳定才生效。
  const handleUnifiedChange = useCallback(
    (patch: Partial<AIProviderCardValue>) =>
      setUnifiedValue((s) => ({ ...s, ...patch })),
    []
  );
  const handleImageChange = useCallback(
    (patch: Partial<AIProviderCardValue>) =>
      setImageValue((s) => ({ ...s, ...patch })),
    []
  );
  const handleVideoChange = useCallback(
    (patch: Partial<AIProviderCardValue>) =>
      setVideoValue((s) => ({ ...s, ...patch })),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!settings) return;
    setWorkStart(settings.work_start);
    setWorkEnd(settings.work_end);
    setBreakMins(settings.break_mins);
    setLlmMode(settings.llm_mode);
    setApiUrl(settings.llm_api_url);
    setApiKey(settings.llm_api_key);
    setModel(settings.llm_model);
    setLocalModelPath(settings.local_model_path);
    setChromaTolerance(settings.chroma_key_tolerance);
    setImgDailyQuota(settings.image_gen_daily_quota);
    setPetScale(settings.pet_scale);

    // AI Provider —— image/video 是否来自同一 vendor
    const sameVendor =
      (settings.image_gen_provider as AIVendorId) ===
      (settings.video_gen_provider as AIVendorId);
    setAdvancedMode(!sameVendor);

    const storedCustom = parseCustomConfig(settings.custom_provider_config);
    if (sameVendor) {
      setUnifiedValue({
        vendor: settings.image_gen_provider as AIVendorId,
        // 优先用图像侧 URL/Key，视频侧如果已填而图像侧为空，则回退视频侧
        apiUrl: settings.image_gen_api_url || settings.video_gen_api_url,
        apiKey: settings.image_gen_api_key || settings.video_gen_api_key,
        imageModel: settings.image_gen_model,
        videoModel: settings.video_gen_model,
        klingSecretKey: settings.kling_secret_key,
        customConfig: storedCustom,
      });
    } else {
      setImageValue({
        vendor: settings.image_gen_provider as AIVendorId,
        apiUrl: settings.image_gen_api_url,
        apiKey: settings.image_gen_api_key,
        imageModel: settings.image_gen_model,
        videoModel: "",
        klingSecretKey: settings.kling_secret_key,
        customConfig: storedCustom,
      });
      setVideoValue({
        vendor: settings.video_gen_provider,
        apiUrl: settings.video_gen_api_url,
        apiKey: settings.video_gen_api_key,
        imageModel: "",
        videoModel: settings.video_gen_model,
        klingSecretKey: settings.kling_secret_key,
        customConfig: storedCustom,
      });
    }
  }, [settings]);

  const handleFfmpegCheck = useCallback(async () => {
    setFfmpegState("checking");
    try {
      const ok = await invoke<boolean>("video_check_ffmpeg");
      setFfmpegState(ok ? "ok" : "fail");
    } catch {
      setFfmpegState("fail");
    }
    setTimeout(() => setFfmpegState("idle"), 3200);
  }, []);

  const handleSave = useCallback(async () => {
    // 组装图像 + 视频双字段
    let imageGenProvider: ImageGenProviderName;
    let imageApiUrl: string;
    let imageApiKey: string;
    let imageModel: string;
    let videoGenProvider: VideoGenProviderName;
    let videoApiUrl: string;
    let videoApiKey: string;
    let videoModel: string;
    let klingSk: string;
    let customCfg: Record<string, string>;

    if (!advancedMode) {
      const v = unifiedValue;
      const preset = VENDOR_PRESETS[v.vendor];
      // 同一 vendor 同时驱动 image + video，endpoint/key 共用
      imageGenProvider = (
        preset.image ? v.vendor : "comfyui"
      ) as ImageGenProviderName;
      videoGenProvider = (
        preset.video ? v.vendor : "gemini"
      ) as VideoGenProviderName;
      imageApiUrl = v.apiUrl;
      imageApiKey = v.apiKey;
      imageModel = v.imageModel;
      videoApiUrl = preset.video ? v.apiUrl : "";
      videoApiKey = preset.video ? v.apiKey : "";
      videoModel = preset.video ? v.videoModel : "";
      klingSk = v.vendor === "kling" ? v.klingSecretKey : "";
      customCfg = v.customConfig;
    } else {
      imageGenProvider = imageValue.vendor as ImageGenProviderName;
      imageApiUrl = imageValue.apiUrl;
      imageApiKey = imageValue.apiKey;
      imageModel = imageValue.imageModel;
      videoGenProvider = videoValue.vendor as VideoGenProviderName;
      videoApiUrl = videoValue.apiUrl;
      videoApiKey = videoValue.apiKey;
      videoModel = videoValue.videoModel;
      // 无论 image 卡或 video 卡选 Kling，任一个都可能提供 SK
      klingSk =
        imageValue.vendor === "kling"
          ? imageValue.klingSecretKey
          : videoValue.vendor === "kling"
            ? videoValue.klingSecretKey
            : "";
      // 高级模式下两张卡各自持有 customConfig，合并（video 覆盖 image 的同名 key）
      customCfg = { ...imageValue.customConfig, ...videoValue.customConfig };
    }

    await update({
      work_start: workStart,
      work_end: workEnd,
      break_mins: breakMins,
      llm_mode: llmMode,
      llm_api_url: apiUrl,
      llm_api_key: apiKey,
      llm_model: model,
      local_model_path: localModelPath,
      image_gen_provider: imageGenProvider,
      image_gen_api_url: imageApiUrl,
      image_gen_api_key: imageApiKey,
      image_gen_model: imageModel,
      video_gen_provider: videoGenProvider,
      video_gen_api_url: videoApiUrl,
      video_gen_api_key: videoApiKey,
      video_gen_model: videoModel,
      kling_secret_key: klingSk,
      custom_provider_config: serializeCustomConfig(customCfg),
      chroma_key_tolerance: chromaTolerance,
      image_gen_daily_quota: imgDailyQuota,
      pet_scale: petScale,
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
    advancedMode,
    unifiedValue,
    imageValue,
    videoValue,
    chromaTolerance,
    imgDailyQuota,
    petScale,
    update,
  ]);

  // 每日配额只对云端厂商有意义，ComfyUI 本地不限
  const showDailyQuota = useMemo(() => {
    if (advancedMode) return VENDOR_PRESETS[imageValue.vendor].authKind !== "local";
    return VENDOR_PRESETS[unifiedValue.vendor].authKind !== "local";
  }, [advancedMode, imageValue.vendor, unifiedValue.vendor]);

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

        {/* 桌宠外观 */}
        <Section
          title="桌宠外观"
          subtitle="按比例缩放桌宠大小，保存后立即生效"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                letterSpacing: "0.04em",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>显示大小</span>
              <span style={{ color: "var(--vermilion-600)" }}>
                {Math.round(petScale * 100)}%
                <span
                  style={{
                    color: "var(--ink-400)",
                    marginLeft: 6,
                    fontWeight: 400,
                  }}
                >
                  约 {Math.round(140 * petScale)}px
                </span>
              </span>
            </label>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={petScale}
              onChange={(e) => setPetScale(Number(e.target.value))}
              style={{ width: "100%" }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                color: "var(--ink-400)",
              }}
            >
              <span>50%</span>
              <span>100%（默认）</span>
              <span>200%</span>
            </div>
          </div>
        </Section>

        {/* 桌宠形象 */}
        <Section
          title="桌宠形象"
          subtitle="切换内置 Pika 或你创造的自定义角色"
        >
          <CharacterGallery />
        </Section>

        {/* AI 创作平台 —— 合并图像 + 视频 */}
        <Section
          title="AI 创作平台"
          subtitle="一次选定供应商即可驱动「角色形象生成」+「动作视频合成」。大部分厂商同一把 Key 同时开通两种能力"
        >
          {!advancedMode ? (
            <AIProviderCard
              mode="single"
              value={unifiedValue}
              onChange={handleUnifiedChange}
              title="供应商"
            />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              <div
                style={{
                  padding: 16,
                  border: "1px solid var(--rule-line)",
                  borderRadius: 10,
                  background: "var(--paper-2)",
                }}
              >
                <AIProviderCard
                  mode="imageOnly"
                  value={imageValue}
                  onChange={handleImageChange}
                  title="图像生成"
                  subtitle="角色基础图、精灵帧 sprite 的来源"
                  availableVendors={IMAGE_CAPABLE_VENDORS}
                />
              </div>
              <div
                style={{
                  padding: 16,
                  border: "1px solid var(--rule-line)",
                  borderRadius: 10,
                  background: "var(--paper-2)",
                }}
              >
                <AIProviderCard
                  mode="videoOnly"
                  value={videoValue}
                  onChange={handleVideoChange}
                  title="动作视频"
                  subtitle="基于基础图生成 4-10 秒循环动作"
                  availableVendors={VIDEO_CAPABLE_VENDORS}
                />
              </div>
            </div>
          )}

          {/* 高级模式切换 */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "var(--ink-700)",
              cursor: "pointer",
              marginTop: 4,
              padding: "8px 10px",
              borderRadius: 8,
              background: advancedMode ? "var(--paper-3)" : "transparent",
            }}
          >
            <input
              type="checkbox"
              checked={advancedMode}
              onChange={(e) => setAdvancedMode(e.target.checked)}
              style={{ margin: 0 }}
            />
            <span>图像与视频使用不同厂商（高级）</span>
            <span
              style={{
                fontSize: 11,
                color: "var(--ink-400)",
                marginLeft: "auto",
              }}
            >
              例：ComfyUI 本地出图 + Veo 做动作
            </span>
          </label>

          {/* 每日配额（仅云端厂商） */}
          {showDailyQuota && (
            <Field
              label="每日调用配额"
              value={String(imgDailyQuota)}
              onChange={(v) => setImgDailyQuota(Number(v) || 0)}
              type="number"
            />
          )}

          {/* 绿幕抠图容差 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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

          {/* ffmpeg 检测 */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={handleFfmpegCheck}
              disabled={ffmpegState === "checking"}
              className="btn btn-ghost"
              style={{ fontSize: 12, padding: "6px 12px" }}
            >
              {ffmpegState === "checking" ? "检测中…" : "检测 ffmpeg"}
            </button>
            {ffmpegState === "ok" && (
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
                ffmpeg 就绪
              </span>
            )}
            {ffmpegState === "fail" && (
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
                未检测到 —— macOS: brew install ffmpeg
              </span>
            )}
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

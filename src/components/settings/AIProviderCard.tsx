import { memo, useCallback, useMemo, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import Icon from "@/components/shared/Icon";
import {
  VENDOR_PRESETS,
  VENDOR_TAB_ORDER,
  VENDOR_GROUPS,
  type VendorPreset,
  type CustomFieldDef,
} from "@/services/providers/presets";
import type { AIVendorId } from "@/types/settings";

/**
 * AI Provider 配置卡片 —— 合并「图像 + 视频」一体化配置。
 *
 * 模式：
 * - single（默认）：外层仅传一个 vendor，内部自动决定 image/video 字段均由此 vendor 提供
 * - imageOnly / videoOnly：高级模式下拆成两卡时，只暴露其中一种能力
 */
export type AIProviderCardMode = "single" | "imageOnly" | "videoOnly";

export interface AIProviderCardValue {
  vendor: AIVendorId;
  apiUrl: string;
  apiKey: string;
  imageModel: string;
  videoModel: string;
  klingSecretKey: string;
  /** 开源 Provider 的动态字段（key -> value），未设置 vendor 可为空对象 */
  customConfig: Record<string, string>;
}

interface AIProviderCardProps {
  mode: AIProviderCardMode;
  value: AIProviderCardValue;
  onChange: (patch: Partial<AIProviderCardValue>) => void;
  title: string;
  subtitle?: string;
  /** 过滤出可选 vendor 列表（高级模式下用，比如 video 卡只列有 video 能力的） */
  availableVendors?: AIVendorId[];
}

function AIProviderCardImpl({
  mode,
  value,
  onChange,
  title,
  subtitle,
  availableVendors,
}: AIProviderCardProps) {
  const preset: VendorPreset = VENDOR_PRESETS[value.vendor];
  const tabs = availableVendors ?? VENDOR_TAB_ORDER;

  const showImageFields =
    (mode === "single" || mode === "imageOnly") && !!preset.image;
  const showVideoFields =
    (mode === "single" || mode === "videoOnly") && !!preset.video;

  /** 检测到的可用模型列表（仅 comfyui / openai-compat 支持发现） */
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const supportsModelDiscovery =
    value.vendor === "comfyui" || value.vendor === "openai-compat";

  const handleVendorSwitch = useCallback(
    (next: AIVendorId) => {
      if (next === value.vendor) return;
      const nextPreset = VENDOR_PRESETS[next];
      const nextEndpoint =
        nextPreset.image?.endpoint ?? nextPreset.video?.endpoint ?? "";
      // 切 vendor 时按新 preset.customFields 的 defaultValue 预填，
      // 保留当前已填且 key 相同的值（用户跨 vendor 复用的场景极少，但不强删）
      const nextCustomConfig: Record<string, string> = { ...value.customConfig };
      for (const f of nextPreset.customFields ?? []) {
        if (!(f.key in nextCustomConfig) && f.defaultValue !== undefined) {
          nextCustomConfig[f.key] = f.defaultValue;
        }
      }
      setDiscoveredModels([]);
      onChange({
        vendor: next,
        apiUrl: nextEndpoint,
        imageModel: nextPreset.image?.defaultModel ?? "",
        videoModel: nextPreset.video?.defaultModel ?? "",
        customConfig: nextCustomConfig,
      });
    },
    [value.vendor, value.customConfig, onChange]
  );

  const handleCustomField = useCallback(
    (key: string, v: string) => {
      onChange({
        customConfig: { ...value.customConfig, [key]: v },
      });
    },
    [value.customConfig, onChange]
  );

  const customFields = useMemo(() => {
    const all = preset.customFields ?? [];
    return all.filter((f) => {
      if (f.appliesTo === "both") return true;
      if (f.appliesTo === "image")
        return mode === "single" || mode === "imageOnly";
      if (f.appliesTo === "video")
        return mode === "single" || mode === "videoOnly";
      return false;
    });
  }, [preset.customFields, mode]);

  // 缺能力提示
  const incapableNote = useMemo(() => {
    if (mode === "single") {
      if (!preset.image && !preset.video) {
        return "该供应商无任何能力";
      }
      if (!preset.image) {
        return "该供应商仅支持视频生成，如需图像请在「图像与视频用不同厂商」里另选";
      }
      if (!preset.video) {
        return "该供应商仅支持图像生成，如需视频请在「图像与视频用不同厂商」里另选";
      }
    }
    return null;
  }, [mode, preset.image, preset.video]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 14,
            color: "var(--ink-900)",
            margin: 0,
          }}
        >
          {title}
        </h3>
        {subtitle && (
          <p
            style={{
              fontSize: 12,
              color: "var(--ink-500)",
              margin: "4px 0 0",
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* Vendor Tab —— 按 deployType 分组：云端 API / 本地部署 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {VENDOR_GROUPS.map((group) => {
          const filtered = group.vendors.filter((id) => tabs.includes(id));
          if (filtered.length === 0) return null;
          const isLocal = group.key === "local";
          return (
            <div
              key={group.key}
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: isLocal ? "var(--moss-700)" : "var(--ink-500)",
                  fontWeight: 600,
                }}
              >
                <Icon
                  name={isLocal ? "cpu" : "cloud"}
                  size="xs"
                  accent={isLocal}
                />
                <span>{group.label}</span>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--ink-400)",
                    fontWeight: 400,
                    letterSpacing: "0.02em",
                    textTransform: "none",
                  }}
                >
                  {group.hint}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {filtered.map((id) => {
                  const p = VENDOR_PRESETS[id];
                  const active = id === value.vendor;
                  const activeClass = isLocal ? "btn-green" : "btn-cyan";
                  return (
                    <button
                      key={id}
                      onClick={() => handleVendorSwitch(id)}
                      className={`btn ${active ? activeClass : "btn-ghost"}`}
                      style={{
                        padding: "8px 12px",
                        fontSize: 12,
                        fontFamily: "var(--font-display)",
                        fontWeight: 500,
                      }}
                    >
                      {p.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Provider 提示 */}
      {preset.hint && (
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
          {preset.hint}
        </div>
      )}

      {/* Endpoint */}
      {preset.authKind !== "local" ? (
        <Field
          label="Endpoint"
          value={value.apiUrl}
          onChange={(v) => onChange({ apiUrl: v })}
          placeholder={
            preset.image?.endpoint ?? preset.video?.endpoint ?? ""
          }
        />
      ) : (
        <Field
          label={preset.id === "comfyui" ? "ComfyUI 地址" : "本地服务 Endpoint"}
          value={value.apiUrl}
          onChange={(v) => onChange({ apiUrl: v })}
          placeholder={preset.image?.endpoint ?? preset.video?.endpoint ?? "http://127.0.0.1:8188"}
        />
      )}

      {/* 容器化 / WSL2 场景提示：localhost 在容器内指向容器自身，连不到宿主机 */}
      {preset.deployType === "local" && (
        <div
          style={{
            fontSize: 10,
            color: "var(--ink-400)",
            lineHeight: 1.5,
            marginTop: -4,
          }}
        >
          容器里跑？把 <code style={codeInline}>127.0.0.1</code> 换成{" "}
          <code style={codeInline}>host.docker.internal</code>；WSL2 用{" "}
          <code style={codeInline}>$(hostname).local</code> 或宿主机 IP
        </div>
      )}

      {/* 本地端口快速填充 */}
      {preset.deployType === "local" &&
        preset.localPortHints &&
        preset.localPortHints.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginTop: -4,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: "var(--ink-500)",
                letterSpacing: "0.06em",
                alignSelf: "center",
                marginRight: 4,
              }}
            >
              常用端口
            </span>
            {preset.localPortHints.map((hint) => {
              const active = value.apiUrl.replace(/\/$/, "") === hint.url.replace(/\/$/, "");
              return (
                <button
                  key={hint.url}
                  onClick={() => onChange({ apiUrl: hint.url })}
                  className="btn btn-ghost"
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    borderRadius: 999,
                    fontFamily: "var(--font-mono, monospace)",
                    borderColor: active ? "var(--moss-600)" : undefined,
                    color: active ? "var(--moss-700)" : undefined,
                  }}
                >
                  {hint.label}
                </button>
              );
            })}
          </div>
        )}

      {/* API Key（local 不需要） */}
      {preset.authKind !== "local" && (
        <Field
          label={preset.keyLabel}
          value={value.apiKey}
          onChange={(v) => onChange({ apiKey: v })}
          type="password"
        />
      )}

      {/* Kling 额外的 SK */}
      {preset.needsSecretKey && (
        <Field
          label="Secret Key (SK)"
          value={value.klingSecretKey}
          onChange={(v) => onChange({ klingSecretKey: v })}
          type="password"
        />
      )}

      {/* 本地 Provider 专属：拉取模型列表 */}
      {supportsModelDiscovery && (showImageFields || showVideoFields) && (
        <ModelDiscoveryButton
          vendor={value.vendor}
          apiUrl={value.apiUrl}
          apiKey={value.apiKey}
          onDiscovered={setDiscoveredModels}
          count={discoveredModels.length}
        />
      )}

      {/* 图像模型（vendor 有图像能力且当前模式需要） */}
      {showImageFields && (
        <Field
          label="图像模型"
          value={value.imageModel}
          onChange={(v) => onChange({ imageModel: v })}
          placeholder={preset.image!.defaultModel}
          suggestions={supportsModelDiscovery ? discoveredModels : undefined}
          suggestListId={`imageModelList-${value.vendor}`}
        />
      )}

      {/* 视频模型 */}
      {showVideoFields && (
        <Field
          label="视频模型"
          value={value.videoModel}
          onChange={(v) => onChange({ videoModel: v })}
          placeholder={preset.video!.defaultModel}
          suggestions={
            supportsModelDiscovery && value.vendor === "openai-compat"
              ? discoveredModels
              : undefined
          }
          suggestListId={`videoModelList-${value.vendor}`}
        />
      )}

      {/* 开源 Provider 动态字段 */}
      {customFields.map((f) => (
        <CustomField
          key={f.key}
          def={f}
          value={value.customConfig[f.key] ?? f.defaultValue ?? ""}
          onChange={(v) => handleCustomField(f.key, v)}
        />
      ))}

      {/* ComfyUI 连通性检测 */}
      {preset.authKind === "local" && (
        <ComfyPingButton apiUrl={value.apiUrl} />
      )}

      {incapableNote && (
        <div
          style={{
            fontSize: 11,
            color: "var(--amber-700, #b45309)",
            lineHeight: 1.5,
          }}
        >
          <Icon name="alert-triangle" size="xs" style={{ marginRight: 4 }} />
          {incapableNote}
        </div>
      )}
    </div>
  );
}

function ComfyPingButton({ apiUrl }: { apiUrl: string }) {
  const [state, setState] = useState<"idle" | "pinging" | "ok" | "fail">(
    "idle"
  );
  const handle = useCallback(async () => {
    setState("pinging");
    try {
      const ok = await invoke<boolean>("comfyui_ping", {
        apiUrl: apiUrl || "http://127.0.0.1:8188",
      });
      setState(ok ? "ok" : "fail");
    } catch {
      setState("fail");
    }
    setTimeout(() => setState("idle"), 3200);
  }, [apiUrl]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button
        onClick={handle}
        disabled={state === "pinging"}
        className="btn btn-ghost"
        style={{ fontSize: 12, padding: "6px 12px" }}
      >
        {state === "pinging" ? "检测中…" : "检测连接"}
      </button>
      {state === "ok" && (
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
          已连通 {apiUrl || "http://127.0.0.1:8188"}
        </span>
      )}
      {state === "fail" && (
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
  );
}

function CustomField({
  def,
  value,
  onChange,
}: {
  def: CustomFieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          letterSpacing: "0.04em",
        }}
      >
        {def.label}
      </label>
      {def.kind === "select" && def.options ? (
        <select
          className="input-field"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ padding: "10px 12px", fontSize: 13, width: "100%" }}
        >
          {def.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="input-field"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={def.placeholder}
          style={{ padding: "10px 12px", fontSize: 13, width: "100%" }}
        />
      )}
      {def.help && (
        <div style={{ fontSize: 11, color: "var(--ink-400)", lineHeight: 1.5 }}>
          {def.help}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  suggestions,
  suggestListId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  /** 传入后启用 datalist 自动补全（允许自由输入，兼容未在列表里的模型名） */
  suggestions?: string[];
  suggestListId?: string;
}) {
  const listId = suggestListId;
  const hasSuggestions = !!suggestions && suggestions.length > 0;
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
        list={hasSuggestions ? listId : undefined}
        style={{
          padding: "10px 12px",
          fontSize: 13,
          width: "100%",
        }}
      />
      {hasSuggestions && listId && (
        <datalist id={listId}>
          {suggestions!.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}

const codeInline: CSSProperties = {
  fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, monospace)",
  fontSize: 10,
  padding: "1px 5px",
  borderRadius: 4,
  background: "var(--paper-3, rgba(0,0,0,0.04))",
  color: "var(--ink-700, #374151)",
};

type DiscoverState = "idle" | "loading" | "ok" | "fail";

function ModelDiscoveryButton({
  vendor,
  apiUrl,
  apiKey,
  onDiscovered,
  count,
}: {
  vendor: AIVendorId;
  apiUrl: string;
  apiKey: string;
  onDiscovered: (models: string[]) => void;
  count: number;
}) {
  const [state, setState] = useState<DiscoverState>("idle");
  const [errMsg, setErrMsg] = useState<string>("");
  const handle = useCallback(async () => {
    setState("loading");
    setErrMsg("");
    try {
      const list = await invoke<string[]>("provider_list_models", {
        provider: vendor,
        apiUrl: apiUrl || "http://127.0.0.1:8188",
        apiKey,
      });
      onDiscovered(list);
      setState(list.length > 0 ? "ok" : "fail");
      if (list.length === 0) setErrMsg("服务在线，但未返回任何模型");
    } catch (e) {
      onDiscovered([]);
      setErrMsg(String(e).slice(0, 120));
      setState("fail");
    }
  }, [vendor, apiUrl, apiKey, onDiscovered]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <button
        onClick={handle}
        disabled={state === "loading"}
        className="btn btn-ghost"
        style={{ fontSize: 12, padding: "6px 12px" }}
      >
        <Icon name="refresh-cw" size="xs" style={{ marginRight: 4 }} />
        {state === "loading" ? "拉取中…" : "拉取模型列表"}
      </button>
      {state === "ok" && (
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
          发现 {count} 个模型，下方输入框已联想
        </span>
      )}
      {state === "fail" && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            color: "var(--seal-red)",
            fontSize: 12,
            fontWeight: 600,
          }}
          title={errMsg}
        >
          <Icon name="x" size="xs" accent />
          {errMsg || "拉取失败 —— 请确认本地服务已启动"}
        </span>
      )}
    </div>
  );
}

/**
 * memo 包裹：SettingsPanel 顶层有 20+ useState（工作时段 / LLM URL / petScale …），
 * 任何一个打字都会让它重渲染。没 memo 的话这张 674 行卡片会跟着重算 VENDOR_GROUPS
 * 遍历、customFields 过滤、datalist 展开——足以在打字时产生可感知的卡顿。
 * 上游 onChange 已由 useCallback 稳定，props 浅比较可以成功命中 memo。
 */
const AIProviderCard = memo(AIProviderCardImpl);
export default AIProviderCard;

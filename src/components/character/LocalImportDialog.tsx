import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import Icon from "@/components/shared/Icon";
import {
  CHARACTER_CHANGED,
  createCharacterWithAnimations,
} from "@/services/character";
import ChromaKeyTuner from "./ChromaKeyTuner";

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

/**
 * 本地素材导入弹窗：跳过 AI 生成链路，直接把用户的 PNG/JPG + MP4/WebM 落盘为一个新角色。
 *
 * - 基准图与视频二选一即可（至少一项）
 * - 仅图：base 图复制为 idle/0001.png，走"单帧 PNG + sprite CSS 动画"兜底
 * - 仅视频：从视频首帧抽出 PNG 作为 base.png（角色卡缩略图），动作走 ChromaKeyVideo
 * - 双份：base 图独立落盘 + 视频动画
 * - 视频有 ChromaKeyTuner，让用户点取背景色 + 调容差，参数写到动作记录
 */

async function extractFirstFrameAsPng(videoFile: File): Promise<Uint8Array> {
  const url = URL.createObjectURL(videoFile);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.preload = "auto";
  try {
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        video.currentTime = 0.01;
      };
      const onSeeked = () => resolve();
      const onErr = () => reject(new Error("视频首帧读取失败"));
      video.addEventListener("loadeddata", onLoaded, { once: true });
      video.addEventListener("seeked", onSeeked, { once: true });
      video.addEventListener("error", onErr, { once: true });
    });
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 512;
    canvas.height = video.videoHeight || 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("创建 canvas 上下文失败");
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/png")
    );
    if (!blob) throw new Error("首帧编码 PNG 失败");
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}
export default function LocalImportDialog({ open, onClose, onDone }: Props) {
  const [name, setName] = useState("");
  const [baseImage, setBaseImage] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [chromaCfg, setChromaCfg] = useState<{
    color: string;
    tolerance: number;
  }>({ color: "#00FF00", tolerance: 80 });
  const [importing, setImporting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [baseThumb, setBaseThumb] = useState<string | null>(null);

  const baseInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const handleBaseChange = useCallback((f: File | null) => {
    setBaseImage(f);
    if (baseThumb) URL.revokeObjectURL(baseThumb);
    setBaseThumb(f ? URL.createObjectURL(f) : null);
  }, [baseThumb]);

  const handleTunerChange = useCallback(
    (cfg: { color: string; tolerance: number }) => setChromaCfg(cfg),
    []
  );

  const canImport =
    name.trim().length > 0 && (baseImage !== null || videoFile !== null) && !importing;

  const handleImport = async () => {
    if (!baseImage && !videoFile) return;
    setImporting(true);
    setErr(null);
    const id = crypto.randomUUID();
    try {
      // base.png：优先用用户上传的基准图；否则从视频首帧抽取
      const baseBytes = baseImage
        ? new Uint8Array(await baseImage.arrayBuffer())
        : await extractFirstFrameAsPng(videoFile!);
      await invoke("character_save_bytes", {
        characterId: id,
        relativePath: "base.png",
        bytes: Array.from(baseBytes),
      });

      type AnimInput = Parameters<typeof createCharacterWithAnimations>[0]["animations"][number];
      const animations: AnimInput[] = [];

      if (videoFile) {
        const nameLc = videoFile.name.toLowerCase();
        const ext = nameLc.endsWith(".webm")
          ? "webm"
          : nameLc.endsWith(".mov")
            ? "mov"
            : "mp4";
        const videoRel = `idle/video.${ext}`;
        const videoBytes = new Uint8Array(await videoFile.arrayBuffer());
        await invoke("character_save_bytes", {
          characterId: id,
          relativePath: videoRel,
          bytes: Array.from(videoBytes),
        });
        animations.push({
          action_name: "idle",
          pet_state_binding: "idle",
          prompt_delta: "",
          frames_dir: "idle",
          frame_count: 1,
          fps: 1,
          loop_mode: "loop",
          video_path: videoRel,
          video_provider: "local",
          video_duration_s: null,
          chroma_key_color: chromaCfg.color,
          chroma_key_tolerance: chromaCfg.tolerance,
        });
      } else {
        await invoke("character_save_bytes", {
          characterId: id,
          relativePath: "idle/0001.png",
          bytes: Array.from(baseBytes),
        });
        animations.push({
          action_name: "idle",
          pet_state_binding: "idle",
          prompt_delta: "",
          frames_dir: "idle",
          frame_count: 1,
          fps: 1,
          loop_mode: "loop",
        });
      }

      await createCharacterWithAnimations({
        id,
        name: name.trim(),
        description: "本地导入",
        ref_prompt: "",
        base_image_path: "base.png",
        seed: null,
        provider_used: "local",
        cost_total: 0,
        animations,
      });

      await emit(CHARACTER_CHANGED);
      onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(`导入失败：${msg}`);
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20, 24, 30, 0.45)",
        backdropFilter: "blur(2px)",
        zIndex: 9999,
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(440px, calc(100vw - 32px))",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--paper-0)",
          borderRadius: 14,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          padding: "18px 22px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          fontSize: 12,
        }}
      >
        {/* 头 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="upload" size="sm" accent />
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-900)", flex: 1 }}>
            本地导入角色
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: 4 }}
            aria-label="关闭"
            title="关闭"
          >
            <Icon name="x" size="xs" />
          </button>
        </div>

        {/* 名称 */}
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ color: "var(--ink-500)" }}>名称</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：我的猫猫"
            style={{
              padding: "7px 10px",
              borderRadius: 8,
              border: "1px solid var(--rule-line)",
              background: "var(--paper-1)",
              fontSize: 12,
            }}
          />
        </label>

        {/* 基准图 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ color: "var(--ink-500)" }}>
            基准图 <span style={{ color: "var(--ink-400)" }}>(与视频二选一)</span>
            <span style={{ color: "var(--ink-400)", marginLeft: 8 }}>PNG / JPG</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              className="btn btn-ghost"
              onClick={() => baseInputRef.current?.click()}
              style={{ fontSize: 11 }}
            >
              <Icon name="image" size="xs" style={{ marginRight: 6 }} />
              选择文件
            </button>
            <input
              ref={baseInputRef}
              type="file"
              accept="image/png,image/jpeg"
              hidden
              onChange={(e) => handleBaseChange(e.target.files?.[0] ?? null)}
            />
            <span style={{ color: "var(--ink-700)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {baseImage ? baseImage.name : "未选择"}
            </span>
            {baseThumb && (
              <img
                src={baseThumb}
                alt="预览"
                style={{
                  width: 56,
                  height: 56,
                  objectFit: "contain",
                  borderRadius: 6,
                  border: "1px solid var(--rule-line)",
                  background: "var(--paper-3)",
                }}
              />
            )}
          </div>
        </div>

        {/* 视频 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ color: "var(--ink-500)" }}>
            静止动作视频 <span style={{ color: "var(--ink-400)" }}>(与基准图二选一)</span>
            <span style={{ color: "var(--ink-400)", marginLeft: 8 }}>MP4 / WebM</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              className="btn btn-ghost"
              onClick={() => videoInputRef.current?.click()}
              style={{ fontSize: 11 }}
            >
              <Icon name="video" size="xs" style={{ marginRight: 6 }} />
              {videoFile ? "更换视频" : "选择文件"}
            </button>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              hidden
              onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
            />
            <span style={{ color: "var(--ink-700)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {videoFile ? videoFile.name : "未选择（可跳过）"}
            </span>
            {videoFile && (
              <button
                onClick={() => setVideoFile(null)}
                title="移除视频"
                className="btn btn-ghost"
                style={{ padding: 4 }}
              >
                <Icon name="trash-2" size="xs" />
              </button>
            )}
          </div>
        </div>

        {/* 色键配置（仅有视频时） */}
        {videoFile && (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px dashed var(--rule-line-strong)",
              background: "var(--paper-2)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 11, color: "var(--ink-600)", fontWeight: 600 }}>
              色键（去背景）配置
            </div>
            <div style={{ fontSize: 10, color: "var(--ink-500)", lineHeight: 1.5 }}>
              在左侧首帧点击<strong>背景</strong>采样颜色 → 滑动容差至主体边缘干净为止。右侧实时预览抠色后效果。
            </div>
            <ChromaKeyTuner videoFile={videoFile} onChange={handleTunerChange} />
          </div>
        )}

        {/* 错误 */}
        {err && (
          <div
            style={{
              padding: 8,
              borderRadius: 8,
              background: "rgba(204, 53, 53, 0.08)",
              border: "1px solid var(--seal-red)",
              color: "var(--seal-red)",
              fontSize: 11,
            }}
          >
            {err}
          </div>
        )}

        {/* 按钮 */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <button onClick={onClose} className="btn btn-ghost" disabled={importing}>
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={!canImport}
            className="btn btn-cyan"
          >
            {importing ? "导入中…" : "导入"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

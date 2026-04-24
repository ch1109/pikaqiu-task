import { useEffect, useMemo, useState } from "react";
import { listFramesAsDataUrls } from "@/services/character";
import { readVideoAsBlobUrl } from "@/services/video";
import type { CharacterAnimation } from "@/types/character";
import type { PetState } from "@/types/pet";
import ChromaKeyVideo from "./ChromaKeyVideo";

interface Props {
  characterId: string;
  animations: CharacterAnimation[];
  state: PetState;
  size?: number;
}

/**
 * 自定义角色渲染器。
 *
 * 双通道：
 *   - 动作若有 `video_path` → 播放 WebM（VP9 + alpha），靠视频自身循环驱动动画；
 *   - 否则走"单帧 PNG + 外层 CSS 动画"兜底（sprite-{state} 提供呼吸/摇头等 transform）。
 *
 * 视频 Blob URL 体积大（~1-2MB），切换角色时需 revoke 释放内存。
 */
export default function SpriteRenderer({
  characterId,
  animations,
  state,
  size = 140,
}: Props) {
  const [framesByAction, setFramesByAction] = useState<
    Record<string, string[]>
  >({});
  const [videosByAction, setVideosByAction] = useState<
    Record<string, string>
  >({});
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const currentAnim = useMemo(
    () =>
      animations.find((a) => a.pet_state_binding === state) ||
      animations.find((a) => a.pet_state_binding === "idle") ||
      null,
    [animations, state]
  );

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setFramesByAction({});
    setVideosByAction({});
    setBaseUrl(null);
    const createdUrls: string[] = [];

    (async () => {
      try {
        const [actionResults, base, videoResults] = await Promise.all([
          Promise.all(
            animations.map(async (a) => ({
              name: a.action_name,
              frames: await listFramesAsDataUrls(characterId, a.action_name),
            }))
          ),
          listFramesAsDataUrls(characterId, "").then((arr) => arr[0] ?? null),
          Promise.all(
            animations
              .filter((a) => a.video_path)
              .map(async (a) => {
                try {
                  const url = await readVideoAsBlobUrl(characterId, a.video_path!);
                  return { name: a.action_name, url };
                } catch {
                  return null;
                }
              })
          ),
        ]);
        if (cancelled) return;
        const map: Record<string, string[]> = {};
        for (const r of actionResults) map[r.name] = r.frames;
        const vmap: Record<string, string> = {};
        for (const r of videoResults) {
          if (r) {
            vmap[r.name] = r.url;
            createdUrls.push(r.url);
          }
        }
        setFramesByAction(map);
        setVideosByAction(vmap);
        setBaseUrl(base);
        setLoaded(true);
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
      for (const u of createdUrls) URL.revokeObjectURL(u);
    };
  }, [characterId, animations]);

  if (!loaded) {
    return (
      <div
        style={{
          width: size,
          height: size,
          display: "grid",
          placeItems: "center",
          color: "var(--ink-300)",
          fontSize: 10,
          opacity: 0.6,
        }}
      >
        …
      </div>
    );
  }

  const videoUrl =
    currentAnim && videosByAction[currentAnim.action_name]
      ? videosByAction[currentAnim.action_name]
      : null;
  const src =
    (currentAnim && framesByAction[currentAnim.action_name]?.[0]) ?? baseUrl;

  if (!videoUrl && !src) {
    return (
      <div
        style={{
          width: size,
          height: size,
          display: "grid",
          placeItems: "center",
          color: "var(--ink-400)",
          fontSize: 11,
        }}
      >
        无帧
      </div>
    );
  }

  return (
    <div
      className={`sprite-motion sprite-${state}`}
      style={{
        width: size,
        height: size,
        position: "relative",
        pointerEvents: "none",
      }}
    >
      {videoUrl ? (
        <ChromaKeyVideo
          key={videoUrl}
          src={videoUrl}
          size={size}
          loop={currentAnim?.loop_mode !== "once"}
          keyColor={currentAnim?.chroma_key_color ?? undefined}
          tolerance={currentAnim?.chroma_key_tolerance ?? undefined}
          clipBlack={currentAnim?.video_provider !== "local"}
          objectFit={
            currentAnim?.video_provider === "local" ? "contain" : "cover"
          }
        />
      ) : (
        <img
          src={src!}
          alt={currentAnim?.action_name ?? "character"}
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { listFramesAsDataUrls } from "@/services/character";
import { usePetStore } from "@/stores/usePetStore";
import type { CharacterAnimation } from "@/types/character";
import type { PetState } from "@/types/pet";

interface Props {
  characterId: string;
  animations: CharacterAnimation[];
  state: PetState;
  size?: number;
}

/**
 * 自定义角色 PNG 序列帧播放器。
 *
 * 挂载时并行预取所有动作的帧 data URL → state 切换只是切动画指针，
 * 每动作按 fps 用 setInterval 推进 idx，不重新加载。
 *
 * 当 state 绑定的动作不存在时回退到 idle 绑定；若 idle 也缺失则显示 base.png。
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
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [idx, setIdx] = useState(0);
  const dirRef = useRef<1 | -1>(1);

  // state → animation 映射
  const currentAnim = useMemo(() => {
    return (
      animations.find((a) => a.pet_state_binding === state) ||
      animations.find((a) => a.pet_state_binding === "idle") ||
      null
    );
  }, [animations, state]);

  const frames = currentAnim
    ? framesByAction[currentAnim.action_name] ?? []
    : [];

  // 批量预取所有动作的帧 + base.png
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setFramesByAction({});
    setBaseUrl(null);

    (async () => {
      try {
        const [actionResults, base] = await Promise.all([
          Promise.all(
            animations.map(async (a) => ({
              name: a.action_name,
              frames: await listFramesAsDataUrls(characterId, a.action_name),
            }))
          ),
          listFramesAsDataUrls(characterId, "").then((arr) => arr[0] ?? null),
        ]);
        if (cancelled) return;
        const map: Record<string, string[]> = {};
        for (const r of actionResults) map[r.name] = r.frames;
        setFramesByAction(map);
        setBaseUrl(base);
        setLoaded(true);
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [characterId, animations]);

  // state 切换时重置帧索引
  useEffect(() => {
    setIdx(0);
    dirRef.current = 1;
  }, [currentAnim?.action_name]);

  // 播放调度
  useEffect(() => {
    if (!currentAnim || frames.length <= 1) return;
    const interval = 1000 / Math.max(1, currentAnim.fps);
    const timer = window.setInterval(() => {
      setIdx((cur) => {
        const last = frames.length - 1;
        if (currentAnim.loop_mode === "once") {
          if (cur >= last) {
            // 动画播完：若是非 idle 绑定，尝试回 idle 以触发自然归位
            if (currentAnim.pet_state_binding !== "idle") {
              const petState = usePetStore.getState().state;
              if (petState === currentAnim.pet_state_binding) {
                usePetStore.getState().setState("idle");
              }
            }
            return cur;
          }
          return cur + 1;
        }
        if (currentAnim.loop_mode === "pingpong") {
          const next = cur + dirRef.current;
          if (next >= last) dirRef.current = -1;
          else if (next <= 0) dirRef.current = 1;
          return Math.max(0, Math.min(last, next));
        }
        return (cur + 1) % frames.length;
      });
    }, interval);
    return () => window.clearInterval(timer);
  }, [currentAnim, frames.length]);

  const imgSrc = frames[idx] ?? baseUrl;

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

  if (!imgSrc) {
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
    <img
      src={imgSrc}
      alt={currentAnim?.action_name ?? "character"}
      draggable={false}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        imageRendering: "auto",
        userSelect: "none",
        pointerEvents: "none",
      }}
    />
  );
}

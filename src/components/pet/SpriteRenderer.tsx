import { useEffect, useMemo, useState } from "react";
import { listFramesAsDataUrls } from "@/services/character";
import type { CharacterAnimation } from "@/types/character";
import type { PetState } from "@/types/pet";

interface Props {
  characterId: string;
  animations: CharacterAnimation[];
  state: PetState;
  size?: number;
}

/**
 * 自定义角色 PNG 静态渲染器。
 *
 * 策略：**只显示单张图片**（当前 state 绑定动作的第 0 帧，否则退回 idle 的第 0 帧，再退回 base.png）。
 * 当前生图管线产出的 2-4 帧 seed 不一致，硬切帧看起来像"抽卡轮播"。
 * 改用外层容器 CSS 动画（sprite-{state}）提供呼吸/摇头/弹跳等 transform 动画，
 * 单帧 + CSS 就足够让桌宠"活起来"。
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

  const src =
    (currentAnim && framesByAction[currentAnim.action_name]?.[0]) ?? baseUrl;

  if (!src) {
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
      <img
        src={src}
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
    </div>
  );
}

import { useMemo } from "react";
import Lottie from "lottie-react";
import type { PetState } from "@/types/pet";

import idleData from "@/assets/animations/idle.json";
import thinkingData from "@/assets/animations/thinking.json";
import encourageData from "@/assets/animations/encourage.json";
import restData from "@/assets/animations/rest.json";

const animationMap: Record<PetState, unknown> = {
  idle: idleData,
  thinking: thinkingData,
  encourage: encourageData,
  rest: restData,
};

interface PetSpriteProps {
  state: PetState;
  size?: number;
}

export default function PetSprite({ state, size = 140 }: PetSpriteProps) {
  const animationData = useMemo(() => animationMap[state], [state]);

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        pointerEvents: "none",
      }}
    >
      <Lottie
        animationData={animationData}
        loop
        autoplay
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}

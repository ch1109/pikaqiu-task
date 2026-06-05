import type { PetState } from "@/types/pet";
import type { IconName } from "@/components/shared/Icon";

export interface ActionMeta {
  state: PetState;
  zhName: string;
  scene: string;
  iconName: IconName;
}

export const ACTION_CATALOG: ActionMeta[] = [
  {
    state: "idle",
    zhName: "待机",
    scene: "无事时的默认呼吸状态",
    iconName: "moon",
  },
  {
    state: "thinking",
    zhName: "思考",
    scene: "AI 正在思考你的指令",
    iconName: "lightbulb",
  },
  {
    state: "encourage",
    zhName: "鼓励",
    scene: "完成任务时为你打气",
    iconName: "thumbs-up",
  },
  {
    state: "rest",
    zhName: "休息",
    scene: "进入工作时段间隙的小憩",
    iconName: "bed",
  },
  {
    state: "reminding",
    zhName: "提醒",
    scene: "任务到点 / 提醒触发时呼叫你",
    iconName: "bell",
  },
  {
    state: "celebrating",
    zhName: "庆祝",
    scene: "完成大目标时的欢呼一击",
    iconName: "party-popper",
  },
  {
    state: "coquette",
    zhName: "撒娇",
    scene: "右键互动 / 闲置太久时的小动作",
    iconName: "heart",
  },
];

const COVERED_STATES = new Set<PetState>(ACTION_CATALOG.map((a) => a.state));

export const UNCOVERED_STATES: { state: PetState; zhName: string }[] = (
  ["curious", "sulking", "focused"] as PetState[]
)
  .filter((s) => !COVERED_STATES.has(s))
  .map((state) => ({
    state,
    zhName: { curious: "好奇", sulking: "赌气", focused: "专注" }[
      state as "curious" | "sulking" | "focused"
    ],
  }));

export function actionMetaByState(state: string): ActionMeta | undefined {
  return ACTION_CATALOG.find((a) => a.state === state);
}

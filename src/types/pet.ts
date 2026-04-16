export type PetState =
  | "idle"
  | "thinking"
  | "encourage"
  | "rest"
  | "reminding"
  | "celebrating"
  | "curious"
  | "sulking"
  | "focused";

export type IdleAction =
  | "stretch"
  | "yawn"
  | "hat"
  | "mirror"
  | "peek"
  | "waving"
  | "sparkle"
  | "dance";

export interface PetPosition {
  x: number;
  y: number;
}

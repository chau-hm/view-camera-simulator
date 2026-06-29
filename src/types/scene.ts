import type { Bounds3, Vec3 } from "./optics";
import type { CameraState } from "./camera";

export type FocusTarget = {
  id: string;
  label: string;
  worldPosition: Vec3;
  weight: number;
};

export type CompositionTarget = {
  id: string;
  label: string;
  worldBounds: Bounds3;
};

export type SceneAsset = {
  id: string;
  kind: "model" | "helper";
  source: string;
};

export type SceneDefinition = {
  id: string;
  name: string;
  description: string;
  assets: SceneAsset[];
  cameraPreset: Pick<CameraState, "focusDistanceMm" | "aperture" | "frontRiseMm" | "frontTiltDeg" | "frontSwingDeg">;
  bounds: Bounds3;
  focusTargets: FocusTarget[];
  compositionTargets: CompositionTarget[];
};

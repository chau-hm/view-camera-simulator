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
  textureFormat?: "ktx2" | "webp" | "none";
  loadStrategy?: "eager" | "lazy";
};

export type CameraPlacement = {
  position: Vec3;
  target: Vec3;
};

export type SceneDefinition = {
  id: string;
  name: string;
  description: string;
  assets: SceneAsset[];
  cameraPreset: Pick<CameraState, "focusDistanceMm" | "aperture" | "frontRiseMm" | "frontTiltDeg" | "frontSwingDeg">;
  cameraPlacement: CameraPlacement;
  bounds: Bounds3;
  focusTargets: FocusTarget[];
  compositionTargets: CompositionTarget[];
};

import type { EffectiveCameraMovementCalibration } from "../scenes/cameraMovementEffectiveCalibration";
import type { DerivedOpticsState, Vec3 } from "../types/optics";
import type { SceneDefinition } from "../types/scene";
import type { RenderQualityProfile } from "../types/ui";
import type { GroundGlassAcceptedRequestIdentity } from "./backend/groundGlassBackendContracts";
import type { GroundGlassRttChannel } from "./groundGlassRttDimensions";
import {
  FULL_GROUND_GLASS_INSPECTION_WINDOW,
  type GroundGlassInspectionWindow,
} from "./groundGlassInspectionWindow";
import type { CameraMovementPresentationRegion } from "../scenes/cameraMovementSceneCalibration";

export type GroundGlassDeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { readonly [K in keyof T]: GroundGlassDeepReadonly<T[K]> }
    : T;

const cloneAndFreeze = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => cloneAndFreeze(entry))) as T;
  }
  if (value !== null && typeof value === "object") {
    const clone = Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneAndFreeze(entry)]),
    );
    return Object.freeze(clone) as T;
  }
  return value;
};

/** Semantic inputs consumed by the current WebGL RTT adapter. */
export type GroundGlassFrameRequestInput = Readonly<{
  opticsState: GroundGlassDeepReadonly<DerivedOpticsState>;
  focalLengthMm: number;
  scene: GroundGlassDeepReadonly<SceneDefinition>;
  widthPx: number;
  heightPx: number;
  aperture: number;
  previewMode: "raw" | "upright";
  rawDebug: boolean;
  renderQuality: RenderQualityProfile;
  channel: GroundGlassRttChannel;
  inspectionWindow: GroundGlassDeepReadonly<GroundGlassInspectionWindow>;
  presentationRegion: CameraMovementPresentationRegion;
  effectiveCameraMovementCalibration: GroundGlassDeepReadonly<EffectiveCameraMovementCalibration> | undefined;
}>;

/** A committed, immutable identity and the complete semantic state for one RTT output revision. */
export type GroundGlassFrameRequest = GroundGlassFrameRequestInput & Readonly<{
  identity: GroundGlassAcceptedRequestIdentity;
}>;

const vector = (value: Vec3 | null | undefined): readonly unknown[] | null =>
  value ? [value.x, value.y, value.z] : null;

const serializeSemanticValue = (value: unknown): string => JSON.stringify(
  value,
  (_key, child: unknown) => typeof child === "number" && !Number.isFinite(child)
    ? { nonFiniteNumber: String(child) }
    : child,
);

/**
 * Current Ground Glass scene consumers read the scene ID and bounds. Keep this semantic key
 * aligned with any future scene-definition fields used by a Ground Glass scene profile.
 */
export const createGroundGlassSceneFingerprint = (scene: GroundGlassFrameRequestInput["scene"]): string =>
  JSON.stringify([
    scene.id,
    vector(scene.bounds.min),
    vector(scene.bounds.max),
  ]);

/**
 * Exact semantic key for current render inputs: explicit display/scene values plus serialized
 * canonical optics and calibration snapshots. Scene identity is limited to the ID and bounds read
 * by the current Ground Glass profiles; extend that key if a profile starts consuming more fields.
 */
export const createGroundGlassFrameRequestFingerprint = (
  input: GroundGlassFrameRequestInput,
): string => {
  return JSON.stringify([
    input.channel,
    createGroundGlassSceneFingerprint(input.scene),
    input.focalLengthMm,
    input.aperture,
    input.previewMode,
    input.rawDebug,
    input.renderQuality,
    input.widthPx,
    input.heightPx,
    [
      input.inspectionWindow.active,
      input.inspectionWindow.centerU,
      input.inspectionWindow.centerV,
      input.inspectionWindow.widthFraction,
      input.inspectionWindow.heightFraction,
    ],
    input.presentationRegion,
    serializeSemanticValue(input.effectiveCameraMovementCalibration ?? null),
    // Keep this tied to the canonical domain object so newly added derived optical inputs cannot
    // silently bypass request freshness. No optical calculation is duplicated here.
    serializeSemanticValue(input.opticsState),
  ]);
};

export const normalizeGroundGlassFrameRequestInput = (
  input: Omit<GroundGlassFrameRequestInput, "inspectionWindow" | "presentationRegion" | "effectiveCameraMovementCalibration" | "rawDebug"> & {
    inspectionWindow?: GroundGlassInspectionWindow;
    presentationRegion?: CameraMovementPresentationRegion;
    effectiveCameraMovementCalibration?: EffectiveCameraMovementCalibration;
    rawDebug?: boolean;
  },
): GroundGlassFrameRequestInput => Object.freeze({
  ...input,
  rawDebug: input.rawDebug ?? false,
  inspectionWindow: input.inspectionWindow ?? FULL_GROUND_GLASS_INSPECTION_WINDOW,
  presentationRegion: input.presentationRegion ?? "middle",
  effectiveCameraMovementCalibration: input.effectiveCameraMovementCalibration,
});

export const createGroundGlassFrameRequest = (
  input: GroundGlassFrameRequestInput,
  identity: GroundGlassAcceptedRequestIdentity,
  stableSceneSnapshot?: GroundGlassFrameRequestInput["scene"],
): GroundGlassFrameRequest => Object.freeze({
  ...input,
  opticsState: cloneAndFreeze(input.opticsState),
  scene: stableSceneSnapshot ?? cloneAndFreeze(input.scene),
  inspectionWindow: cloneAndFreeze(input.inspectionWindow),
  effectiveCameraMovementCalibration: input.effectiveCameraMovementCalibration
    ? cloneAndFreeze(input.effectiveCameraMovementCalibration)
    : undefined,
  identity: Object.freeze({ ...identity }),
});

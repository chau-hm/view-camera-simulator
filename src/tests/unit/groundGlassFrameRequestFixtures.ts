import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import type { EffectiveCameraMovementCalibration } from "../../scenes/cameraMovementEffectiveCalibration";
import type { CameraState } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import type { RenderQualityProfile } from "../../types/ui";
import {
  normalizeGroundGlassFrameRequestInput,
  type GroundGlassFrameRequestInput,
} from "../../render/groundGlassFrameRequest";
import type { GroundGlassInspectionWindow } from "../../render/groundGlassInspectionWindow";
import type { CameraMovementPresentationRegion } from "../../scenes/cameraMovementSceneCalibration";
import type { GroundGlassRttChannel } from "../../render/groundGlassRttDimensions";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

export type GroundGlassRequestFixtureOptions = Readonly<{
  camera?: Partial<CameraState>;
  opticsState?: DerivedOpticsState;
  scene?: SceneDefinition;
  focalLengthMm?: number;
  widthPx?: number;
  heightPx?: number;
  aperture?: number;
  previewMode?: "raw" | "upright";
  rawDebug?: boolean;
  renderQuality?: RenderQualityProfile;
  channel?: GroundGlassRttChannel;
  inspectionWindow?: GroundGlassInspectionWindow;
  presentationRegion?: CameraMovementPresentationRegion;
  effectiveCameraMovementCalibration?: EffectiveCameraMovementCalibration;
}>;

export const createGroundGlassRequestInput = (
  options: GroundGlassRequestFixtureOptions = {},
): GroundGlassFrameRequestInput => {
  const scene = options.scene ?? architectureRiseScene;
  const camera: CameraState = {
    ...DEFAULT_CAMERA_STATE,
    ...scene.cameraPreset,
    ...options.camera,
    activeSceneId: scene.id,
  };
  return normalizeGroundGlassFrameRequestInput({
    opticsState: options.opticsState ?? deriveOpticsState(camera, scene),
    focalLengthMm: options.focalLengthMm ?? camera.focalLengthMm,
    scene,
    widthPx: options.widthPx ?? 500,
    heightPx: options.heightPx ?? 400,
    aperture: options.aperture ?? camera.aperture,
    previewMode: options.previewMode ?? "raw",
    rawDebug: options.rawDebug,
    renderQuality: options.renderQuality ?? "standard",
    channel: options.channel ?? "default",
    inspectionWindow: options.inspectionWindow,
    presentationRegion: options.presentationRegion,
    effectiveCameraMovementCalibration: options.effectiveCameraMovementCalibration,
  });
};

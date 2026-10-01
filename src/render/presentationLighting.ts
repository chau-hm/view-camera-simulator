import type { CameraMovementPresentationRegion } from "../scenes/cameraMovementSceneCalibration";
import type { CameraMovementLatticePresentation } from "../scenes/presentation/understandingCameraMovements";
import type { Vec3 } from "../types/optics";
import { vecToWorld } from "./rttUtils";
import { getSceneSubjectRegistration } from "./sceneSubjectRegistry";
import {
  DEFAULT_PRESENTATION_LIGHTING_PLACEMENT,
  TEACHING_PRESENTATION_LIGHTING_PROFILE,
  type PresentationLightingPlacement,
  type ResolvedPresentationLighting,
} from "./presentationLightingContract";
export {
  DEFAULT_PRESENTATION_LIGHTING,
  TEACHING_PRESENTATION_LIGHTING_PROFILE,
} from "./presentationLightingContract";
export type {
  PresentationLightingPlacement,
  PresentationLightingProfile,
  ResolvedPresentationLighting,
} from "./presentationLightingContract";

export type PresentationLightingSurface = "observer" | "ground-glass";

export type ScenePresentationLightingIntent = Readonly<{
  targetMm: Vec3;
  keyOffsetWorld: Readonly<{ x: number; y: number; z: number }>;
}>;

export type PresentationLightingContext = Readonly<{
  surface: PresentationLightingSurface;
  cameraMovementPresentation: CameraMovementLatticePresentation;
  presentationRegion: CameraMovementPresentationRegion;
}>;

export const resolvePresentationLightingPlacement = (
  intent?: ScenePresentationLightingIntent,
  fallback: PresentationLightingPlacement =
    DEFAULT_PRESENTATION_LIGHTING_PLACEMENT,
): PresentationLightingPlacement => ({
  targetWorld: intent ? vecToWorld(intent.targetMm) : fallback.targetWorld,
  keyOffsetWorld: intent
    ? [intent.keyOffsetWorld.x, intent.keyOffsetWorld.y, intent.keyOffsetWorld.z]
    : fallback.keyOffsetWorld,
});

/** Resolve presentation placement while keeping one shared active light recipe. */
export const resolveScenePresentationLighting = (
  sceneId: string,
  context: PresentationLightingContext,
): ResolvedPresentationLighting => {
  const registration = getSceneSubjectRegistration(sceneId);
  const intent =
    registration?.resolvePresentationLighting?.(context) ??
    registration?.presentationLighting;

  return {
    profile: TEACHING_PRESENTATION_LIGHTING_PROFILE,
    placement: resolvePresentationLightingPlacement(intent),
  };
};

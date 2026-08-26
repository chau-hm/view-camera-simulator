import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { dot, safeNormalize, subtract } from "../../core/math/vec";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  calculateDofWedgeDefocus,
  SAFE_UNRESOLVED_NORMALIZED_DEFOCUS,
  sampleDofWedge,
} from "../../core/optics/dofWedge";
import { calculateDofBlurRadiusPx } from "../../core/optics/dofBlurModel";
import { configureGroundGlassCamera } from "../../render/configureGroundGlassCamera";
import { createGroundGlassDofUniformState } from "../../render/createGroundGlassDofUniformState";
import { sampleGroundGlassBlurAtWorldPoint } from "../../render/groundGlassBlur";
import { getGroundGlassClipRangeWorld } from "../../render/groundGlassRttScenes";
import { getGroundGlassDofVisualSettings } from "../../render/groundGlassVisualSettings";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import type { ApertureValue, CameraState } from "../../types/camera";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

const cameraAt = (
  frontTiltDeg = 6.6,
  focusDistanceMm = 7750,
  aperture: ApertureValue = 11,
): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...architectureForegroundScene.cameraPreset,
  activeSceneId: architectureForegroundScene.id,
  frontRiseMm: 20,
  frontTiltDeg,
  frontSwingDeg: 0,
  focusDistanceMm,
  aperture,
});

const numericFocusFields = [
  "sharpness",
  "pointSharpness",
  "patchSharpness",
  "physicalPointSharpness",
  "physicalPatchSharpness",
  "pointNormalizedDefocus",
  "patchNormalizedDefocus",
  "normalizedDefocus",
] as const;

const expectFiniteFocusTargets = (state: ReturnType<typeof deriveOpticsState>) => {
  state.focusTargets.forEach((target) => {
    numericFocusFields.forEach((field) => {
      expect(Number.isFinite(target[field])).toBe(true);
    });
    expect(Number.isFinite(target.targetRayDistanceMm)).toBe(true);
    [target.nearBoundaryDistanceMm, target.focusBoundaryDistanceMm, target.farBoundaryDistanceMm]
      .filter((value): value is number => value !== null && value !== undefined)
      .forEach((value) => expect(Number.isFinite(value)).toBe(true));
  });
};

describe("Ground Glass DOF numerical stability", () => {
  it("keeps the Architecture + Foreground reproduction finite and identifies the non-forward focus boundary", () => {
    const optics = deriveOpticsState(cameraAt(), architectureForegroundScene);
    const targetDefinition = architectureForegroundScene.focusTargets.find(
      (target) => target.id === "building-middle",
    )!;
    const target = optics.focusTargets.find((candidate) => candidate.id === targetDefinition.id)!;
    const rayDirection = safeNormalize(
      subtract(targetDefinition.worldPosition, optics.lensCenterWorld),
    );
    const ray = { origin: optics.lensCenterWorld, direction: rayDirection };
    const signedFocusDistance = optics.focusPlane
      ? (optics.focusPlane.distance - dot(optics.focusPlane.normal, ray.origin)) /
        dot(optics.focusPlane.normal, ray.direction)
      : null;
    const wedge = sampleDofWedge({
      ray,
      targetDistanceMm: dot(
        subtract(targetDefinition.worldPosition, optics.lensCenterWorld),
        rayDirection,
      ),
      nearPlane: optics.depthOfFieldNearPlane ?? null,
      focusPlane: optics.focusPlane,
      farPlane: optics.depthOfFieldFarPlane ?? null,
    });

    expect(optics.diagnostics.fallbackApplied).toBe(false);
    expect(optics.focusPlane).not.toBeNull();
    expect(optics.depthOfFieldNearPlane).not.toBeNull();
    expect(optics.depthOfFieldFarPlane).not.toBeNull();
    expect(signedFocusDistance).toBeLessThan(0);
    expect(wedge.focusDistanceMm).toBeNull();
    expect(wedge.normalizedDefocus).toBe(SAFE_UNRESOLVED_NORMALIZED_DEFOCUS);
    expect(Number.isFinite(target.sharpness)).toBe(true);
    expect(target.sharpness).toBe(0);
    expectFiniteFocusTargets(optics);
  });

  it("keeps the nearby tilt/focus neighborhood finite", () => {
    for (const frontTiltDeg of [6, 6.2, 6.4, 6.6, 6.8, 7]) {
      for (const focusDistanceMm of [7500, 7600, 7700, 7750, 7800, 7900]) {
        const optics = deriveOpticsState(
          cameraAt(frontTiltDeg, focusDistanceMm),
          architectureForegroundScene,
        );
        expectFiniteFocusTargets(optics);
        expect(Number.isFinite(optics.diagnostics.nearU)).toBe(true);
        expect(Number.isFinite(optics.diagnostics.farU)).toBe(true);
      }
    }
  });

  it("fails closed for missing focus and reversed wedge intervals", () => {
    expect(calculateDofWedgeDefocus(1000, 500, 1000, Number.POSITIVE_INFINITY)).toEqual({
      insideDepthOfField: true,
      normalizedDefocus: 0,
    });
    expect(calculateDofWedgeDefocus(1000, 500, null, null)).toEqual({
      insideDepthOfField: false,
      normalizedDefocus: SAFE_UNRESOLVED_NORMALIZED_DEFOCUS,
    });
    expect(calculateDofWedgeDefocus(1000, 2000, 1000, null)).toEqual({
      insideDepthOfField: false,
      normalizedDefocus: SAFE_UNRESOLVED_NORMALIZED_DEFOCUS,
    });
    expect(calculateDofWedgeDefocus(1000, 500, 1000, 900)).toEqual({
      insideDepthOfField: false,
      normalizedDefocus: SAFE_UNRESOLVED_NORMALIZED_DEFOCUS,
    });
  });

  it("keeps CPU blur finite and bounded for the unresolved regression sample", () => {
    const optics = deriveOpticsState(cameraAt(), architectureForegroundScene);
    const visual = getGroundGlassDofVisualSettings(architectureForegroundScene.id);
    const worldPoint = architectureForegroundScene.focusTargets.find(
      (target) => target.id === "building-middle",
    )!.worldPosition;
    const sample = sampleGroundGlassBlurAtWorldPoint({
      worldPoint,
      opticsState: optics,
      focalLengthMm: CAMERA_CONSTANTS.focalLengthMm,
      aperture: 11,
      circleOfConfusionMm: 0.1,
      filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
      renderWidthPx: 1000,
      maximumBlurRadiusPx: visual.maximumBlurRadiusPx,
    });

    expect(sample.depthOfFieldModel).toBe("scheimpflug-wedge");
    expect(sample.normalizedDefocus).toBe(SAFE_UNRESOLVED_NORMALIZED_DEFOCUS);
    expect(Number.isFinite(sample.circleOfConfusionDiameterMm)).toBe(true);
    expect(Number.isFinite(sample.circleOfConfusionDiameterPx)).toBe(true);
    expect(Number.isFinite(sample.blurRadiusPx)).toBe(true);
    expect(sample.blurRadiusPx).toBeGreaterThanOrEqual(0);
    expect(sample.blurRadiusPx).toBeLessThanOrEqual(visual.maximumBlurRadiusPx);
  });

  it("never maps non-finite defocus to maximum blur", () => {
    const common = {
      circleOfConfusionMm: 0.1,
      filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
      renderWidthPx: 1000,
      maximumBlurRadiusPx: 48,
    };
    expect(calculateDofBlurRadiusPx({ ...common, normalizedDefocus: Number.NaN })).toBe(0);
    expect(calculateDofBlurRadiusPx({ ...common, normalizedDefocus: Number.POSITIVE_INFINITY })).toBe(0);
    const finiteRadius = calculateDofBlurRadiusPx({ ...common, normalizedDefocus: 4 });
    expect(Number.isFinite(finiteRadius)).toBe(true);
    expect(finiteRadius).toBeGreaterThanOrEqual(0);
    expect(finiteRadius).toBeLessThanOrEqual(common.maximumBlurRadiusPx);
  });

  it("builds finite DOF uniforms for the reproduction state", () => {
    const optics = deriveOpticsState(cameraAt(), architectureForegroundScene);
    const clip = getGroundGlassClipRangeWorld(architectureForegroundScene, optics.lensCenterWorld);
    const camera = new THREE.PerspectiveCamera(45, 1.25, clip.near, clip.far);
    expect(configureGroundGlassCamera(camera, optics, clip.near, clip.far).ok).toBe(true);
    const visual = getGroundGlassDofVisualSettings(architectureForegroundScene.id);
    const uniforms = createGroundGlassDofUniformState(
      optics,
      camera,
      CAMERA_CONSTANTS.focalLengthMm,
      CAMERA_CONSTANTS.filmWidthMm,
      CAMERA_CONSTANTS.filmHeightMm,
      0.1,
      11,
      500,
      400,
      visual.maximumBlurRadiusPx,
    );
    const values = [
      ...uniforms.lensCenterWorld,
      ...uniforms.focusPlanePoint,
      ...uniforms.focusPlaneNormal,
      ...(uniforms.nearPlanePoint ?? []),
      ...(uniforms.nearPlaneNormal ?? []),
      ...(uniforms.farPlanePoint ?? []),
      ...(uniforms.farPlaneNormal ?? []),
      ...uniforms.inverseProjectionMatrix,
      ...uniforms.cameraMatrixWorld,
      uniforms.imageDistanceMm,
      uniforms.focalLengthMm,
      uniforms.fNumber,
      uniforms.renderWidth,
      uniforms.renderHeight,
      uniforms.maximumBlurRadiusPx,
      uniforms.circleOfConfusionMm,
      uniforms.boundaryCoCDiameterPx,
      uniforms.boundaryBlurRadiusPx,
      uniforms.filmWidthMm,
      uniforms.filmHeightMm,
    ];
    expect(values.every(Number.isFinite)).toBe(true);
    expect(uniforms.boundaryBlurRadiusPx).toBeLessThanOrEqual(uniforms.maximumBlurRadiusPx);
  });

  it("preserves identical derived DOF results regardless of state construction order", () => {
    const direct = deriveOpticsState(cameraAt(), architectureForegroundScene);
    const afterOtherState = deriveOpticsState(
      cameraAt(2, 6830, 22),
      architectureForegroundScene,
    );
    expect(afterOtherState.focusTargets.every((target) => Number.isFinite(target.sharpness))).toBe(true);
    const repeated = deriveOpticsState(cameraAt(), architectureForegroundScene);
    expect(repeated.focusTargets).toEqual(direct.focusTargets);
    expect(repeated.focusPlane).toEqual(direct.focusPlane);
    expect(repeated.depthOfFieldNearPlane).toEqual(direct.depthOfFieldNearPlane);
    expect(repeated.depthOfFieldFarPlane).toEqual(direct.depthOfFieldFarPlane);
  });
});

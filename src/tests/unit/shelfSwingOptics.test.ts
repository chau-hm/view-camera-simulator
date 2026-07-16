import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { pointToPlaneDistance } from "../../core/math/plane";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { configureGroundGlassCamera } from "../../render/configureGroundGlassCamera";
import { createGroundGlassDofUniformState } from "../../render/createGroundGlassDofUniformState";
import { sampleGroundGlassBlurAtWorldPoint } from "../../render/groundGlassBlur";
import { projectSceneFocusTargetsToGroundGlass } from "../../render/groundGlassTargetProjection";
import {
  getGroundGlassDofVisualSettings,
  resolveGroundGlassDisplayOpticsState,
} from "../../render/groundGlassVisualSettings";
import {
  getGroundGlassClipRangeWorld,
  isGroundGlassRttScene,
} from "../../render/groundGlassRttScenes";
import {
  createScenePlaneOverlayGeometry,
  getScenePlaneOverlayBounds,
} from "../../render/scenePlaneOverlayGeometry";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import geometry from "../../scenes/shelfSwingGeometry";
import type { CameraState } from "../../types/camera";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

const cameraFor = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...shelfSwingScene.cameraPreset,
  activeSceneId: shelfSwingScene.id,
  ...overrides,
});

const calibratedCamera = (overrides: Partial<CameraState> = {}): CameraState =>
  cameraFor({
    frontRiseMm: geometry.shelfSwingCalibration.frontRiseMm,
    frontTiltDeg: geometry.shelfSwingCalibration.frontTiltDeg,
    frontSwingDeg: geometry.shelfSwingCalibration.frontSwingDeg,
    focusDistanceMm: geometry.shelfSwingCalibration.focusDistanceMm,
    aperture: geometry.shelfSwingCalibration.aperture,
    ...overrides,
  });

describe("Shelf Swing optics calibration", () => {
  it("focuses the middle chart at zero swing without making all three targets sharp", () => {
    const state = deriveOpticsState(
      cameraFor({
        frontSwingDeg: 0,
        focusDistanceMm: geometry.middleSubject.focusDetailProbeWorld.z,
        aperture: 11,
      }),
      shelfSwingScene,
    );
    expect(state.diagnostics.fallbackApplied).toBe(false);
    expect(state.focusTargets.find((target) => target.id === "shelf-middle")?.pointSharpness).toBeGreaterThanOrEqual(
      geometry.shelfSwingCalibration.targetSharpnessMinimum,
    );
    expect(
      state.focusTargets.every(
        (target) => target.sharpness >= geometry.shelfSwingCalibration.targetSharpnessMinimum,
      ),
    ).toBe(false);
  });

  it("makes all three sampled chart surfaces sharp at the calibrated signed swing", () => {
    const camera = calibratedCamera();
    const state = deriveOpticsState(camera, shelfSwingScene);

    expect(camera.frontRiseMm).toBe(0);
    expect(camera.frontTiltDeg).toBe(0);
    expect(state.diagnostics.fallbackApplied).toBe(false);
    expect(state.diagnostics.focusPlaneModel).toBe("scheimpflug");
    expect(state.focusTargets).toHaveLength(3);
    state.focusTargets.forEach((target) => {
      expect(target.sharpness).toBeGreaterThanOrEqual(
        geometry.shelfSwingCalibration.targetSharpnessMinimum,
      );
      expect(target.insideDepthOfField).toBe(true);
    });
  });

  it("does not pass all targets when the swing sign is reversed", () => {
    const calibrated = deriveOpticsState(calibratedCamera(), shelfSwingScene);
    const state = deriveOpticsState(
      calibratedCamera({ frontSwingDeg: -geometry.shelfSwingCalibration.frontSwingDeg }),
      shelfSwingScene,
    );
    expect(state.diagnostics.fallbackApplied).toBe(false);
    expect(
      state.focusTargets.every(
        (target) => target.sharpness >= geometry.shelfSwingCalibration.targetSharpnessMinimum,
      ),
    ).toBe(false);
    const calibratedEnds = calibrated.focusTargets.filter((target) => target.id !== "shelf-middle");
    const wrongEnds = state.focusTargets.filter((target) => target.id !== "shelf-middle");
    expect(Math.min(...wrongEnds.map((target) => target.sharpness))).toBeLessThan(
      Math.min(...calibratedEnds.map((target) => target.sharpness)),
    );
  });

  it("derives a focus plane through all three centre probes", () => {
    const state = deriveOpticsState(calibratedCamera(), shelfSwingScene);
    expect(state.focusPlane).not.toBeNull();
    geometry.subjects.forEach((subject) => {
      expect(pointToPlaneDistance(subject.focusDetailProbeWorld, state.focusPlane!)).toBeLessThan(
        geometry.shelfSwingCalibration.planeIntersectionToleranceMm,
      );
    });
  });

  it("registers Shelf Swing for RTT and keeps the full canonical subject inside clipping", () => {
    expect(isGroundGlassRttScene(shelfSwingScene.id)).toBe(true);
    const optics = deriveOpticsState(calibratedCamera(), shelfSwingScene);
    const clip = getGroundGlassClipRangeWorld(shelfSwingScene, optics.lensCenterWorld);
    expect(clip.near).toBeGreaterThan(0);
    expect(Number.isFinite(clip.far)).toBe(true);

    const maximumBackDepthMm = Math.max(
      ...geometry.getSubjectWorldBoundsCorners(geometry.backSubject).map((point) => point.z),
      ...geometry.backSubject.focusSamples.map((sample) => sample.worldPosition.z),
    );
    expect((maximumBackDepthMm - optics.lensCenterWorld.z) * 0.001).toBeLessThan(clip.far);
  });

  it("configures finite off-axis RTT camera and derived-plane uniforms", () => {
    const optics = deriveOpticsState(calibratedCamera(), shelfSwingScene);
    const clip = getGroundGlassClipRangeWorld(shelfSwingScene, optics.lensCenterWorld);
    const camera = new THREE.PerspectiveCamera(45, 1.25, clip.near, clip.far);
    const configured = configureGroundGlassCamera(camera, optics, clip.near, clip.far);
    expect(configured.ok).toBe(true);

    const visual = getGroundGlassDofVisualSettings(shelfSwingScene.id);
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
      visual.displayBlurScale,
    );
    expect(uniforms.mode).toBe(1);
    expect(
      [
        ...uniforms.focusPlanePoint,
        ...uniforms.focusPlaneNormal,
        ...(uniforms.nearPlanePoint ?? []),
        ...(uniforms.farPlanePoint ?? []),
        ...uniforms.inverseProjectionMatrix,
        ...uniforms.cameraMatrixWorld,
      ].every(Number.isFinite),
    ).toBe(true);
  });

  it("uses display-only DOF scaling while preserving physical target evaluation", () => {
    const camera = cameraFor({
      frontSwingDeg: 0,
      focusDistanceMm: geometry.middleSubject.focusDetailProbeWorld.z,
      aperture: 11,
    });
    const optics = deriveOpticsState(camera, shelfSwingScene);
    const visual = getGroundGlassDofVisualSettings(shelfSwingScene.id);
    expect(visual).toEqual({
      maximumBlurRadiusPx: 42,
      displayBlurScale: 3.2,
      planeMode: "derived-planes",
    });
    const displayOptics = resolveGroundGlassDisplayOpticsState(shelfSwingScene.id, optics);

    const displayed = geometry.subjects.map((subject) =>
      sampleGroundGlassBlurAtWorldPoint({
        worldPoint: subject.focusDetailProbeWorld,
        opticsState: displayOptics,
        focalLengthMm: CAMERA_CONSTANTS.focalLengthMm,
        aperture: 11,
        circleOfConfusionMm: 0.1,
        filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
        renderWidthPx: 1000,
        maximumBlurRadiusPx: visual.maximumBlurRadiusPx,
        displayBlurScale: visual.displayBlurScale,
      }),
    );
    expect(displayed[1].blurRadiusPx).toBeLessThan(0.01);
    expect(Math.max(displayed[0].blurRadiusPx, displayed[2].blurRadiusPx)).toBeGreaterThan(1);
  });

  it("projects every chart centre consistently in raw and upright modes", () => {
    const optics = deriveOpticsState(calibratedCamera(), shelfSwingScene);
    const raw = projectSceneFocusTargetsToGroundGlass({
      sceneDef: shelfSwingScene,
      opticsState: optics,
      aperture: 11,
      previewMode: "raw",
    });
    const upright = projectSceneFocusTargetsToGroundGlass({
      sceneDef: shelfSwingScene,
      opticsState: optics,
      aperture: 11,
      previewMode: "upright",
    });

    expect(raw.map((target) => target.id)).toEqual([
      "shelf-front",
      "shelf-middle",
      "shelf-back",
    ]);
    raw.forEach((target, index) => {
      expect(target.visible).toBe(true);
      expect(target.rawUv).toEqual(upright[index].rawUv);
      expect(target.displayUv.u).toBeCloseTo(1 - upright[index].displayUv.u, 10);
      expect(target.displayUv.v).toBeCloseTo(1 - upright[index].displayUv.v, 10);
    });
  });

  it("creates finite scene-bounded focus and DOF overlays at calibrated swing", () => {
    const optics = deriveOpticsState(calibratedCamera(), shelfSwingScene);
    const bounds = getScenePlaneOverlayBounds(shelfSwingScene);
    [optics.focusPlane, optics.depthOfFieldNearPlane, optics.depthOfFieldFarPlane].forEach(
      (plane) => {
        expect(plane).not.toBeNull();
        const overlay = createScenePlaneOverlayGeometry(plane!, bounds);
        expect(overlay).not.toBeNull();
        expect(overlay!.verticesMm.length).toBeGreaterThanOrEqual(4);
        overlay!.verticesMm.forEach((vertex) => {
          expect(Object.values(vertex).every(Number.isFinite)).toBe(true);
          expect(vertex.x).toBeGreaterThanOrEqual(bounds.min.x - 1e-5);
          expect(vertex.x).toBeLessThanOrEqual(bounds.max.x + 1e-5);
          expect(vertex.z).toBeGreaterThanOrEqual(bounds.min.z - 1e-5);
          expect(vertex.z).toBeLessThanOrEqual(bounds.max.z + 1e-5);
        });
      },
    );
  });
});

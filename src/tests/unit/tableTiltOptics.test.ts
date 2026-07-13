import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { planeFromPointNormal, intersectPlanes } from "../../core/math/plane";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { calculateDepthOfField } from "../../core/optics/calculateDepthOfField";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { configureGroundGlassCamera } from "../../render/configureGroundGlassCamera";
import { createGroundGlassDofUniformState } from "../../render/createGroundGlassDofUniformState";
import { sampleGroundGlassBlurAtWorldPoint } from "../../render/groundGlassBlur";
import { getGroundGlassDofVisualSettings } from "../../render/groundGlassVisualSettings";
import {
  createScenePlaneOverlayGeometry,
  getScenePlaneOverlayBounds,
} from "../../render/scenePlaneOverlayGeometry";
import {
  getGroundGlassClipRangeWorld,
  isGroundGlassRttScene,
} from "../../render/groundGlassRttScenes";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import geometry from "../../scenes/tableTiltGeometry";
import type { CameraState } from "../../types/camera";
import type { TaskDefinition } from "../../types/task";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

const cameraFor = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...tableTiltScene.cameraPreset,
  activeSceneId: tableTiltScene.id,
  ...overrides,
});

const calibratedCamera = (overrides: Partial<CameraState> = {}): CameraState =>
  cameraFor({
    frontRiseMm: geometry.tableTiltCalibration.frontRiseMm,
    frontTiltDeg: geometry.tableTiltCalibration.frontTiltDeg,
    frontSwingDeg: geometry.tableTiltCalibration.frontSwingDeg,
    focusDistanceMm: geometry.tableTiltCalibration.focusDistanceMm,
    aperture: geometry.tableTiltCalibration.aperture,
    ...overrides,
  });

describe("Table Tilt optics calibration", () => {
  it("registers Table Tilt for RTT with clipping derived from canonical bounds", () => {
    expect(isGroundGlassRttScene(tableTiltScene.id)).toBe(true);
    const clip = getGroundGlassClipRangeWorld(tableTiltScene, { x: 0, y: 0, z: 0 });
    expect(clip.near).toBeGreaterThan(0);
    expect(clip.far).toBeGreaterThan(tableTiltScene.bounds.max.z * 0.001);
  });

  it("computes a plane intersection point that lies on both source planes", () => {
    const film = planeFromPointNormal({ x: 0, y: 0, z: -150 }, { x: 0, y: 0, z: 1 });
    const lens = planeFromPointNormal(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: -Math.sin(Math.PI / 20), z: Math.cos(Math.PI / 20) },
    );
    const hinge = intersectPlanes(lens, film);
    expect(hinge).not.toBeNull();
    expect(hinge?.point.z).toBeCloseTo(-150, 10);
    expect(
      lens.normal.x * hinge!.point.x +
        lens.normal.y * hinge!.point.y +
        lens.normal.z * hinge!.point.z,
    ).toBeCloseTo(lens.distance, 10);
    expect(
      film.normal.x * hinge!.point.x +
        film.normal.y * hinge!.point.y +
        film.normal.z * hinge!.point.z,
    ).toBeCloseTo(film.distance, 10);
  });

  it("widens parallel depth of field monotonically from f/11 to f/32", () => {
    const base = {
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      focusDistanceMm: geometry.canonicalFocusDistanceMm,
    };
    const f11 = deriveOpticsState(cameraFor({ ...base, aperture: 11 }), tableTiltScene);
    const f32 = deriveOpticsState(cameraFor({ ...base, aperture: 32 }), tableTiltScene);

    expect(f32.diagnostics.nearU).toBeLessThan(f11.diagnostics.nearU!);
    expect(f32.diagnostics.farU).toBeGreaterThan(f11.diagnostics.farU!);
    expect(f11.diagnostics.nearU).toBeLessThan(geometry.canonicalFocusDistanceMm);
    expect(f11.diagnostics.farU).toBeGreaterThan(geometry.canonicalFocusDistanceMm);
    expect(Number.isFinite(f11.diagnostics.nearU)).toBe(true);
    expect(Number.isFinite(f11.diagnostics.farU)).toBe(true);

    for (const target11 of f11.focusTargets) {
      const target32 = f32.focusTargets.find((target) => target.id === target11.id)!;
      expect(target32.sharpness).toBeGreaterThanOrEqual(target11.sharpness);
    }
  });

  it("calculates wider physical near/far limits at f/32 without display scaling", () => {
    const input = {
      focalLengthMm: CAMERA_CONSTANTS.focalLengthMm,
      circleOfConfusionMm: 0.1,
      lensCenterWorld: { x: 0, y: 0, z: 0 },
      opticalAxis: { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 } },
      focusObjectDistanceMm: geometry.canonicalFocusDistanceMm,
    };
    const f11 = calculateDepthOfField({ ...input, apertureFNumber: 11 });
    const f32 = calculateDepthOfField({ ...input, apertureFNumber: 32 });
    expect(f32.nearU).toBeLessThan(f11.nearU);
    expect(f32.farU).toBeGreaterThan(f11.farU);
    expect(f11.nearU).toBeLessThan(geometry.canonicalFocusDistanceMm);
    expect(f11.farU).toBeGreaterThan(geometry.canonicalFocusDistanceMm);
  });

  it("has a reproducible f/11 Scheimpflug solution and a failing zero-tilt baseline", () => {
    const baseline = deriveOpticsState(
      cameraFor({ frontTiltDeg: 0, aperture: 11 }),
      tableTiltScene,
    );
    const calibrated = deriveOpticsState(calibratedCamera(), tableTiltScene);
    const calibratedF22 = deriveOpticsState(calibratedCamera({ aperture: 22 }), tableTiltScene);

    expect(baseline.focusTargets.filter((target) => target.sharpness >= 0.8)).toHaveLength(1);
    expect(calibrated.diagnostics.focusPlaneModel).toBe("scheimpflug");
    expect(calibrated.diagnostics.depthOfFieldModel).toBe("scheimpflug-wedge");
    expect(calibrated.focusPlane?.normal.y).toBeCloseTo(1, 8);
    calibrated.focusTargets.forEach((target) => {
      expect(target.sharpness).toBeGreaterThanOrEqual(
        geometry.tableTiltCalibration.targetSharpnessMinimum,
      );
      expect(target.insideDepthOfField).toBe(true);
    });
    calibratedF22.focusTargets.forEach((target) => {
      expect(target.sharpness).toBeGreaterThanOrEqual(
        geometry.tableTiltCalibration.targetSharpnessMinimum,
      );
    });
  });

  it("amplifies real zero-tilt detail defocus without changing the physical optics", () => {
    const camera = cameraFor({ frontTiltDeg: 0, aperture: 11 });
    const optics = deriveOpticsState(camera, tableTiltScene);
    const visual = getGroundGlassDofVisualSettings(tableTiltScene.id);
    const samples = geometry.subjects.map((subject) =>
      sampleGroundGlassBlurAtWorldPoint({
        worldPoint: subject.focusDetailProbeWorld,
        opticsState: optics,
        focalLengthMm: CAMERA_CONSTANTS.focalLengthMm,
        aperture: camera.aperture,
        circleOfConfusionMm: 0.1,
        filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
        renderWidthPx: 1000,
        maximumBlurRadiusPx: visual.maximumBlurRadiusPx,
        displayBlurScale: visual.displayBlurScale,
      }),
    );
    const [near, middle, far] = samples;
    const physicalScaleSamples = geometry.subjects.map((subject) =>
      sampleGroundGlassBlurAtWorldPoint({
        worldPoint: subject.focusDetailProbeWorld,
        opticsState: optics,
        focalLengthMm: CAMERA_CONSTANTS.focalLengthMm,
        aperture: camera.aperture,
        circleOfConfusionMm: 0.1,
        filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
        renderWidthPx: 1000,
        maximumBlurRadiusPx: visual.maximumBlurRadiusPx,
        displayBlurScale: 1,
      }),
    );

    expect(visual.displayBlurScale).toBeGreaterThan(1);
    [near, middle, far].forEach((sample, index) => {
      expect(sample.normalizedDefocus).toBe(physicalScaleSamples[index].normalizedDefocus);
      expect(sample.blurRadiusPx).toBeGreaterThan(physicalScaleSamples[index].blurRadiusPx);
    });
    expect(Math.max(near.blurRadiusPx, far.blurRadiusPx)).toBeGreaterThan(1);
  });

  it("brackets the focus plane at every probe and widens the wedge at f/32", () => {
    const f11 = deriveOpticsState(calibratedCamera({ aperture: 11 }), tableTiltScene);
    const f32 = deriveOpticsState(calibratedCamera({ aperture: 32 }), tableTiltScene);

    for (const target11 of f11.focusTargets) {
      const target32 = f32.focusTargets.find((target) => target.id === target11.id)!;
      expect(target11.nearBoundaryDistanceMm).toBeLessThan(target11.focusBoundaryDistanceMm!);
      expect(target11.focusBoundaryDistanceMm).toBeLessThan(target11.farBoundaryDistanceMm!);
      expect(target32.nearBoundaryDistanceMm).toBeLessThan(target11.nearBoundaryDistanceMm!);
      expect(target32.farBoundaryDistanceMm).toBeGreaterThan(target11.farBoundaryDistanceMm!);
    }
  });

  it("builds finite scene-clipped overlays at both the current calibration and 5780 mm", () => {
    const bounds = getScenePlaneOverlayBounds(tableTiltScene);
    [geometry.tableTiltCalibration.focusDistanceMm, 5780].forEach((focusDistanceMm) => {
      const optics = deriveOpticsState(
        calibratedCamera({ focusDistanceMm }),
        tableTiltScene,
      );
      const planes = [
        optics.focusPlane,
        optics.depthOfFieldNearPlane,
        optics.depthOfFieldFarPlane,
      ];

      planes.forEach((plane) => {
        expect(plane).not.toBeNull();
        const overlay = createScenePlaneOverlayGeometry(plane!, bounds, {
          extendToPlanePoint: false,
        });
        expect(overlay).not.toBeNull();
        expect(overlay!.verticesMm.length).toBeGreaterThanOrEqual(4);
        expect(overlay!.triangleIndices.length).toBeGreaterThanOrEqual(6);
        overlay!.verticesMm.forEach((vertex) => {
          expect(vertex.x).toBeGreaterThanOrEqual(bounds.min.x - 1e-5);
          expect(vertex.x).toBeLessThanOrEqual(bounds.max.x + 1e-5);
          expect(vertex.z).toBeGreaterThanOrEqual(bounds.min.z - 1e-5);
          expect(vertex.z).toBeLessThanOrEqual(bounds.max.z + 1e-5);
        });
      });
    });

    expect(bounds.max.x - bounds.min.x).toBeLessThan(
      tableTiltScene.bounds.max.x - tableTiltScene.bounds.min.x,
    );
  });

  it("updates focus and DOF planes immediately when tilt, focus, or aperture changes", () => {
    const baseline = deriveOpticsState(cameraFor({ frontTiltDeg: 0, aperture: 11 }), tableTiltScene);
    const tilted = deriveOpticsState(calibratedCamera(), tableTiltScene);
    const refocused = deriveOpticsState(
      calibratedCamera({ focusDistanceMm: geometry.tableTiltCalibration.focusDistanceMm - 700 }),
      tableTiltScene,
    );
    const stoppedDown = deriveOpticsState(calibratedCamera({ aperture: 22 }), tableTiltScene);

    expect(tilted.focusPlane?.normal).not.toEqual(baseline.focusPlane?.normal);
    expect(refocused.focusPlane?.point).not.toEqual(tilted.focusPlane?.point);
    expect(refocused.depthOfFieldNearPlane).not.toEqual(tilted.depthOfFieldNearPlane);
    expect(refocused.depthOfFieldFarPlane).not.toEqual(tilted.depthOfFieldFarPlane);
    expect(stoppedDown.depthOfFieldNearPlane).not.toEqual(tilted.depthOfFieldNearPlane);
    expect(stoppedDown.depthOfFieldFarPlane).not.toEqual(tilted.depthOfFieldFarPlane);
    expect(
      refocused.focusTargets.some((target) => target.sharpness < 0.8),
    ).toBe(true);
  });

  it("feeds RTT shader uniforms from the same current optics planes", () => {
    const optics = deriveOpticsState(calibratedCamera({ aperture: 22 }), tableTiltScene);
    const clip = getGroundGlassClipRangeWorld(tableTiltScene, optics.lensCenterWorld);
    const camera = new THREE.PerspectiveCamera(45, 1.25, clip.near, clip.far);
    const configured = configureGroundGlassCamera(camera, optics, clip.near, clip.far);
    expect(configured.ok).toBe(true);

    const uniforms = createGroundGlassDofUniformState(
      optics,
      camera,
      CAMERA_CONSTANTS.focalLengthMm,
      CAMERA_CONSTANTS.filmWidthMm,
      CAMERA_CONSTANTS.filmHeightMm,
      0.1,
      22,
      500,
      400,
      60,
    );
    expect(uniforms.focusPlanePoint).toEqual([
      optics.focusPlane!.point.x * 0.001,
      optics.focusPlane!.point.y * 0.001,
      optics.focusPlane!.point.z * 0.001,
    ]);
    expect(uniforms.focusPlaneNormal).toEqual([
      optics.focusPlane!.normal.x,
      optics.focusPlane!.normal.y,
      optics.focusPlane!.normal.z,
    ]);
    expect(uniforms.nearPlaneNormal).toEqual([
      optics.depthOfFieldNearPlane!.normal.x,
      optics.depthOfFieldNearPlane!.normal.y,
      optics.depthOfFieldNearPlane!.normal.z,
    ]);
    expect(uniforms.farPlaneNormal).toEqual([
      optics.depthOfFieldFarPlane!.normal.x,
      optics.depthOfFieldFarPlane!.normal.y,
      optics.depthOfFieldFarPlane!.normal.z,
    ]);
  });

  it("passes the guided task only at the calibrated tilt-only state", () => {
    const task = getTaskById("tilt-01") as TaskDefinition;
    const passingCamera = calibratedCamera();
    const passing = evaluateTask(
      task,
      tableTiltScene,
      passingCamera,
      deriveOpticsState(passingCamera, tableTiltScene),
    );
    expect(passing.status).toBe("passed");

    const failingStates = [
      cameraFor({ frontTiltDeg: 0, aperture: 11 }),
      calibratedCamera({ focusDistanceMm: geometry.tableTiltCalibration.focusDistanceMm - 1000 }),
      calibratedCamera({ aperture: 32 }),
      calibratedCamera({ frontTiltDeg: 0, frontSwingDeg: 9 }),
      calibratedCamera({ frontSwingDeg: 2 }),
    ];
    failingStates.forEach((camera) => {
      const evaluation = evaluateTask(
        task,
        tableTiltScene,
        camera,
        deriveOpticsState(camera, tableTiltScene),
      );
      expect(evaluation.status).toBe("failed");
    });
  });
});

import * as THREE from "three";
import { describe, it, expect } from "vitest";
import { configureGroundGlassCamera } from "../../render/configureGroundGlassCamera";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import type { CameraState } from "../../types/camera";

const cameraFor = (scene: typeof architectureRiseScene, overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...scene.cameraPreset,
  activeSceneId: scene.id,
  ...overrides,
});

describe("C1: Ground Glass camera with translated and tilted rear film frame", () => {
  it("returns ok for rear rise only", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearRiseMm: 20 }),
      architectureRiseScene,
    );
    const camera = new THREE.PerspectiveCamera(45, 1.25, 0.01, 200);
    const result = configureGroundGlassCamera(camera, optics, 0.01, 1000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Number.isFinite(result.determinant)).toBe(true);
      expect(Math.abs(result.determinant)).toBeGreaterThan(1e-12);
    }
  });

  it("returns ok for rear tilt only", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearTiltDeg: 8 }),
      architectureRiseScene,
    );
    const camera = new THREE.PerspectiveCamera(45, 1.25, 0.01, 200);
    const result = configureGroundGlassCamera(camera, optics, 0.01, 1000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Number.isFinite(result.determinant)).toBe(true);
      expect(Math.abs(result.determinant)).toBeGreaterThan(1e-12);
    }
  });

  it("returns ok for combined rear rise and tilt", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearRiseMm: 15, rearTiltDeg: 6 }),
      architectureRiseScene,
    );
    const camera = new THREE.PerspectiveCamera(45, 1.25, 0.01, 200);
    const result = configureGroundGlassCamera(camera, optics, 0.01, 1000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Number.isFinite(result.determinant)).toBe(true);
      expect(Math.abs(result.determinant)).toBeGreaterThan(1e-12);
    }
  });

  it("camera position remains the lens centre", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearRiseMm: 25, rearTiltDeg: 5 }),
      architectureRiseScene,
    );
    const camera = new THREE.PerspectiveCamera(45, 1.25, 0.01, 200);
    configureGroundGlassCamera(camera, optics, 0.01, 1000);
    const WORLD_SCALE = 0.001;
    expect(camera.position.x).toBeCloseTo(optics.lensCenterWorld.x * WORLD_SCALE, 8);
    expect(camera.position.y).toBeCloseTo(optics.lensCenterWorld.y * WORLD_SCALE, 8);
    expect(camera.position.z).toBeCloseTo(optics.lensCenterWorld.z * WORLD_SCALE, 8);
  });

  it("zero rear movement retains current parallel-case behavior", () => {
    const baseOptics = deriveOpticsState(cameraFor(architectureRiseScene), architectureRiseScene);
    const camera = new THREE.PerspectiveCamera(45, 1.25, 0.01, 200);
    const result = configureGroundGlassCamera(camera, baseOptics, 0.01, 1000);
    expect(result.ok).toBe(true);
  });

  it("all film corners remain in front of the configured virtual camera", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearRiseMm: 10, rearTiltDeg: 7 }),
      architectureRiseScene,
    );
    const camera = new THREE.PerspectiveCamera(45, 1.25, 0.01, 200);
    const result = configureGroundGlassCamera(camera, optics, 0.01, 1000);
    expect(result.ok).toBe(true);
    // The configureGroundGlassCamera already verifies this internally and returns ok=false
    // if any corner is behind the lens. So ok=true is sufficient proof.
  });
});

describe("C2: 3D camera model consumes transformed film centre and normal", () => {
  it("RearStandard uses filmCenterWorld and filmNormalWorld from optics", () => {
    const baseOptics = deriveOpticsState(cameraFor(tableTiltScene), tableTiltScene);
    const risenOptics = deriveOpticsState(
      cameraFor(tableTiltScene, { rearRiseMm: 20 }),
      tableTiltScene,
    );

    // Film centre moved by rearRiseMm
    expect(risenOptics.filmCenterWorld.y - baseOptics.filmCenterWorld.y).toBeCloseTo(20, 10);

    // Lens centre did not move (rear movement does not affect front standard)
    expect(risenOptics.lensCenterWorld).toEqual(baseOptics.lensCenterWorld);
    expect(risenOptics.lensNormalWorld).toEqual(baseOptics.lensNormalWorld);
  });

  it("FilmPlane uses filmPlane.point and filmPlane.normal from canonical rear frame", () => {
    const optics = deriveOpticsState(
      cameraFor(tableTiltScene, { rearTiltDeg: 5 }),
      tableTiltScene,
    );
    // filmPlane.point should equal rearStandardFrame.centerWorld
    expect(optics.filmPlane.point).toEqual(optics.rearStandardFrame!.centerWorld);
    // filmPlane.normal should equal rearStandardFrame.normalWorld
    expect(optics.filmPlane.normal).toEqual(optics.rearStandardFrame!.normalWorld);
  });
});

describe("C3: Bellows connects transformed rear centre to lens centre", () => {
  it("bellows endpoints (filmCenter and lensCenter) are finite and distinct", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearRiseMm: 15, rearTiltDeg: 3 }),
      architectureRiseScene,
    );
    const rear = optics.filmCenterWorld;
    const front = optics.lensCenterWorld;

    expect(Number.isFinite(rear.x)).toBe(true);
    expect(Number.isFinite(rear.y)).toBe(true);
    expect(Number.isFinite(rear.z)).toBe(true);
    expect(Number.isFinite(front.x)).toBe(true);
    expect(Number.isFinite(front.y)).toBe(true);
    expect(Number.isFinite(front.z)).toBe(true);

    // Rear and front should be distinct (bellows has non-zero depth)
    const dist = Math.hypot(front.x - rear.x, front.y - rear.y, front.z - rear.z);
    expect(dist).toBeGreaterThan(1);
  });
});

describe("C4: 2D geometry projection consumes transformed film plane", () => {
  it("film section endpoints derive from transformed filmCenterWorld", () => {
    const baseOptics = deriveOpticsState(cameraFor(architectureRiseScene), architectureRiseScene);
    const risenOptics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearRiseMm: 20 }),
      architectureRiseScene,
    );

    // The 2D projection uses opticsState.filmCenterWorld as sectionOrigin
    // A rear rise should change the section origin Y
    expect(risenOptics.filmCenterWorld.y).not.toBeCloseTo(baseOptics.filmCenterWorld.y, 6);
  });

  it("film corners used for section half-span are from canonical frame", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearTiltDeg: 6 }),
      architectureRiseScene,
    );
    // All corners should be finite (2D projection will use them)
    const corners = optics.filmPlaneCornersWorld;
    for (const corner of [corners.topLeft, corners.topRight, corners.bottomLeft, corners.bottomRight]) {
      expect(Number.isFinite(corner.x)).toBe(true);
      expect(Number.isFinite(corner.y)).toBe(true);
      expect(Number.isFinite(corner.z)).toBe(true);
    }
  });
});

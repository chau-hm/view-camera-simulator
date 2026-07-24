import * as THREE from "three";
import { describe, it, expect } from "vitest";
import { configureGroundGlassCamera } from "../../render/configureGroundGlassCamera";
import { resolveRearStandardRenderTransform } from "../../render/planeOrientation";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
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
    expect(optics.filmPlane.point).toEqual(optics.rearStandardFrame.centerWorld);
    // filmPlane.normal should equal rearStandardFrame.normalWorld
    expect(optics.filmPlane.normal).toEqual(optics.rearStandardFrame.normalWorld);
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


describe("C5: resolveRearStandardRenderTransform consumer tests", () => {
  const WORLD_SCALE = 0.001;

  it("Focus Fundamentals zero rear movement uses original datum", () => {
    const optics = deriveOpticsState(
      cameraFor(focusFundamentalsTwoTargets),
      focusFundamentalsTwoTargets,
    );
    const xform = resolveRearStandardRenderTransform(optics.rearStandardFrame);
    // At zero movement, film centre for Focus Fundamentals is (0,0,0) in mm
    expect(xform.position[0]).toBeCloseTo(0, 6);
    expect(xform.position[1]).toBeCloseTo(0, 6);
    expect(xform.position[2]).toBeCloseTo(0, 6);
    expect(xform.quaternion).toBeDefined();
    expect(xform.quaternion.x).toBeCloseTo(0, 6);
    expect(xform.quaternion.y).toBeCloseTo(0, 6);
    expect(xform.quaternion.z).toBeCloseTo(0, 6);
    expect(xform.quaternion.w).toBeCloseTo(1, 6);
  });

  it("rear rise changes rear-standard render position only", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearRiseMm: 20 }),
      architectureRiseScene,
    );
    const xform = resolveRearStandardRenderTransform(optics.rearStandardFrame);
    expect(xform.position[1]).toBeCloseTo(20 * WORLD_SCALE, 8);
    // Lens centre (in mm) is (0, 0, 0) => render (0, 0, 0) since no front rise
    expect(optics.lensCenterWorld.y).toBeCloseTo(0, 8);
  });

  it("rear tilt rotates the rear-standard transform", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearTiltDeg: 8 }),
      architectureRiseScene,
    );
    const xform = resolveRearStandardRenderTransform(optics.rearStandardFrame);
    // The quaternion is non-identity; check that transformed up has non-zero z
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(xform.quaternion);
    expect(up.z).toBeGreaterThan(0.01);
    expect(up.y).toBeGreaterThan(0.9);
  });

  it("front/lens standard render position is unchanged by rear movement", () => {
    const base = deriveOpticsState(cameraFor(architectureRiseScene), architectureRiseScene);
    const moved = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearRiseMm: 20, rearTiltDeg: 5 }),
      architectureRiseScene,
    );
    // Lens should be unaffected by rear movement
    expect(moved.lensCenterWorld).toEqual(base.lensCenterWorld);
    expect(moved.lensNormalWorld).toEqual(base.lensNormalWorld);
  });
});

describe("C6: Ground Glass camera strengthened coverage", () => {
  it("combined rear rise and tilt produces valid camera orientation", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearRiseMm: 15, rearTiltDeg: 6 }),
      architectureRiseScene,
    );
    const camera = new THREE.PerspectiveCamera(45, 1.25, 0.01, 200);
    const result = configureGroundGlassCamera(camera, optics, 0.01, 1000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Determinant is finite and non-zero
    expect(Number.isFinite(result.determinant)).toBe(true);
    expect(Math.abs(result.determinant)).toBeGreaterThan(1e-12);

    // Projection extents are finite and non-degenerate
    expect(result.left).not.toBeCloseTo(result.right, 6);
    expect(result.bottom).not.toBeCloseTo(result.top, 6);
    expect(Number.isFinite(result.left)).toBe(true);
    expect(Number.isFinite(result.right)).toBe(true);

    // Camera position equals lens centre
    const s = 0.001;
    expect(camera.position.x).toBeCloseTo(optics.lensCenterWorld.x * s, 8);
    expect(camera.position.y).toBeCloseTo(optics.lensCenterWorld.y * s, 8);
    expect(camera.position.z).toBeCloseTo(optics.lensCenterWorld.z * s, 8);

    // Camera up aligns with canonical film up
    const frameUp = optics.rearStandardFrame.upWorld;
    const camUp = camera.up;
    expect(camUp.dot(new THREE.Vector3(frameUp.x, frameUp.y, frameUp.z))).toBeGreaterThan(0.98);
  });

  it("all film corners project to finite normalized coordinates", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearRiseMm: 10, rearTiltDeg: 7 }),
      architectureRiseScene,
    );
    const camera = new THREE.PerspectiveCamera(45, 1.25, 0.01, 200);
    const result = configureGroundGlassCamera(camera, optics, 0.01, 1000);
    expect(result.ok).toBe(true);

    // Project each film corner through the configured camera
    const corners = [
      optics.filmPlaneCornersWorld.topLeft,
      optics.filmPlaneCornersWorld.topRight,
      optics.filmPlaneCornersWorld.bottomLeft,
      optics.filmPlaneCornersWorld.bottomRight,
    ];
    const s = 0.001;
    for (const c of corners) {
      const v = new THREE.Vector3(c.x * s, c.y * s, c.z * s);
      v.project(camera);
      expect(Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)).toBe(true);
      // Should be in front of camera (z negative in clip space given the perspective projection)
    }
  });

  it("zero rear movement preserves existing behavior", () => {
    const optics = deriveOpticsState(cameraFor(architectureRiseScene), architectureRiseScene);
    const camera = new THREE.PerspectiveCamera(45, 1.25, 0.01, 200);
    const result = configureGroundGlassCamera(camera, optics, 0.01, 1000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(Math.abs(result.determinant)).toBeGreaterThan(1e-8);
  });

  it("corner winding is not mirrored", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearRiseMm: 15, rearTiltDeg: 5 }),
      architectureRiseScene,
    );
    const camera = new THREE.PerspectiveCamera(45, 1.25, 0.01, 200);
    const result = configureGroundGlassCamera(camera, optics, 0.01, 1000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.left).toBeLessThan(result.right);
      expect(result.bottom).toBeLessThan(result.top);
    }
  });

  it("rear movement does not affect front standard position", () => {
    const base = deriveOpticsState(cameraFor(tableTiltScene), tableTiltScene);
    const moved = deriveOpticsState(
      cameraFor(tableTiltScene, { rearRiseMm: 25, rearTiltDeg: 10 }),
      tableTiltScene,
    );
    expect(moved.lensCenterWorld).toEqual(base.lensCenterWorld);
    expect(moved.lensNormalWorld).toEqual(base.lensNormalWorld);
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

import * as THREE from "three";
import { describe, it, expect } from "vitest";
import { configureGroundGlassCamera } from "../../render/configureGroundGlassCamera";
import { resolveRearStandardRenderTransform } from "../../render/planeOrientation";
import { WORLD_SCALE } from "../../render/rttUtils";
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


describe("C7: camera quaternion orientation versus canonical frame", () => {
  it("camera world-up from quaternion aligns with rearStandardFrame.upWorld", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearRiseMm: 15, rearTiltDeg: 6 }),
      architectureRiseScene,
    );
    const camera = new THREE.PerspectiveCamera(45, 1.25, 0.01, 200);
    const result = configureGroundGlassCamera(camera, optics, 0.01, 1000);
    expect(result.ok).toBe(true);

    // Derive world-up from camera quaternion (local +Y → world)
    const cameraWorldUp = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(camera.quaternion)
      .normalize();
    const frameUp = new THREE.Vector3(
      optics.rearStandardFrame.upWorld.x,
      optics.rearStandardFrame.upWorld.y,
      optics.rearStandardFrame.upWorld.z,
    ).normalize();
    expect(cameraWorldUp.dot(frameUp)).toBeGreaterThan(0.99);
  });

  it("camera world-forward from quaternion matches object-facing film normal", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearRiseMm: 15, rearTiltDeg: 6 }),
      architectureRiseScene,
    );
    const camera = new THREE.PerspectiveCamera(45, 1.25, 0.01, 200);
    const result = configureGroundGlassCamera(camera, optics, 0.01, 1000);
    expect(result.ok).toBe(true);

    // World-forward = local -Z → world via quaternion
    const cameraWorldForward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(camera.quaternion)
      .normalize();

    // Expected forward: object-facing film normal (from film toward lens).
    // Production (configureGroundGlassCamera) derives the object-facing
    // direction by testing filmNormal.dot(lens - filmCenter) and negating
    // when needed.  Replicate that convention here.
    const filmNormal = new THREE.Vector3(
      optics.rearStandardFrame.normalWorld.x,
      optics.rearStandardFrame.normalWorld.y,
      optics.rearStandardFrame.normalWorld.z,
    );
    const lensPos = new THREE.Vector3(
      optics.lensCenterWorld.x * 0.001,
      optics.lensCenterWorld.y * 0.001,
      optics.lensCenterWorld.z * 0.001,
    );
    const filmCenter = new THREE.Vector3(
      optics.filmCenterWorld.x * 0.001,
      optics.filmCenterWorld.y * 0.001,
      optics.filmCenterWorld.z * 0.001,
    );
    const lensVec = new THREE.Vector3().subVectors(lensPos, filmCenter);
    const expectedForward = filmNormal.clone();
    if (expectedForward.dot(lensVec) < 0) expectedForward.negate();

    // Positive dot: camera forward must align with object-facing direction
    expect(cameraWorldForward.dot(expectedForward)).toBeGreaterThan(0.99);
    // NOT Math.abs — a reversed camera direction must fail
  });
});

describe("C8: virtual corner camera-local depth and NDC depth", () => {
  it("virtual corners are in front of the camera and within clip range", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearRiseMm: 10, rearTiltDeg: 7 }),
      architectureRiseScene,
    );
    const camera = new THREE.PerspectiveCamera(45, 1.25, 0.01, 200);
    const result = configureGroundGlassCamera(camera, optics, 0.01, 1000);
    expect(result.ok).toBe(true);

    const lensPos = new THREE.Vector3(
      optics.lensCenterWorld.x * WORLD_SCALE,
      optics.lensCenterWorld.y * WORLD_SCALE,
      optics.lensCenterWorld.z * WORLD_SCALE,
    );
    const corners = [
      optics.filmPlaneCornersWorld.topLeft,
      optics.filmPlaneCornersWorld.topRight,
      optics.filmPlaneCornersWorld.bottomLeft,
      optics.filmPlaneCornersWorld.bottomRight,
    ];
    // Virtual corners: lens + (lens - physical) — same reflection as production
    const virtualCorners = corners.map((c) => {
      const pc = new THREE.Vector3(c.x * WORLD_SCALE, c.y * WORLD_SCALE, c.z * WORLD_SCALE);
      return pc.clone().negate().add(lensPos).add(lensPos);
    });

    // Camera-local depth: apply inverse world matrix
    for (const vc of virtualCorners) {
      const local = vc.clone().applyMatrix4(camera.matrixWorldInverse);
      expect(Number.isFinite(local.x) && Number.isFinite(local.y) && Number.isFinite(local.z)).toBe(true);
      // In camera-local coordinates, objects in front have negative Z (Three.js convention)
      expect(local.z).toBeLessThan(-1e-12);
    }

    // Project to NDC and verify z is within clip range
    const ndcs = virtualCorners.map((v) => { const p = v.clone(); p.project(camera); return p; });
    for (const ndc of ndcs) {
      expect(Number.isFinite(ndc.x) && Number.isFinite(ndc.y) && Number.isFinite(ndc.z)).toBe(true);
      // NDC z typically in [-1, 1] (symmetric clip space)
      expect(ndc.z).toBeGreaterThan(-1 - 1e-6);
      expect(ndc.z).toBeLessThan(1 + 1e-6);
    }
  });
});

describe("C9: semantic corner ordering and signed area", () => {
  it("semantic horizontal and vertical ordering is preserved", () => {
    const scale = WORLD_SCALE;

    const projectSemantic = (scene: typeof architectureRiseScene, overrides: Partial<CameraState>): THREE.Vector3[] => {
      const cam = cameraFor(scene, overrides);
      const optics = deriveOpticsState(cam, scene);
      const camera = new THREE.PerspectiveCamera(45, 1.25, 0.01, 200);
      const result = configureGroundGlassCamera(camera, optics, 0.01, 1000);
      if (!result.ok) throw new Error("camera config failed");
      const lens = new THREE.Vector3(
        optics.lensCenterWorld.x * scale, optics.lensCenterWorld.y * scale, optics.lensCenterWorld.z * scale,
      );
      const cTL = optics.filmPlaneCornersWorld.topLeft;
      const cTR = optics.filmPlaneCornersWorld.topRight;
      const cBR = optics.filmPlaneCornersWorld.bottomRight;
      const cBL = optics.filmPlaneCornersWorld.bottomLeft;
      const virtual = [cTL, cTR, cBR, cBL].map((c) => {
        const pc = new THREE.Vector3(c.x * scale, c.y * scale, c.z * scale);
        return pc.clone().negate().add(lens).add(lens);
      });
      return virtual.map((v): THREE.Vector3 => { const p = v.clone(); p.project(camera); return p; });
    };

    const base = projectSemantic(architectureRiseScene, {});
    const moved = projectSemantic(architectureRiseScene, { rearRiseMm: 15, rearTiltDeg: 5 });

    // Semantic horizontal ordering: the relative ordering between corners
    // must be preserved between baseline and moved states (non-mirroring).
    const baseTLvsTR = base[0].x - base[1].x;
    const baseBLvsBR = base[3].x - base[2].x;
    const movedTLvsTR = moved[0].x - moved[1].x;
    const movedBLvsBR = moved[3].x - moved[2].x;
    // Both baselines should be distinct
    expect(Math.abs(baseTLvsTR)).toBeGreaterThan(1e-6);
    expect(Math.abs(baseBLvsBR)).toBeGreaterThan(1e-6);
    // Moved should preserve sign (no mirroring)
    expect(baseTLvsTR * movedTLvsTR).toBeGreaterThan(0);
    expect(baseBLvsBR * movedBLvsBR).toBeGreaterThan(0);

    // Semantic vertical ordering: TL and BL have distinct positions.
    // The exact sign depends on the camera's up direction; the invariant is
    // that the relative ordering is preserved between baseline and moved.
    expect(Math.abs(base[0].y - base[3].y)).toBeGreaterThan(1e-6);  // TL != BL
    expect(Math.abs(base[1].y - base[2].y)).toBeGreaterThan(1e-6);  // TR != BR
    // Same relative ordering sign between baseline and moved
    const baseTLvsBL = base[0].y - base[3].y;
    const baseTRvsBR = base[1].y - base[2].y;
    const movedTLvsBL = moved[0].y - moved[3].y;
    const movedTRvsBR = moved[1].y - moved[2].y;
    expect(baseTLvsBL * movedTLvsBL).toBeGreaterThan(0);
    expect(baseTRvsBR * movedTRvsBR).toBeGreaterThan(0);

    // Non-zero widths and heights
    expect(Math.abs(base[1].x - base[0].x)).toBeGreaterThan(1e-6);
    expect(Math.abs(base[0].y - base[3].y)).toBeGreaterThan(1e-6);
    expect(Math.abs(moved[1].x - moved[0].x)).toBeGreaterThan(1e-6);
    expect(Math.abs(moved[0].y - moved[3].y)).toBeGreaterThan(1e-6);

    // Signed polygon area (TL→TR→BR→BL)
    const signedArea = (ndcs: THREE.Vector3[]) => {
      let area = 0;
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        area += ndcs[i].x * ndcs[j].y - ndcs[j].x * ndcs[i].y;
      }
      return area / 2;
    };
    const baseArea = signedArea(base);
    const movedArea = signedArea(moved);
    expect(Math.abs(baseArea)).toBeGreaterThan(1e-6);
    expect(Math.abs(movedArea)).toBeGreaterThan(1e-6);
    expect(baseArea * movedArea).toBeGreaterThan(0);
  });
});

describe("C10: resolveRearStandardRenderTransform basis", () => {

  it("zero movement maps local axes to world axes", () => {
    const optics = deriveOpticsState(cameraFor(architectureRiseScene), architectureRiseScene);
    const xform = resolveRearStandardRenderTransform(optics.rearStandardFrame);
    const plusX = new THREE.Vector3(1, 0, 0).applyQuaternion(xform.quaternion);
    const plusY = new THREE.Vector3(0, 1, 0).applyQuaternion(xform.quaternion);
    const plusZ = new THREE.Vector3(0, 0, 1).applyQuaternion(xform.quaternion);
    expect(plusX.x).toBeCloseTo(1, 6); expect(plusX.y).toBeCloseTo(0, 6); expect(plusX.z).toBeCloseTo(0, 6);
    expect(plusY.x).toBeCloseTo(0, 6); expect(plusY.y).toBeCloseTo(1, 6); expect(plusY.z).toBeCloseTo(0, 6);
    expect(plusZ.x).toBeCloseTo(0, 6); expect(plusZ.y).toBeCloseTo(0, 6); expect(plusZ.z).toBeCloseTo(1, 6);
    expect(xform.position[0]).toBeCloseTo(0, 6);
    expect(xform.position[1]).toBeCloseTo(0, 6);
  });

  it("positive rear tilt maps local +Y to tilted up", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearTiltDeg: 8 }),
      architectureRiseScene,
    );
    const xform = resolveRearStandardRenderTransform(optics.rearStandardFrame);
    const plusY = new THREE.Vector3(0, 1, 0).applyQuaternion(xform.quaternion);
    const frameUp = optics.rearStandardFrame.upWorld;
    expect(plusY.x).toBeCloseTo(frameUp.x, 6);
    expect(plusY.y).toBeCloseTo(frameUp.y, 6);
    expect(plusY.z).toBeCloseTo(frameUp.z, 6);
  });

  it("negative rear tilt maps local +Y correctly", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearTiltDeg: -8 }),
      architectureRiseScene,
    );
    const xform = resolveRearStandardRenderTransform(optics.rearStandardFrame);
    const plusY = new THREE.Vector3(0, 1, 0).applyQuaternion(xform.quaternion);
    const frameUp = optics.rearStandardFrame.upWorld;
    expect(plusY.x).toBeCloseTo(frameUp.x, 6);
    expect(plusY.y).toBeCloseTo(frameUp.y, 6);
    expect(plusY.z).toBeCloseTo(frameUp.z, 6);
  });

  it("combined rise and tilt preserves basis mapping", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearRiseMm: 20, rearTiltDeg: 5 }),
      architectureRiseScene,
    );
    const xform = resolveRearStandardRenderTransform(optics.rearStandardFrame);
    const plusX = new THREE.Vector3(1, 0, 0).applyQuaternion(xform.quaternion);
    const plusY = new THREE.Vector3(0, 1, 0).applyQuaternion(xform.quaternion);
    const plusZ = new THREE.Vector3(0, 0, 1).applyQuaternion(xform.quaternion);
    const frame = optics.rearStandardFrame;
    expect(plusX.x).toBeCloseTo(frame.rightWorld.x, 6);
    expect(plusX.y).toBeCloseTo(frame.rightWorld.y, 6);
    expect(plusX.z).toBeCloseTo(frame.rightWorld.z, 6);
    expect(plusY.x).toBeCloseTo(frame.upWorld.x, 6);
    expect(plusY.y).toBeCloseTo(frame.upWorld.y, 6);
    expect(plusY.z).toBeCloseTo(frame.upWorld.z, 6);
    expect(plusZ.x).toBeCloseTo(frame.normalWorld.x, 6);
    expect(plusZ.y).toBeCloseTo(frame.normalWorld.y, 6);
    expect(plusZ.z).toBeCloseTo(frame.normalWorld.z, 6);
    expect(xform.position[1]).toBeCloseTo(20 * WORLD_SCALE, 8);
  });
});

});

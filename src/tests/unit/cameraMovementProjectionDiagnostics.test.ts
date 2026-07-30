import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  CAMERA_MOVEMENT_CALIBRATION_BASELINE,
  resolveEffectiveCameraMovementCalibration,
} from "../../scenes/cameraMovementEffectiveCalibration";
import { generateCameraMovementLattice } from "../../scenes/cameraMovementLatticeGeometry";
import {
  calculateCameraMovementProjectionDiagnostics,
  type CameraMovementDiagnosticMetric,
  type CameraMovementProjectionDiagnostics,
} from "../../scenes/cameraMovementProjectionDiagnostics";
import { resolveCameraRigViewpointAnchor } from "../../scenes/cameraRigViewpointGeometry";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import geometry from "../../scenes/understandingCameraMovementsGeometry";
import type { CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const effective = resolveEffectiveCameraMovementCalibration(CAMERA_MOVEMENT_CALIBRATION_BASELINE);
const lattice = generateCameraMovementLattice(effective.subject);

const cameraState = (bodyPitchDeg: number, overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...understandingCameraMovementsScene.cameraPreset,
  activeSceneId: understandingCameraMovementsScene.id,
  activeTaskId: null,
  mode: "free",
  viewpointAnchor: "mid",
  cameraRigPlacement: resolveCameraRigViewpointAnchor(effective.cameraRig, "mid"),
  cameraBodyPivotWorld: geometry.cameraBody.pivotRigLocal,
  cameraBodyPitchDeg: bodyPitchDeg,
  ...overrides,
});

const diagnosticsFor = (
  bodyPitchDeg: number,
  effectiveCalibration = effective,
  subjectLattice = lattice,
  identity: {
    sessionActive: boolean;
    revision: number;
    geometryId: string;
  } = {
    sessionActive: true,
    revision: 7,
    geometryId: "camera-movement-lattice",
  },
): CameraMovementProjectionDiagnostics =>
  calculateCameraMovementProjectionDiagnostics({
    effectiveCalibration,
    lattice: subjectLattice,
    calibrationIdentity: identity,
    currentAnchor: "mid",
    targetRegion: "middle",
    opticsState: deriveOpticsState(cameraState(bodyPitchDeg), understandingCameraMovementsScene),
  });

const collectPresentNumbers = (value: unknown, result: number[] = []): number[] => {
  if (typeof value === "number") result.push(value);
  if (Array.isArray(value)) value.forEach((child) => collectPresentNumbers(child, result));
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach((child) => collectPresentNumbers(child, result));
  }
  return result;
};

const metricValue = <T>(metric: CameraMovementDiagnosticMetric<T>): T => {
  expect(metric.status).toBe("available");
  if (metric.status !== "available") throw new Error(metric.reason);
  return metric.value;
};

describe("camera-movement projection diagnostics", () => {
  it("returns calibration identity and complete finite canonical world geometry", () => {
    const diagnostics = diagnosticsFor(0);

    expect(diagnostics.status.level).not.toBe("error");
    expect(diagnostics.identity).toMatchObject({
      sessionActive: true,
      revision: { status: "available", value: 7, reason: null },
      geometryId: {
        status: "available",
        value: "camera-movement-lattice",
        reason: null,
      },
      edgeCount: {
        status: "available",
        value: lattice.edges.length,
        reason: null,
      },
      targetRegion: "middle",
      effectiveKey: effective.effectiveKey,
    });
    expect(metricValue(diagnostics.worldGeometry.latticeBoundsWorld)).toEqual(lattice.bounds);
    expect(metricValue(diagnostics.worldGeometry.targetCentreWorld)).toEqual({
      x: 0,
      y: 0,
      z: 2000,
    });
    expect(metricValue(diagnostics.worldGeometry.rigOriginWorld)).toEqual({ x: 0, y: 0, z: 0 });
    expect(metricValue(diagnostics.worldGeometry.rigArcCentreWorld)).toEqual({
      x: 0,
      y: 0,
      z: 2000,
    });
    expect(metricValue(diagnostics.worldGeometry.lensCentreWorld)).toEqual({ x: 0, y: 0, z: 0 });
    expect(metricValue(diagnostics.worldGeometry.filmCentreWorld).z).toBeLessThan(0);
    expect(metricValue(diagnostics.worldGeometry.bodyPitchPivotWorld)).toEqual(
      geometry.cameraBody.pivotRigLocal,
    );
    expect(metricValue(diagnostics.worldGeometry.lensNormalWorld)).toEqual({ x: 0, y: 0, z: 1 });
    expect(metricValue(diagnostics.worldGeometry.filmNormalWorld)).toEqual({ x: 0, y: 0, z: 1 });
    expect(metricValue(diagnostics.worldGeometry.lensFilmDistanceMm)).toBeGreaterThan(
      effective.optics.provisionalFocalLengthMm,
    );
    expect(metricValue(diagnostics.worldGeometry.lensTargetDistanceMm)).toBe(2000);
    expect(collectPresentNumbers(diagnostics).every(Number.isFinite)).toBe(true);
  });

  it("documents raw UV and reports target, horizontal/vertical coverage, and four margins", () => {
    const diagnostics = diagnosticsFor(0);

    expect(diagnostics.uvConvention).toEqual({
      origin: "film-top-left",
      positiveU: "toward-film-right",
      positiveV: "toward-film-bottom",
      unclamped: true,
    });
    expect(diagnostics.selectedTarget).toMatchObject({
      region: "middle",
      levelIndex: {
        status: "available",
        value: effective.subject.middleTargetLevel,
      },
      uv: { status: "available" },
    });
    expect(metricValue(diagnostics.coverage.horizontal)).toBeGreaterThanOrEqual(0);
    expect(metricValue(diagnostics.coverage.horizontal)).toBeLessThanOrEqual(1);
    expect(metricValue(diagnostics.coverage.vertical)).toBeGreaterThanOrEqual(0);
    expect(metricValue(diagnostics.coverage.vertical)).toBeLessThanOrEqual(1);
    expect(diagnostics.marginsUv.left.status).toBe("available");
    expect(diagnostics.marginsUv.right.status).toBe("available");
    expect(diagnostics.marginsUv.top.status).toBe("available");
    expect(diagnostics.marginsUv.bottom.status).toBe("available");
  });

  it("preserves raw off-frame UV and negative margins without clamping", () => {
    const oversized = resolveEffectiveCameraMovementCalibration(
      CAMERA_MOVEMENT_CALIBRATION_BASELINE,
      { geometry: { cubeSizeMm: 1000 } },
    );
    const oversizedLattice = generateCameraMovementLattice(oversized.subject);
    const diagnostics = diagnosticsFor(0, oversized, oversizedLattice);

    expect(diagnostics.status.code).not.toBe("all-in-frame");
    expect(
      diagnostics.projectedVertices.some(({ projection }) => {
        if (projection.status !== "available") return false;
        const { u, v } = projection.value.uv;
        return u < 0 || u > 1 || v < 0 || v > 1;
      }),
    ).toBe(true);
    expect(
      Object.values(diagnostics.marginsUv).some(
        (margin) => margin.status === "available" && margin.value < 0,
      ),
    ).toBe(true);
    expect(collectPresentNumbers(diagnostics).every(Number.isFinite)).toBe(true);
  });

  it("classifies enclosing projected bounds as partial when no vertices are in frame", () => {
    const enclosing = resolveEffectiveCameraMovementCalibration(
      CAMERA_MOVEMENT_CALIBRATION_BASELINE,
      {
        geometry: {
          columns: 3,
          rows: 1,
          levels: 3,
          cubeSizeMm: 1000,
        },
      },
    );
    const generatedLattice = generateCameraMovementLattice(enclosing.subject);
    const enclosingLattice = {
      ...generatedLattice,
      vertices: generatedLattice.vertices.filter(({ positionWorld }) =>
        (positionWorld.x === generatedLattice.bounds.min.x ||
          positionWorld.x === generatedLattice.bounds.max.x) &&
        (positionWorld.y === generatedLattice.bounds.min.y ||
          positionWorld.y === generatedLattice.bounds.max.y)),
    };
    const diagnostics = diagnosticsFor(0, enclosing, enclosingLattice);

    expect(metricValue(diagnostics.coverage.visibleVertexFraction)).toBe(0);
    expect(metricValue(diagnostics.projectedBoundsUv)).toMatchObject({
      minU: expect.any(Number),
      maxU: expect.any(Number),
      minV: expect.any(Number),
      maxV: expect.any(Number),
    });
    const bounds = metricValue(diagnostics.projectedBoundsUv);
    expect(bounds.minU).toBeLessThan(0);
    expect(bounds.maxU).toBeGreaterThan(1);
    expect(bounds.minV).toBeLessThan(0);
    expect(bounds.maxV).toBeGreaterThan(1);
    expect(diagnostics.status.code).toBe("partially-off-frame");
  });

  it("uses the nearest-camera front face and reverses convergence direction with body pitch", () => {
    const negative = diagnosticsFor(-8);
    const zero = diagnosticsFor(0);
    const positive = diagnosticsFor(8);

    expect(negative.convergence.construction).toBe("nearest-camera-front-face-outer-corners");
    expect(metricValue(negative.worldGeometry.nearestCameraFrontFaceWorld).zWorld).toBe(
      lattice.bounds.min.z,
    );
    expect(metricValue(negative.convergence.topWidthUv)).toBeGreaterThan(0);
    expect(metricValue(negative.convergence.bottomWidthUv)).toBeGreaterThan(0);
    expect(Number.isFinite(metricValue(negative.convergence.leftVerticalSlope))).toBe(true);
    expect(Number.isFinite(metricValue(negative.convergence.rightVerticalSlope))).toBe(true);
    expect(metricValue(negative.convergence.direction)).toBe("top");
    expect(metricValue(zero.convergence.direction)).toBe("parallel");
    expect(metricValue(positive.convergence.direction)).toBe("bottom");
    expect(Math.sign(metricValue(negative.convergence.normalizedSignal))).toBe(
      -Math.sign(metricValue(positive.convergence.normalizedSignal)),
    );
  });

  it("uses null plus per-field reasons rather than fabricated numeric sentinels", () => {
    const diagnostics = diagnosticsFor(0, effective, lattice, {
      sessionActive: true,
      revision: Number.NaN,
      geometryId: "",
    });

    expect(diagnostics.status).toMatchObject({
      level: "error",
      code: "invalid-identity",
    });
    expect(diagnostics.identity.revision).toEqual({
      status: "unavailable",
      value: null,
      reason: expect.any(String),
    });
    expect(diagnostics.identity.geometryId).toEqual({
      status: "unavailable",
      value: null,
      reason: expect.any(String),
    });
    expect(diagnostics.projectedBoundsUv).toEqual({
      status: "unavailable",
      value: null,
      reason: expect.any(String),
    });
    expect(diagnostics.coverage.horizontal).toEqual({
      status: "unavailable",
      value: null,
      reason: expect.any(String),
    });
    expect(diagnostics.projectedVertices).toHaveLength(lattice.vertices.length);
    expect(
      diagnostics.projectedVertices.every(
        ({ projection }) =>
          projection.status === "unavailable" &&
          projection.value === null &&
          projection.reason.length > 0,
      ),
    ).toBe(true);
    expect(diagnostics.selectedTarget.uv.value).toBeNull();
    expect(diagnostics.worldGeometry.latticeBoundsWorld.status).toBe("available");
    expect(diagnostics.worldGeometry.lensFilmDistanceMm.status).toBe("available");
    expect(collectPresentNumbers(diagnostics).every(Number.isFinite)).toBe(true);
  });
});

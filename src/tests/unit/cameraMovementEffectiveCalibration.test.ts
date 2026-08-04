import { describe, expect, it } from "vitest";
import {
  CAMERA_MOVEMENT_CALIBRATION_BASELINE,
  buildCameraMovementCalibrationSnapshot,
  resolveEffectiveCameraMovementCalibration,
  stringifyCameraMovementCalibrationSnapshot,
  validateEffectiveCameraMovementCalibration,
} from "../../scenes/cameraMovementEffectiveCalibration";

const baseline = CAMERA_MOVEMENT_CALIBRATION_BASELINE;

describe("effective camera-movement calibration", () => {
  it("keeps a runtime-immutable baseline and never mutates it during resolution", () => {
    const baselineSnapshot = JSON.stringify(baseline);
    const effective = resolveEffectiveCameraMovementCalibration(baseline, {
      geometry: { columns: 5, subjectDistanceMm: 2600 },
      presentation: { showReferenceCamera: true },
    });

    expect(Object.isFrozen(baseline)).toBe(true);
    expect(Object.isFrozen(baseline.subject)).toBe(true);
    expect(Object.isFrozen(baseline.subject.originWorld)).toBe(true);
    expect(Object.isFrozen(baseline.optics.focalLengthCandidatesMm)).toBe(true);
    expect(JSON.stringify(baseline)).toBe(baselineSnapshot);
    expect(effective).not.toBe(baseline);
    expect(Object.isFrozen(effective)).toBe(true);
    expect(Object.isFrozen(effective.subject)).toBe(true);
  });

  it("changes subject distance only on Z and derives level targets and rig geometry", () => {
    const effective = resolveEffectiveCameraMovementCalibration(baseline, {
      geometry: { levels: 8, subjectDistanceMm: 2750 },
      rig: {
        midRigOriginWorld: { x: 0, y: -50, z: -100 },
        arcAngleDeg: 22.5,
      },
    });

    expect(effective.subject.originWorld).toEqual({
      x: baseline.subject.originWorld.x,
      y: baseline.subject.originWorld.y,
      z: 2750,
    });
    expect(effective.subject).toMatchObject({
      lowerTargetLevel: 0,
      middleTargetLevel: 3,
      upperTargetLevel: 7,
    });
    expect(effective.cameraRig.arcCenterWorld).toBe(effective.subject.originWorld);
    expect(effective.cameraRig.arcRadiusMm).toBeCloseTo(Math.hypot(0, 50, 2850), 12);
    expect(effective.cameraRig.highLowArcRadiusMm).toBeCloseTo(
      1520 * (Math.hypot(0, 50, 2850) / 2000),
      12,
    );
    expect(effective.cameraRig.lowArcRadiusMm).toBeCloseTo(
      1520 * (Math.hypot(0, 50, 2850) / 2000),
      12,
    );
    expect(effective.cameraRig.highArcAngleDeg).toBe(22.5);
    expect(effective.cameraRig.lowArcAngleDeg).toBe(-22.5);
    expect(validateEffectiveCameraMovementCalibration(effective)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("preserves independently calibrated Low and High angles when no workbench angle override is used", () => {
    const asymmetricBaseline = {
      ...baseline,
      cameraRig: {
        ...baseline.cameraRig,
        lowArcAngleDeg: -31,
      },
    };
    const effective = resolveEffectiveCameraMovementCalibration(asymmetricBaseline);

    expect(effective.cameraRig.highArcAngleDeg).toBe(35);
    expect(effective.cameraRig.lowArcAngleDeg).toBe(-31);
    expect(validateEffectiveCameraMovementCalibration(effective)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("publishes deterministic scoped keys with changes isolated to owning scopes", () => {
    const first = resolveEffectiveCameraMovementCalibration(baseline);
    const same = resolveEffectiveCameraMovementCalibration(
      { ...baseline, presentation: { ...baseline.presentation } },
      {},
    );
    const geometry = resolveEffectiveCameraMovementCalibration(baseline, {
      geometry: { columns: baseline.subject.columns + 1 },
    });
    const presentation = resolveEffectiveCameraMovementCalibration(baseline, {
      presentation: { showReferenceCamera: !baseline.presentation.showReferenceCamera },
    });
    const optics = resolveEffectiveCameraMovementCalibration(baseline, {
      optics: { provisionalFocalLengthMm: 120 },
    });
    const rig = resolveEffectiveCameraMovementCalibration(baseline, {
      rig: { arcAngleDeg: 18 },
    });

    expect(same.subjectGeometryKey).toBe(first.subjectGeometryKey);
    expect(same.presentationKey).toBe(first.presentationKey);
    expect(same.opticsKey).toBe(first.opticsKey);
    expect(same.rigKey).toBe(first.rigKey);
    expect(same.effectiveKey).toBe(first.effectiveKey);

    expect(geometry.subjectGeometryKey).not.toBe(first.subjectGeometryKey);
    expect(geometry.presentationKey).toBe(first.presentationKey);
    expect(geometry.opticsKey).toBe(first.opticsKey);
    expect(geometry.rigKey).toBe(first.rigKey);

    expect(presentation.presentationKey).not.toBe(first.presentationKey);
    expect(presentation.subjectGeometryKey).toBe(first.subjectGeometryKey);
    expect(presentation.opticsKey).toBe(first.opticsKey);
    expect(presentation.rigKey).toBe(first.rigKey);

    expect(optics.opticsKey).not.toBe(first.opticsKey);
    expect(optics.subjectGeometryKey).toBe(first.subjectGeometryKey);
    expect(optics.presentationKey).toBe(first.presentationKey);
    expect(optics.rigKey).toBe(first.rigKey);

    expect(rig.rigKey).not.toBe(first.rigKey);
    expect(rig.subjectGeometryKey).toBe(first.subjectGeometryKey);
    expect(rig.presentationKey).toBe(first.presentationKey);
    expect(rig.opticsKey).toBe(first.opticsKey);
    expect(
      [geometry, presentation, optics, rig].every(
        ({ effectiveKey }) => effectiveKey !== first.effectiveKey,
      ),
    ).toBe(true);
  });

  it("builds a fixed-order deterministic export without cache keys", () => {
    const effective = resolveEffectiveCameraMovementCalibration(baseline, {
      presentation: { internalEdgeOpacity: 0.5 },
      geometry: { rows: 4 },
    });
    const first = stringifyCameraMovementCalibrationSnapshot(effective);
    const second = stringifyCameraMovementCalibrationSnapshot(effective);
    const parsed = JSON.parse(first) as Record<string, unknown>;

    expect(second).toBe(first);
    expect(Object.keys(parsed)).toEqual([
      "schemaVersion",
      "calibrationStatus",
      "geometryAndOpticsUnits",
      "geometry",
      "optics",
      "rig",
      "presentation",
    ]);
    expect(first).not.toContain("effectiveKey");
    const snapshot = buildCameraMovementCalibrationSnapshot(effective);
    expect(snapshot.schemaVersion).toBe(1);
    expect(stringifyCameraMovementCalibrationSnapshot(snapshot)).toBe(first);
  });

  it("reports structured finite thin-lens and geometric validation errors", () => {
    const invalidThinLens = resolveEffectiveCameraMovementCalibration(baseline, {
      optics: {
        provisionalFocalLengthMm: 105,
        provisionalFocusDistanceMm: 105,
      },
    });
    const invalidLevels = resolveEffectiveCameraMovementCalibration(baseline, {
      geometry: { levels: 2 },
    });
    const invalidDistance = resolveEffectiveCameraMovementCalibration(baseline, {
      geometry: { subjectDistanceMm: Number.POSITIVE_INFINITY },
    });

    expect(validateEffectiveCameraMovementCalibration(invalidThinLens)).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          scope: "optics",
          path: "optics.thinLens",
          code: "invalid-thin-lens",
        }),
      ]),
    });
    expect(validateEffectiveCameraMovementCalibration(invalidLevels)).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          scope: "geometry",
          path: "subject.levels",
          code: "insufficient-levels",
        }),
      ]),
    });
    expect(validateEffectiveCameraMovementCalibration(invalidDistance)).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        expect.objectContaining({
          scope: "geometry",
          path: "subject.originWorld",
          code: "not-finite",
        }),
        expect.objectContaining({
          scope: "rig",
          path: "cameraRig.points",
          code: "not-finite",
        }),
      ]),
    });
    expect(() => buildCameraMovementCalibrationSnapshot(invalidThinLens)).toThrow(
      /invalid camera-movement calibration/,
    );
  });
});

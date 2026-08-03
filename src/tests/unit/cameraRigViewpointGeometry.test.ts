import { describe, expect, it } from "vitest";
import { distance } from "../../core/math/vec";
import {
  isCanonicalCameraRigViewpointPlacement,
  resolveCameraRigViewpointAnchor,
  resolveCameraRigViewpointAnchors,
  type CameraRigViewpointArcCalibration,
} from "../../scenes/cameraRigViewpointGeometry";
import { CAMERA_MOVEMENT_SCENE_CALIBRATION } from "../../scenes/cameraMovementSceneCalibration";
import { DEFAULT_CAMERA_RIG_PLACEMENT } from "../../utils/constants";

const calibration = CAMERA_MOVEMENT_SCENE_CALIBRATION.cameraRig;

describe("camera rig YZ-arc viewpoint anchors", () => {
  it("publishes the complete explicit provisional arc contract", () => {
    expect(calibration).toMatchObject({
      arcPlane: "yz",
      arcCenterWorld: { x: 0, y: 0, z: 2000 },
      midRigOriginWorld: { x: 0, y: 0, z: 0 },
      arcRadiusMm: 2000,
      highLowArcRadiusMm: 1520,
      lowArcRadiusMm: 1520,
      highArcAngleDeg: 35,
      lowArcAngleDeg: -35,
      provisionalBasePitchDeg: 0,
      defaultAnchor: "mid",
      anchorMetadata: {
        mid: { identity: "mid", relativeHeight: "at-mid" },
        high: { identity: "high", relativeHeight: "above-mid" },
        low: { identity: "low", relativeHeight: "below-mid" },
      },
    });
    expect(calibration.arcCenterWorld).toBe(
      CAMERA_MOVEMENT_SCENE_CALIBRATION.subject.originWorld,
    );
  });

  it("resolves the calibrated midpoint to the unchanged PR27/PR29 lens datum", () => {
    const mid = resolveCameraRigViewpointAnchor(calibration, "mid");

    expect(mid.anchor).toBe("mid");
    expect(mid.metadata).toEqual({ identity: "mid", relativeHeight: "at-mid" });
    expect(mid.arcPlane).toBe("yz");
    expect(mid.arcCenterWorld).toEqual({ x: 0, y: 0, z: 2000 });
    expect(mid.rigOriginWorld).toEqual({ x: 0, y: 0, z: 0 });
    expect(mid.arcAngleDeg).toBe(0);
    expect(mid.basePitchDeg).toBe(0);
    expect(mid.radiusMm).toBe(2000);
  });

  it("places high and low symmetrically at 1520 mm on the calibrated YZ arc", () => {
    const { mid, high, low } = resolveCameraRigViewpointAnchors(calibration);
    const centre = calibration.arcCenterWorld;

    expect(high.arcAngleDeg).toBe(35);
    expect(low.arcAngleDeg).toBe(-35);
    expect(high.metadata.identity).toBe("high");
    expect(low.metadata.identity).toBe("low");
    expect(high.rigOriginWorld.x).toBe(mid.rigOriginWorld.x);
    expect(low.rigOriginWorld.x).toBe(mid.rigOriginWorld.x);
    expect(high.rigOriginWorld.y).toBeGreaterThan(mid.rigOriginWorld.y);
    expect(low.rigOriginWorld.y).toBeLessThan(mid.rigOriginWorld.y);
    expect(high.rigOriginWorld.y).toBeCloseTo(-low.rigOriginWorld.y, 12);
    expect(high.rigOriginWorld.z).toBeCloseTo(low.rigOriginWorld.z, 12);
    expect(distance(high.rigOriginWorld, centre)).toBeCloseTo(1520, 12);
    expect(distance(low.rigOriginWorld, centre)).toBeCloseTo(1520, 12);
  });

  it.each(["mid", "high", "low"] as const)(
    "accepts the freshly resolved canonical %s placement",
    (anchor) => {
      expect(
        isCanonicalCameraRigViewpointPlacement(
          resolveCameraRigViewpointAnchor(calibration, anchor),
          calibration,
          anchor,
        ),
      ).toBe(true);
    },
  );

  it("does not validate an identity transform as a calibrated arc anchor", () => {
    expect(DEFAULT_CAMERA_RIG_PLACEMENT).toEqual({
      kind: "identity",
      rigOriginWorld: { x: 0, y: 0, z: 0 },
      basePitchDeg: 0,
    });
    expect(
      isCanonicalCameraRigViewpointPlacement(
        DEFAULT_CAMERA_RIG_PLACEMENT,
        calibration,
        "mid",
      ),
    ).toBe(false);
  });

  it.each([
    [
      "non-finite centre",
      { ...calibration, arcCenterWorld: { x: 0, y: Number.NaN, z: 2000 } },
    ],
    [
      "mismatched X",
      { ...calibration, midRigOriginWorld: { x: 1, y: 0, z: 0 } },
    ],
    [
      "zero radius",
      { ...calibration, arcRadiusMm: 0 },
    ],
    [
      "radius mismatch",
      { ...calibration, arcRadiusMm: calibration.arcRadiusMm + 1 },
    ],
    [
      "zero high/low radius",
      { ...calibration, highLowArcRadiusMm: 0 },
    ],
    [
      "zero low radius",
      { ...calibration, lowArcRadiusMm: 0 },
    ],
    [
      "coincident centre and midpoint",
      { ...calibration, midRigOriginWorld: { ...calibration.arcCenterWorld } },
    ],
    [
      "wrong arc plane",
      { ...calibration, arcPlane: "xz" } as unknown as CameraRigViewpointArcCalibration,
    ],
    ["zero high angle", { ...calibration, highArcAngleDeg: 0 }],
    ["positive low angle", { ...calibration, lowArcAngleDeg: 15 }],
    ["asymmetric angles", { ...calibration, lowArcAngleDeg: -14 }],
    [
      "non-finite base pitch",
      { ...calibration, provisionalBasePitchDeg: Number.POSITIVE_INFINITY },
    ],
    [
      "mismatched high metadata",
      {
        ...calibration,
        anchorMetadata: {
          ...calibration.anchorMetadata,
          high: { identity: "low", relativeHeight: "above-mid" },
        },
      } as unknown as CameraRigViewpointArcCalibration,
    ],
    [
      "unknown default anchor identity",
      {
        ...calibration,
        defaultAnchor: "middle",
      } as unknown as CameraRigViewpointArcCalibration,
    ],
  ] satisfies ReadonlyArray<readonly [string, CameraRigViewpointArcCalibration]>)(
    "rejects %s rather than returning fallback geometry",
    (_label, invalidCalibration) => {
      expect(() => resolveCameraRigViewpointAnchor(invalidCalibration, "mid")).toThrow();
    },
  );

  it("rejects an unknown runtime anchor", () => {
    expect(() =>
      resolveCameraRigViewpointAnchor(
        calibration,
        "middle" as Parameters<typeof resolveCameraRigViewpointAnchor>[1],
      ),
    ).toThrow(/Unknown camera rig viewpoint anchor/);
  });
});

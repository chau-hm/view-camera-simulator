import { describe, expect, it } from "vitest";
import { Quaternion } from "three";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  buildConceptualBellowsGeometry,
  CONCEPTUAL_BELLOWS_SECTION_COUNT,
  resolveConceptualBellowsAttachmentFrames,
  type BellowsEndpointFrame,
  type ConceptualBellowsAttachmentFrames,
} from "../../render/conceptualBellowsGeometry";
import {
  resolveFrontStandardRenderTransform,
  resolveRearStandardRenderTransform,
} from "../../render/planeOrientation";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import {
  focusFundamentalsFarFocusDepthMm,
  focusFundamentalsNearFocusDepthMm,
  focusFundamentalsReferenceFocusDepthMm,
} from "../../scenes/focusFundamentalsTargets";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import type { CameraState } from "../../types/camera";
import type { Vec3 } from "../../types/optics";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const cameraFor = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...architectureRiseScene.cameraPreset,
  activeSceneId: architectureRiseScene.id,
  ...overrides,
});

const focusCameraFor = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...focusFundamentalsTwoTargets.cameraPreset,
  activeSceneId: focusFundamentalsTwoTargets.id,
  ...overrides,
});

const framesFor = (
  overrides: Partial<CameraState> = {},
): { opticsState: ReturnType<typeof deriveOpticsState>; frames: ConceptualBellowsAttachmentFrames } => {
  const opticsState = deriveOpticsState(cameraFor(overrides), architectureRiseScene);
  return {
    opticsState,
    frames: resolveConceptualBellowsAttachmentFrames({
      frontCenter: opticsState.lensCenterWorld,
      frontNormal: opticsState.lensNormalWorld,
      rearFrame: opticsState.rearStandardFrame,
    }),
  };
};

const focusFramesFor = (
  overrides: Partial<CameraState>,
): ConceptualBellowsAttachmentFrames => {
  const opticsState = deriveOpticsState(
    focusCameraFor(overrides),
    focusFundamentalsTwoTargets,
  );
  return resolveConceptualBellowsAttachmentFrames({
    frontCenter: opticsState.lensCenterWorld,
    frontNormal: opticsState.lensNormalWorld,
    rearFrame: opticsState.rearStandardFrame,
  });
};

const expectVecClose = (actual: Vec3, expected: Vec3): void => {
  expect(actual.x).toBeCloseTo(expected.x, 10);
  expect(actual.y).toBeCloseTo(expected.y, 10);
  expect(actual.z).toBeCloseTo(expected.z, 10);
};

const expectQuaternionClose = (actual: Quaternion, expected: Quaternion): void => {
  const actualValues = actual.toArray();
  const expectedValues = expected.toArray();
  for (let index = 0; index < actualValues.length; index += 1) {
    expect(actualValues[index]).toBeCloseTo(expectedValues[index], 10);
  }
};

const distanceBetween = (a: Vec3, b: Vec3): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const expectOrthonormal = (frame: BellowsEndpointFrame): void => {
  for (const value of [
    ...Object.values(frame.center),
    ...Object.values(frame.right),
    ...Object.values(frame.up),
    ...Object.values(frame.normal),
    ...frame.quaternion.toArray(),
  ]) {
    expect(Number.isFinite(value)).toBe(true);
  }
  for (const axis of [frame.right, frame.up, frame.normal]) {
    expect(Math.hypot(axis.x, axis.y, axis.z)).toBeCloseTo(1, 10);
  }
  const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
  expect(dot(frame.right, frame.up)).toBeCloseTo(0, 10);
  expect(dot(frame.right, frame.normal)).toBeCloseTo(0, 10);
  expect(dot(frame.up, frame.normal)).toBeCloseTo(0, 10);
};

const expectValidGeometry = (geometry: ReturnType<typeof buildConceptualBellowsGeometry>): void => {
  expect(geometry.sections).toHaveLength(CONCEPTUAL_BELLOWS_SECTION_COUNT);
  expect(geometry.positions).toHaveLength(CONCEPTUAL_BELLOWS_SECTION_COUNT * 4 * 3);
  expect(geometry.normals).toHaveLength(geometry.positions.length);
  expect(geometry.triangleIndices).toHaveLength(
    (CONCEPTUAL_BELLOWS_SECTION_COUNT - 1) * 4 * 6,
  );
  expect(geometry.triangleIndices.every((index) => Number.isInteger(index) && index >= 0)).toBe(true);
  expect([
    ...geometry.positions,
    ...geometry.normals,
  ].every((value) => Number.isFinite(value))).toBe(true);
  for (const section of geometry.sections) expectOrthonormal(section);
};

describe("conceptual deformable bellows geometry", () => {
  it("is deterministic at neutral focus and keeps both mouths on canonical frames", () => {
    const { opticsState, frames } = framesFor();
    const first = buildConceptualBellowsGeometry(frames);
    const second = buildConceptualBellowsGeometry(frames);
    const expectedFront = resolveFrontStandardRenderTransform(
      opticsState.lensCenterWorld,
      opticsState.lensNormalWorld,
    );
    const expectedRear = resolveRearStandardRenderTransform(
      opticsState.rearStandardFrame,
    );

    expectValidGeometry(first);
    expect(first.positions).toEqual(second.positions);
    expect(first.normals).toEqual(second.normals);
    expect(first.triangleIndices).toEqual(second.triangleIndices);
    expectVecClose(first.sections[0].center, frames.rear.center);
    expectVecClose(first.sections.at(-1)!.center, frames.front.center);
    expectQuaternionClose(first.sections[0].quaternion, expectedRear.quaternion);
    expectQuaternionClose(first.sections.at(-1)!.quaternion, expectedFront.quaternion);
    expect(first.sections[0].widthMm).toBe(frames.rear.widthMm);
    expect(first.sections.at(-1)!.widthMm).toBe(frames.front.widthMm);
    expect(frames.rear.center.z).toBeGreaterThan(opticsState.rearStandardFrame.centerWorld.z);
    expect(frames.front.center.z).toBeLessThan(opticsState.lensCenterWorld.z);
  });

  it("changes bellows extension with front and rear focusing", () => {
    const frontReference = focusFramesFor({
      focusDistanceMm: focusFundamentalsReferenceFocusDepthMm,
      focusStandard: "front",
    });
    const frontNear = focusFramesFor({
      focusDistanceMm: focusFundamentalsNearFocusDepthMm,
      focusStandard: "front",
    });
    expectVecClose(frontNear.rear.center, frontReference.rear.center);
    expect(frontNear.front.center).not.toEqual(frontReference.front.center);
    expect(distanceBetween(frontNear.rear.center, frontNear.front.center)).not.toBeCloseTo(
      distanceBetween(frontReference.rear.center, frontReference.front.center),
      8,
    );

    const rearReference = focusFramesFor({
      focusDistanceMm: focusFundamentalsReferenceFocusDepthMm,
      focusStandard: "rear",
    });
    const rearFar = focusFramesFor({
      focusDistanceMm: focusFundamentalsFarFocusDepthMm,
      focusStandard: "rear",
    });
    expectVecClose(rearFar.front.center, rearReference.front.center);
    expect(rearFar.rear.center).not.toEqual(rearReference.rear.center);
    expect(distanceBetween(rearFar.rear.center, rearFar.front.center)).not.toBeCloseTo(
      distanceBetween(rearReference.rear.center, rearReference.front.center),
      8,
    );
  });

  it.each([
    ["front rise", { frontRiseMm: 20 }, "front", "y"],
    ["rear rise", { rearRiseMm: 20 }, "rear", "y"],
    ["front shift", { frontShiftMm: 20 }, "front", "x"],
    ["rear shift", { rearShiftMm: 20 }, "rear", "x"],
  ] as const)(
    "%s moves only the corresponding bellows mouth",
    (_label, overrides, side, axis) => {
      const neutral = framesFor().frames;
      const moved = framesFor(overrides).frames;
      const movedEndpoint = moved[side];
      const neutralEndpoint = neutral[side];
      const opposite = side === "front" ? "rear" : "front";

      expect(movedEndpoint.center).not.toEqual(neutralEndpoint.center);
      expectVecClose(moved[opposite].center, neutral[opposite].center);
      expect(movedEndpoint.center[axis]).not.toBeCloseTo(neutralEndpoint.center[axis], 10);
      for (const coordinate of (["x", "y", "z"] as const).filter((value) => value !== axis)) {
        expect(movedEndpoint.center[coordinate]).toBeCloseTo(neutralEndpoint.center[coordinate], 10);
      }
    },
  );

  it.each([
    ["front tilt", { frontTiltDeg: 6 }, "front"],
    ["front swing", { frontSwingDeg: -7 }, "front"],
    ["rear tilt", { rearTiltDeg: 6 }, "rear"],
    ["rear swing", { rearSwingDeg: -7 }, "rear"],
  ] as const)("matches the canonical %s mouth orientation", (_label, overrides, side) => {
    const { opticsState, frames } = framesFor(overrides);
    const expected = side === "front"
      ? resolveFrontStandardRenderTransform(
          opticsState.lensCenterWorld,
          opticsState.lensNormalWorld,
        )
      : resolveRearStandardRenderTransform(opticsState.rearStandardFrame);
    expectQuaternionClose(frames[side].quaternion, expected.quaternion);
    expect(frames[side].quaternion.toArray()).not.toEqual(
      framesFor().frames[side].quaternion.toArray(),
    );
  });

  it("interpolates combined tilt and swing without losing an orthonormal frame", () => {
    const { frames } = framesFor({
      frontTiltDeg: 5,
      frontSwingDeg: -6,
      rearTiltDeg: -4,
      rearSwingDeg: 5,
    });
    const geometry = buildConceptualBellowsGeometry(frames);

    expectValidGeometry(geometry);
    expectQuaternionClose(geometry.sections[0].quaternion, frames.rear.quaternion);
    expectQuaternionClose(geometry.sections.at(-1)!.quaternion, frames.front.quaternion);
    for (const section of geometry.sections) {
      expect(Math.hypot(...section.quaternion.toArray())).toBeCloseTo(1, 10);
    }
  });

  it("keeps compound front and rear movement topology finite and endpoint-attached", () => {
    const { frames } = framesFor({
      frontRiseMm: 20,
      frontShiftMm: 12,
      frontTiltDeg: 5,
      frontSwingDeg: -6,
      rearRiseMm: 8,
      rearShiftMm: -10,
      rearTiltDeg: -4,
      rearSwingDeg: 5,
    });
    const geometry = buildConceptualBellowsGeometry(frames);

    expectValidGeometry(geometry);
    expectVecClose(geometry.sections[0].center, frames.rear.center);
    expectVecClose(geometry.sections.at(-1)!.center, frames.front.center);
    expectQuaternionClose(geometry.sections[0].quaternion, frames.rear.quaternion);
    expectQuaternionClose(geometry.sections.at(-1)!.quaternion, frames.front.quaternion);
    expect(geometry.triangleIndices).toEqual(
      buildConceptualBellowsGeometry(frames).triangleIndices,
    );
  });
});

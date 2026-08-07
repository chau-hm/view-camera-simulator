import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  deriveFocusFundamentalsReferenceOptics,
  resolveFocusFundamentalsTeachingCue,
} from "../../scenes/focusFundamentalsPresentation";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { resolveFocusStandardVisualState } from "../../render/focusStandardPresentation";

const opticsFor = (
  focusStandard: "front" | "rear",
  focusDistanceMm: number,
  focusMode: "finite" | "infinity" = "finite",
  focalLengthMm = DEFAULT_CAMERA_STATE.focalLengthMm,
) =>
  deriveOpticsState(
    {
      ...DEFAULT_CAMERA_STATE,
      activeSceneId: focusFundamentalsTwoTargets.id,
      focusStandard,
      focusDistanceMm,
      focusMode,
      focalLengthMm,
    },
    focusFundamentalsTwoTargets,
  );

describe("Focus Fundamentals presentation cues", () => {
  it.each([
    ["front", "lensCenterWorld"],
    ["rear", "rearStandardFrame"],
  ] as const)(
    "uses the canonical %s movable standard position for signed movement",
    (focusStandard, positionField) => {
      const current = opticsFor(focusStandard, 1720);
      const reference = deriveFocusFundamentalsReferenceOptics(
        current,
        focusFundamentalsTwoTargets,
      );
      expect(reference).not.toBeNull();

      const cue = resolveFocusFundamentalsTeachingCue(current, reference!);
      const currentPosition =
        positionField === "lensCenterWorld"
          ? current.lensCenterWorld
          : current.rearStandardFrame.centerWorld;
      const referencePosition =
        positionField === "lensCenterWorld"
          ? reference!.lensCenterWorld
          : reference!.rearStandardFrame.centerWorld;
      const expectedMovement = Math.hypot(
        currentPosition.x - referencePosition.x,
        currentPosition.y - referencePosition.y,
        currentPosition.z - referencePosition.z,
      );

      expect(cue.currentPosition).toBe(currentPosition);
      expect(cue.referencePosition).toBe(referencePosition);
      expect(cue.distanceMm).toBeCloseTo(expectedMovement, 8);
      expect(Math.abs(cue.signedMovementMm)).toBeCloseTo(expectedMovement, 8);
    },
  );

  it("collapses the movement cue at the canonical finite reference depth", () => {
    const current = opticsFor("rear", 2000);
    const reference = deriveFocusFundamentalsReferenceOptics(
      current,
      focusFundamentalsTwoTargets,
    );
    expect(reference).not.toBeNull();

    const cue = resolveFocusFundamentalsTeachingCue(current, reference!);
    expect(cue.distanceMm).toBeCloseTo(0, 8);
    expect(cue.signedMovementMm).toBeCloseTo(0, 8);
  });

  it("compares infinity against the finite canonical reference state", () => {
    const current = opticsFor("rear", 2000, "infinity");
    const reference = deriveFocusFundamentalsReferenceOptics(
      current,
      focusFundamentalsTwoTargets,
    );
    expect(reference).not.toBeNull();
    expect(reference!.diagnostics.isInfinityFocus).toBe(false);

    const cue = resolveFocusFundamentalsTeachingCue(current, reference!);
    expect(cue.distanceMm).toBeGreaterThan(0);
    expect(Math.abs(cue.signedMovementMm)).toBeGreaterThan(0);
  });

  it("uses the current canonical focal length for the finite reference derivation", () => {
    const current = opticsFor("front", 1720, "finite", 180);
    const reference = deriveFocusFundamentalsReferenceOptics(
      current,
      focusFundamentalsTwoTargets,
      180,
    );
    const expectedReference = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        activeSceneId: focusFundamentalsTwoTargets.id,
        focusStandard: "front",
        focusDistanceMm: 2000,
        focalLengthMm: 180,
      },
      focusFundamentalsTwoTargets,
    );

    expect(reference).not.toBeNull();
    expect(reference!.lensCenterWorld).toEqual(expectedReference.lensCenterWorld);
    expect(reference!.lensCenterWorld.z).not.toBe(
      deriveFocusFundamentalsReferenceOptics(
        current,
        focusFundamentalsTwoTargets,
        150,
      )!.lensCenterWorld.z,
    );
  });

  it("uses the active accent only on the selected focusing standard", () => {
    const front = resolveFocusStandardVisualState("front", "front");
    const rear = resolveFocusStandardVisualState("rear", "front");
    expect(front.active).toBe(true);
    expect(front.bodyColor).toBe("#2563eb");
    expect(rear.active).toBe(false);
    expect(rear.bodyColor).toBe("#4b5563");

    const rearActive = resolveFocusStandardVisualState("rear", "rear");
    const frontInactive = resolveFocusStandardVisualState("front", "rear");
    expect(rearActive.active).toBe(true);
    expect(rearActive.bodyColor).toBe("#2563eb");
    expect(frontInactive.active).toBe(false);
    expect(frontInactive.bodyColor).toBe("#6b7280");
  });
});

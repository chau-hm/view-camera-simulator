import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { macroBellowsExtensionScene } from "../../scenes/definitions/macro-bellows-extension";
import { macroCompoundMovementsScene } from "../../scenes/definitions/macro-compound-movements";
import { macroDepthOfFieldScene } from "../../scenes/definitions/macro-depth-of-field";
import { macroObliquePlaneScene } from "../../scenes/definitions/macro-oblique-plane";
import {
  isMacroCompoundMovementsNeutralSwing,
  isMacroCompoundMovementsNeutralTilt,
  resolveMacroCompoundMovementsTeaching,
} from "../../scenes/macroCompoundMovementsTeaching";
import type { CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const cameraAt = (
  focusDistanceMm: number,
  frontTiltDeg = 0,
  frontSwingDeg = 0,
): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...macroCompoundMovementsScene.cameraPreset,
  activeSceneId: macroCompoundMovementsScene.id,
  mode: "free",
  activeTaskId: null,
  focusDistanceMm,
  frontTiltDeg,
  frontSwingDeg,
  focusMode: "finite",
});

const teachingAt = (
  focusDistanceMm: number,
  frontTiltDeg = 0,
  frontSwingDeg = 0,
) => {
  const camera = cameraAt(focusDistanceMm, frontTiltDeg, frontSwingDeg);
  const optics = deriveOpticsState(camera, macroCompoundMovementsScene);
  return resolveMacroCompoundMovementsTeaching({
    capability: macroCompoundMovementsScene.macroTeachingCapability,
    frontTiltDeg,
    frontSwingDeg,
    focusObjectDistanceMm: optics.diagnostics.focusObjectDistanceMm,
    focusTargets: optics.focusTargets,
  });
};

describe("Macro Scene 4 teaching model", () => {
  it("is declaratively enabled only for the compound-movements scene", () => {
    expect(macroCompoundMovementsScene.macroTeachingCapability).toEqual({
      kind: "compound-movements",
    });
    expect(
      resolveMacroCompoundMovementsTeaching({
        capability: macroBellowsExtensionScene.macroTeachingCapability,
        frontTiltDeg: 0,
        frontSwingDeg: 0,
        focusObjectDistanceMm: 500,
        focusTargets: [],
      }),
    ).toBeNull();
    expect(
      resolveMacroCompoundMovementsTeaching({
        capability: macroDepthOfFieldScene.macroTeachingCapability,
        frontTiltDeg: 0,
        frontSwingDeg: 0,
        focusObjectDistanceMm: 500,
        focusTargets: [],
      }),
    ).toBeNull();
    expect(
      resolveMacroCompoundMovementsTeaching({
        capability: macroObliquePlaneScene.macroTeachingCapability,
        frontTiltDeg: 0,
        frontSwingDeg: 0,
        focusObjectDistanceMm: 500,
        focusTargets: [],
      }),
    ).toBeNull();
  });

  it("starts with focus exploration and follows the strongest physical region", () => {
    const model = teachingAt(500);

    expect(model).toMatchObject({
      stage: "focus-exploration",
      strongestRegion: "centre",
      tiltNeutral: true,
      swingNeutral: true,
      allSharp: false,
    });
    expect(model?.statuses).toEqual({
      "near-left": "soft",
      centre: "soft",
      "far-right": "soft",
    });
    expect(isMacroCompoundMovementsNeutralTilt(0)).toBe(true);
    expect(isMacroCompoundMovementsNeutralSwing(0)).toBe(true);
    expect(isMacroCompoundMovementsNeutralTilt(0.1)).toBe(false);
    expect(isMacroCompoundMovementsNeutralSwing(-0.1)).toBe(false);
  });

  it("separates the one-axis exploration stages", () => {
    expect(teachingAt(500, 2, 0)).toMatchObject({
      stage: "tilt-only",
      tiltNeutral: false,
      swingNeutral: true,
      allSharp: false,
    });
    expect(teachingAt(500, 0, -2)).toMatchObject({
      stage: "swing-only",
      tiltNeutral: true,
      swingNeutral: false,
      allSharp: false,
    });
  });

  it("recognizes a real public two-axis refinement state from physical statuses", () => {
    const model = teachingAt(490, 3.3, -2.7);

    expect(model).toMatchObject({
      stage: "refine-compound",
      sharpCount: 2,
      statuses: {
        "near-left": "sharp",
        centre: "sharp",
        "far-right": "acceptable",
      },
      allSharp: false,
    });
  });

  it("recognizes the aligned state from all three physical statuses", () => {
    const model = teachingAt(490, 3.4, -2.8);

    expect(model).toMatchObject({
      stage: "aligned",
      sharpCount: 3,
      statuses: {
        "near-left": "sharp",
        centre: "sharp",
        "far-right": "sharp",
      },
      allSharp: true,
    });
  });

  it("keeps compound movement states physically descriptive without exposing an answer check", () => {
    const model = teachingAt(480, 2.9, -3.3);

    expect(model).toMatchObject({
      stage: "compound-alignment",
      allSharp: false,
      tiltNeutral: false,
      swingNeutral: false,
    });
    expect(model?.sharpCount).toBe(0);
  });

  it("fails closed when canonical focus or target metrics are unavailable", () => {
    expect(
      resolveMacroCompoundMovementsTeaching({
        capability: macroCompoundMovementsScene.macroTeachingCapability,
        frontTiltDeg: 0,
        frontSwingDeg: 0,
        focusObjectDistanceMm: null,
        focusTargets: [],
      }),
    ).toBeNull();

    const optics = deriveOpticsState(cameraAt(500), macroCompoundMovementsScene);
    expect(
      resolveMacroCompoundMovementsTeaching({
        capability: macroCompoundMovementsScene.macroTeachingCapability,
        frontTiltDeg: 0,
        frontSwingDeg: 0,
        focusObjectDistanceMm: optics.diagnostics.focusObjectDistanceMm,
        focusTargets: optics.focusTargets.slice(0, 2),
      }),
    ).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { macroBellowsExtensionScene } from "../../scenes/definitions/macro-bellows-extension";
import { macroDepthOfFieldScene } from "../../scenes/definitions/macro-depth-of-field";
import { macroObliquePlaneScene } from "../../scenes/definitions/macro-oblique-plane";
import {
  resolveMacroObliquePlaneTeaching,
  isMacroObliquePlaneNeutralTilt,
} from "../../scenes/macroObliquePlaneTeaching";
import type { CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const cameraAt = (focusDistanceMm: number, frontTiltDeg = 0): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...macroObliquePlaneScene.cameraPreset,
  activeSceneId: macroObliquePlaneScene.id,
  mode: "free",
  activeTaskId: null,
  focusDistanceMm,
  frontTiltDeg,
  focusMode: "finite",
});

const teachingAt = (focusDistanceMm: number, frontTiltDeg = 0) => {
  const camera = cameraAt(focusDistanceMm, frontTiltDeg);
  const optics = deriveOpticsState(camera, macroObliquePlaneScene);
  return resolveMacroObliquePlaneTeaching({
    capability: macroObliquePlaneScene.macroTeachingCapability,
    frontTiltDeg,
    focusObjectDistanceMm: optics.diagnostics.focusObjectDistanceMm,
    focusTargets: optics.focusTargets,
  });
};

describe("Macro Scene 3 teaching model", () => {
  it("is isolated to the oblique-plane teaching capability", () => {
    expect(macroObliquePlaneScene.macroTeachingCapability).toEqual({ kind: "oblique-plane" });
    expect(
      resolveMacroObliquePlaneTeaching({
        capability: macroBellowsExtensionScene.macroTeachingCapability,
        frontTiltDeg: 0,
        focusObjectDistanceMm: 400,
        focusTargets: [],
      }),
    ).toBeNull();
    expect(
      resolveMacroObliquePlaneTeaching({
        capability: macroDepthOfFieldScene.macroTeachingCapability,
        frontTiltDeg: 0,
        focusObjectDistanceMm: 400,
        focusTargets: [],
      }),
    ).toBeNull();
  });

  it("starts in parallel exploration with the middle region sharp", () => {
    const model = teachingAt(400, 0);
    expect(model).toMatchObject({
      stage: "parallel-exploration",
      sharpCount: 1,
      strongestRegion: "middle",
      statuses: { near: "soft", middle: "sharp", far: "soft" },
      allSharp: false,
    });
    expect(isMacroObliquePlaneNeutralTilt(0)).toBe(true);
    expect(isMacroObliquePlaneNeutralTilt(0.1)).toBe(false);
  });

  it("keeps zero-tilt refocusing in the parallel stage while the strongest region moves", () => {
    const nearSide = teachingAt(380, 0);
    const middle = teachingAt(400, 0);
    const farSide = teachingAt(420, 0);

    expect(nearSide).toMatchObject({
      stage: "parallel-exploration",
      strongestRegion: "near",
      weakestRegion: "far",
      allSharp: false,
    });
    expect(middle).toMatchObject({
      stage: "parallel-exploration",
      strongestRegion: "middle",
      allSharp: false,
    });
    expect(farSide).toMatchObject({
      stage: "parallel-exploration",
      strongestRegion: "far",
      weakestRegion: "near",
      allSharp: false,
    });
    expect(nearSide?.sharpCount).toBe(0);
    expect(middle?.sharpCount).toBe(1);
    expect(farSide?.sharpCount).toBe(0);
  });

  it("introduces Tilt and Focus together before the plane is aligned", () => {
    const model = teachingAt(400, 2);
    expect(model?.stage).toBe("tilt-and-focus");
    expect(model?.allSharp).toBe(false);
  });

  it("uses the physical two-sharp state for refinement", () => {
    const model = teachingAt(390, 6.2);
    expect(model).toMatchObject({
      stage: "refine-alignment",
      sharpCount: 2,
      allSharp: false,
      statuses: { near: "sharp", middle: "sharp", far: "acceptable" },
      weakestRegion: "far",
    });
  });

  it("recognizes the aligned state from target status, not control equality", () => {
    const model = teachingAt(390, 6.3);
    expect(model).toMatchObject({
      stage: "aligned",
      sharpCount: 3,
      allSharp: true,
      statuses: { near: "sharp", middle: "sharp", far: "sharp" },
    });
  });

  it("fails closed when canonical focus or target metrics are unavailable", () => {
    expect(
      resolveMacroObliquePlaneTeaching({
        capability: macroObliquePlaneScene.macroTeachingCapability,
        frontTiltDeg: 0,
        focusObjectDistanceMm: null,
        focusTargets: [],
      }),
    ).toBeNull();
  });
});

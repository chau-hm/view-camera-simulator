import { describe, expect, it } from "vitest";
// The development-only experiment is intentionally outside the production TypeScript graph.
// @ts-expect-error JavaScript fixture has no production declaration.
import { ROOM_PRESETS } from "../../../experiments/room-at-dawn/presets.js";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { resolveGroundGlassRelativeIlluminance } from "../../core/optics/groundGlassIlluminance";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../render/groundGlassFilmPlaneProjection";
import { computePhysicalCoCDiameterMm, imageDistanceMm } from "../../core/optics/thinLensModel";

describe("room experimental camera calibration", () => {
  it("maps an authored desk object to the 90 mm camera film in the desk pose", () => {
    const preset = ROOM_PRESETS.desk;
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      focalLengthMm: preset.focalLengthMm,
      focusDistanceMm: preset.focusDistanceMm,
    };
    const optics = deriveOpticsState(camera, architectureRiseScene);
    const source = [3.13, 0.7506, 0.385];
    const point = source.map((m, i) => (m - preset.origin[i]) * 1000);
    const projection = projectWorldPointToFilmPlaneGroundGlass({
      worldPoint: { x: point[0], y: point[1], z: point[2] },
      lensCenterWorld: optics.lensCenterWorld,
      filmPlaneCornersWorld: optics.filmPlaneCornersWorld,
    });
    expect(projection.visible).toBe(true);
    expect(point[2]).toBeCloseTo(305, 7);
  });
  it("predicts less physical blur for a 305 mm object focused at 305 mm than at 500 mm", () => {
    const input = { focalLengthMm: 90, apertureFNumber: 5.6, objectDistanceMm: 305 };
    const focused = computePhysicalCoCDiameterMm({
      ...input,
      filmDistanceMm: imageDistanceMm(90, 305),
    });
    const farther = computePhysicalCoCDiameterMm({
      ...input,
      filmDistanceMm: imageDistanceMm(90, 500),
    });
    expect(focused).toBeCloseTo(0, 9);
    expect(farther).toBeGreaterThan(1);
  });
  it("retains the geometric f/5.6 to f/22 light ratio at fixed bellows", () => {
    const wide = resolveGroundGlassRelativeIlluminance({
      apertureFNumber: 5.6,
      focalLengthMm: 90,
      imageDistanceMm: 100,
    });
    const stopped = resolveGroundGlassRelativeIlluminance({
      apertureFNumber: 22,
      focalLengthMm: 90,
      imageDistanceMm: 100,
    });
    expect(stopped / wide).toBeCloseTo((5.6 / 22) ** 2, 12);
  });
});

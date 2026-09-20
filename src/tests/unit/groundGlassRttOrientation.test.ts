import { describe, expect, it } from "vitest";
import { mapGroundGlassUvToDisplayUv } from "../../render/groundGlassTargetProjection";
import {
  applyGroundGlassRttDisplayTransform,
  resolveGroundGlassRttDisplayTransform,
} from "../../render/groundGlassRttOrientation";

type Uv = { u: number; v: number };

const flip180 = ({ u, v }: Uv): Uv => ({ u: 1 - u, v: 1 - v });

const ASYMMETRIC_REFERENCE_POINTS = [
  { label: "A", upright: { u: 0.2, v: 0.2 } },
  { label: "B", upright: { u: 0.8, v: 0.2 } },
  { label: "C", upright: { u: 0.2, v: 0.8 } },
  { label: "D", upright: { u: 0.8, v: 0.8 } },
] as const;

describe("Ground Glass RTT orientation", () => {
  it("renders an asymmetric upright reference as a 180-degree Raw image", () => {
    for (const point of ASYMMETRIC_REFERENCE_POINTS) {
      const rawDisplay = applyGroundGlassRttDisplayTransform(
        point.upright,
        resolveGroundGlassRttDisplayTransform("raw"),
      );
      const uprightDisplay = applyGroundGlassRttDisplayTransform(
        point.upright,
        resolveGroundGlassRttDisplayTransform("upright"),
      );

      expect(rawDisplay, point.label).toEqual(flip180(point.upright));
      expect(uprightDisplay, point.label).toEqual(point.upright);
    }
  });

  it("keeps raster orientation, canonical target projection, and mode complement aligned", () => {
    for (const point of ASYMMETRIC_REFERENCE_POINTS) {
      // A physical raw film point is the 180-degree projection of the upright
      // scene reference. Target projection then places that raw point in the
      // selected visible mode.
      const physicalRawFilmUv = flip180(point.upright);
      const rasterRawDisplay = applyGroundGlassRttDisplayTransform(
        point.upright,
        resolveGroundGlassRttDisplayTransform("raw"),
      );
      const rasterUprightDisplay = applyGroundGlassRttDisplayTransform(
        point.upright,
        resolveGroundGlassRttDisplayTransform("upright"),
      );
      const projectedRawDisplay = mapGroundGlassUvToDisplayUv(
        physicalRawFilmUv,
        "raw",
      );
      const projectedUprightDisplay = mapGroundGlassUvToDisplayUv(
        physicalRawFilmUv,
        "upright",
      );

      expect(rasterRawDisplay.u, point.label).toBeCloseTo(projectedRawDisplay.u, 12);
      expect(rasterRawDisplay.v, point.label).toBeCloseTo(projectedRawDisplay.v, 12);
      expect(rasterUprightDisplay.u, point.label).toBeCloseTo(projectedUprightDisplay.u, 12);
      expect(rasterUprightDisplay.v, point.label).toBeCloseTo(projectedUprightDisplay.v, 12);
      expect(rasterUprightDisplay.u).toBeCloseTo(1 - rasterRawDisplay.u, 12);
      expect(rasterUprightDisplay.v).toBeCloseTo(1 - rasterRawDisplay.v, 12);
    }
  });
});

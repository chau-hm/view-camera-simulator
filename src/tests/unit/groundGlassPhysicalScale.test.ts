import { describe, expect, it } from "vitest";
import {
  decodeGroundGlassFootprintAxesMm,
  encodeGroundGlassFootprintAxesMm,
  resolveGroundGlassCocStorageMaxMm,
} from "../../render/groundGlassCocTarget";
import { groundGlassFootprintAxesToRttPixels } from "../../render/groundGlassFootprintCoordinates";
import { getGroundGlassDofVisualSettings } from "../../render/groundGlassVisualSettings";

describe("physical Ground Glass blur scale", () => {
  it("does not expose scene-specific physical amplification", () => {
    for (const sceneId of [
      "architecture-rise",
      "table-tilt",
      "shelf-swing",
      "oblique-architecture",
      "architecture-foreground",
    ]) {
      expect(getGroundGlassDofVisualSettings(sceneId)).not.toHaveProperty("displayBlurScale");
    }
  });

  it("maps film millimetres directly to pixels", () => {
    const axes = groundGlassFootprintAxesToRttPixels({
      majorRadiusMm: 2,
      minorRadiusMm: 1,
      orientationRad: 0,
      renderWidthPx: 1270,
      renderHeightPx: 1016,
      filmWidthMm: 127,
      filmHeightMm: 101.6,
    });

    expect(axes.majorAxisPx[0]).toBeCloseTo(20, 12);
    expect(axes.majorAxisPx[1]).toBeCloseTo(0, 12);
    expect(axes.minorAxisPx[0]).toBeCloseTo(0, 12);
    expect(axes.minorAxisPx[1]).toBeCloseTo(-10, 12);
  });

  it("scales pixel footprints with render resolution, not physical radii", () => {
    const base = groundGlassFootprintAxesToRttPixels({
      majorRadiusMm: 2,
      minorRadiusMm: 1,
      orientationRad: Math.PI / 4,
      renderWidthPx: 1270,
      renderHeightPx: 1016,
      filmWidthMm: 127,
      filmHeightMm: 101.6,
    });
    const doubled = groundGlassFootprintAxesToRttPixels({
      majorRadiusMm: 2,
      minorRadiusMm: 1,
      orientationRad: Math.PI / 4,
      renderWidthPx: 2540,
      renderHeightPx: 2032,
      filmWidthMm: 127,
      filmHeightMm: 101.6,
    });

    expect(doubled.majorAxisPx[0]).toBeCloseTo(base.majorAxisPx[0] * 2, 12);
    expect(doubled.majorAxisPx[1]).toBeCloseTo(base.majorAxisPx[1] * 2, 12);
    expect(doubled.minorAxisPx[0]).toBeCloseTo(base.minorAxisPx[0] * 2, 12);
    expect(doubled.minorAxisPx[1]).toBeCloseTo(base.minorAxisPx[1] * 2, 12);
  });

  it("is scene-independent for identical physical film geometry", () => {
    const input = {
      majorRadiusMm: 3,
      minorRadiusMm: 1.5,
      orientationRad: Math.PI / 6,
      renderWidthPx: 1600,
      renderHeightPx: 1280,
      filmWidthMm: 127,
      filmHeightMm: 101.6,
    };

    expect(groundGlassFootprintAxesToRttPixels(input)).toEqual(
      groundGlassFootprintAxesToRttPixels({ ...input }),
    );
  });

  it("derives storage range from the physical pixel cap without amplification", () => {
    expect(resolveGroundGlassCocStorageMaxMm({
      maximumCoCRadiusPx: 42,
      filmWidthMm: 127,
      renderWidthPx: 1270,
    })).toBeCloseTo(8.4, 12);
  });

  it("keeps half-float and byte storage in physical radius semantics", () => {
    const physicalAxes = { majorRadiusMm: 3.25, minorRadiusMm: 1.5 };
    const halfFloat = encodeGroundGlassFootprintAxesMm({
      ...physicalAxes,
      storageFormat: "half-float-mm",
      maximumRadiusMm: 5,
    });
    const byte = encodeGroundGlassFootprintAxesMm({
      ...physicalAxes,
      storageFormat: "encoded-byte",
      maximumRadiusMm: 5,
    });

    expect(decodeGroundGlassFootprintAxesMm({
      ...halfFloat,
      storageFormat: "half-float-mm",
      maximumRadiusMm: 5,
    })).toEqual(physicalAxes);
    const decodedByte = decodeGroundGlassFootprintAxesMm({
      ...byte,
      storageFormat: "encoded-byte",
      maximumRadiusMm: 5,
    });
    expect(decodedByte.majorRadiusMm).toBeCloseTo(3.25, 2);
    expect(decodedByte.minorRadiusMm).toBeCloseTo(1.5, 1);
    expect(decodedByte.majorRadiusMm / decodedByte.minorRadiusMm).toBeCloseTo(
      physicalAxes.majorRadiusMm / physicalAxes.minorRadiusMm,
      1,
    );
  });
});

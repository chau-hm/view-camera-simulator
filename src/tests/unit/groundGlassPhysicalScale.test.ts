import { describe, expect, it } from "vitest";
import {
  decodeGroundGlassSignedCoC,
  decodeGroundGlassFootprintAxesMm,
  encodeGroundGlassSignedCoC,
  encodeGroundGlassFootprintAxesMm,
  resolveGroundGlassCocStorageMaxMm,
} from "../../render/groundGlassCocTarget";
import {
  calculateBoundaryCoCDiameterPx,
  calculateDofBlurRadiusPx,
  calculateInspectedCoCDiameterPx,
} from "../../core/optics/dofBlurModel";
import { cocDiameterMm } from "../../core/optics/thinLensModel";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { sampleGroundGlassBlurAtWorldPoint } from "../../render/groundGlassBlur";
import { groundGlassFootprintAxesToRttPixels } from "../../render/groundGlassFootprintCoordinates";
import {
  DEFAULT_GROUND_GLASS_INSPECTION_MAGNIFICATION,
  getGroundGlassDofVisualSettings,
} from "../../render/groundGlassVisualSettings";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import tableTiltGeometry from "../../scenes/tableTiltGeometry";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

describe("physical Ground Glass blur scale", () => {
  it("uses one explicit inspection magnification without exposing legacy amplification", () => {
    for (const sceneId of [
      "architecture-rise",
      "table-tilt",
      "shelf-swing",
      "oblique-tabletop",
      "oblique-architecture",
      "architecture-foreground",
      "interior-corner",
    ]) {
      const settings = getGroundGlassDofVisualSettings(sceneId);
      expect(settings.inspectionMagnification).toBe(
        DEFAULT_GROUND_GLASS_INSPECTION_MAGNIFICATION,
      );
      expect(settings).not.toHaveProperty("displayBlurScale");
    }
  });

  it("keeps zero CoC zero while scaling only the display conversion", () => {
    expect(calculateBoundaryCoCDiameterPx(0, 127, 1270)).toBe(0);
    expect(calculateInspectedCoCDiameterPx(0, 127, 1270, 4)).toBe(0);
    for (const magnification of [1, 2, 4, 6]) {
      expect(calculateInspectedCoCDiameterPx(0.1, 127, 1270, magnification)).toBeCloseTo(
        magnification,
        12,
      );
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

  it("scales both ellipse axes uniformly without changing orientation", () => {
    const input = {
      majorRadiusMm: 2,
      minorRadiusMm: 0.75,
      orientationRad: Math.PI / 6,
      renderWidthPx: 1270,
      renderHeightPx: 1016,
      filmWidthMm: 127,
      filmHeightMm: 101.6,
    };
    const oneX = groundGlassFootprintAxesToRttPixels({
      ...input,
      inspectionMagnification: 1,
    });
    const fourX = groundGlassFootprintAxesToRttPixels({
      ...input,
      inspectionMagnification: 4,
    });

    expect(fourX.majorAxisPx[0]).toBeCloseTo(oneX.majorAxisPx[0] * 4, 12);
    expect(fourX.majorAxisPx[1]).toBeCloseTo(oneX.majorAxisPx[1] * 4, 12);
    expect(fourX.minorAxisPx[0]).toBeCloseTo(oneX.minorAxisPx[0] * 4, 12);
    expect(fourX.minorAxisPx[1]).toBeCloseTo(oneX.minorAxisPx[1] * 4, 12);
    expect(
      Math.atan2(fourX.majorAxisPx[1], fourX.majorAxisPx[0]),
    ).toBeCloseTo(Math.atan2(oneX.majorAxisPx[1], oneX.majorAxisPx[0]), 12);
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

  it("derives storage range from the physical pixel cap after inspection scaling", () => {
    expect(resolveGroundGlassCocStorageMaxMm({
      maximumCoCRadiusPx: 42,
      filmWidthMm: 127,
      renderWidthPx: 1270,
    })).toBeCloseTo(8.4, 12);
    expect(resolveGroundGlassCocStorageMaxMm({
      maximumCoCRadiusPx: 42,
      filmWidthMm: 127,
      renderWidthPx: 1270,
      inspectionMagnification: 4,
    })).toBeCloseTo(2.1, 12);
  });

  it("applies maximumBlurRadiusPx only as a post-conversion cap", () => {
    const physicalRadiusPx = calculateDofBlurRadiusPx({
      normalizedDefocus: 1,
      circleOfConfusionMm: 0.1,
      filmWidthMm: 127,
      renderWidthPx: 1270,
      maximumBlurRadiusPx: 100,
    });
    const cappedRadiusPx = calculateDofBlurRadiusPx({
      normalizedDefocus: 4,
      circleOfConfusionMm: 0.1,
      filmWidthMm: 127,
      renderWidthPx: 1270,
      maximumBlurRadiusPx: 1.25,
    });

    expect(physicalRadiusPx).toBeCloseTo(0.5, 12);
    const inspectedRadiusPx = calculateDofBlurRadiusPx({
      normalizedDefocus: 1,
      circleOfConfusionMm: 0.1,
      filmWidthMm: 127,
      renderWidthPx: 1270,
      maximumBlurRadiusPx: 100,
      inspectionMagnification: 4,
    });
    expect(inspectedRadiusPx).toBeCloseTo(physicalRadiusPx * 4, 12);
    expect(cappedRadiusPx).toBe(1.25);
  });

  it("keeps aperture ordering at both physical and inspected display scales", () => {
    const focusImageDistanceMm = 160;
    const objectDistanceMm = 2500;
    const cocAtF11 = Math.abs(cocDiameterMm(150, 11, focusImageDistanceMm, objectDistanceMm));
    const cocAtF22 = Math.abs(cocDiameterMm(150, 22, focusImageDistanceMm, objectDistanceMm));

    expect(cocAtF11).toBeGreaterThan(cocAtF22);
    expect(calculateInspectedCoCDiameterPx(cocAtF11, 127, 1270, 1)).toBeGreaterThan(
      calculateInspectedCoCDiameterPx(cocAtF22, 127, 1270, 1),
    );
    expect(calculateInspectedCoCDiameterPx(cocAtF11, 127, 1270, 4)).toBeGreaterThan(
      calculateInspectedCoCDiameterPx(cocAtF22, 127, 1270, 4),
    );
  });

  it("keeps CPU physical CoC unchanged while scaling its display diagnostics", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...tableTiltScene.cameraPreset,
      activeSceneId: tableTiltScene.id,
    };
    const optics = deriveOpticsState(camera, tableTiltScene);
    const input = {
      worldPoint: tableTiltGeometry.nearSubject.focusDetailProbeWorld,
      opticsState: optics,
      focalLengthMm: CAMERA_CONSTANTS.focalLengthMm,
      aperture: 11,
      circleOfConfusionMm: 0.1,
      filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
      renderWidthPx: 1270,
      maximumBlurRadiusPx: 100,
    };
    const oneX = sampleGroundGlassBlurAtWorldPoint({
      ...input,
      inspectionMagnification: 1,
    });
    const fourX = sampleGroundGlassBlurAtWorldPoint({
      ...input,
      inspectionMagnification: 4,
    });

    expect(oneX.circleOfConfusionDiameterMm).toBeGreaterThan(0);
    expect(fourX.circleOfConfusionDiameterMm).toBe(
      oneX.circleOfConfusionDiameterMm,
    );
    expect(fourX.circleOfConfusionDiameterPx).toBeCloseTo(
      oneX.circleOfConfusionDiameterPx * 4,
      10,
    );
    expect(fourX.blurRadiusPx).toBeCloseTo(oneX.blurRadiusPx * 4, 10);
  });

  it("preserves byte storage ordering around learner-relevant physical CoC values", () => {
    const maximumCoCMm = resolveGroundGlassCocStorageMaxMm({
      maximumCoCRadiusPx: 8,
      filmWidthMm: 127,
      renderWidthPx: 1270,
      inspectionMagnification: 4,
    });
    const physicalValues = [0.019, 0.05, 0.075, 0.1];
    const decoded = physicalValues.map((value) =>
      decodeGroundGlassSignedCoC(
        encodeGroundGlassSignedCoC(value, "encoded-byte", maximumCoCMm),
        "encoded-byte",
        maximumCoCMm,
      ),
    );

    expect(decoded[0]).toBeLessThan(decoded[1]);
    expect(decoded[1]).toBeLessThan(decoded[2]);
    expect(decoded[2]).toBeLessThan(decoded[3]);
    expect(decoded[0]).toBeGreaterThan(0);
    expect(decoded[3]).toBeLessThanOrEqual(maximumCoCMm);
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

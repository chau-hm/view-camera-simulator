import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  createGroundGlassM6bCalibrationScene,
  createGroundGlassM6bCalibrationSource,
  evaluateGroundGlassM6bAlignment,
  fingerprintGroundGlassM6bPresentationState,
  fingerprintGroundGlassM6bSource,
  GROUND_GLASS_M6B_CALIBRATION_LANDMARKS,
  resolveGroundGlassM6bExpectedLandmarks,
} from "../../render/groundGlassPhysicalOverlayConformance";
import { projectSceneFocusTargetsToGroundGlass } from "../../render/groundGlassTargetProjection";
import { isGroundGlassM6bFixtureBuildAuthorizedForFlags } from "../../render/webgpu/groundGlassM6PresentationPolicy";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { macroBellowsExtensionScene } from "../../scenes/definitions/macro-bellows-extension";
import { DEFAULT_CAMERA_STATE, CAMERA_CONSTANTS } from "../../utils/constants";
import {
  FULL_GROUND_GLASS_INSPECTION_WINDOW,
  mapGroundGlassInspectionWindowToRttSourceCrop,
} from "../../render/groundGlassInspectionWindow";

const expectedFor = (previewMode: "raw" | "upright", inspectionWindow = FULL_GROUND_GLASS_INSPECTION_WINDOW) =>
  resolveGroundGlassM6bExpectedLandmarks({
    filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
    filmHeightMm: CAMERA_CONSTANTS.filmHeightMm,
    gridSquareMm: 10,
    displayWidthPx: 400,
    displayHeightPx: 320,
    inspectionWindow,
    previewMode,
  });

const alignedMeasurements = (expected: ReturnType<typeof expectedFor>) => {
  const byId = Object.fromEntries(expected.map((landmark) => [landmark.id, landmark.visibleInCrop
    ? landmark.cssContentBoxPx
    : null]));
  return evaluateGroundGlassM6bAlignment({
    expected,
    measuredImageById: byId,
    measuredTargetById: byId,
    measuredGridById: Object.fromEntries(expected.map((landmark) => [landmark.id,
      landmark.visibleInCrop && landmark.onGridIntersection ? landmark.cssContentBoxPx : null])),
  });
};

describe("M6B physical overlay fixture coordinates", () => {
  it("uses asymmetric physical millimetre landmarks with the established Raw/Upright maps", () => {
    const raw = expectedFor("raw");
    const upright = expectedFor("upright");
    const rawUpperLeft = raw.find((landmark) => landmark.id === "upper-left");
    const uprightUpperLeft = upright.find((landmark) => landmark.id === "upper-left");
    expect(rawUpperLeft?.physicalMm).toEqual({ x: -43.5, y: 30.8 });
    expect(rawUpperLeft?.canonicalFilmUv.u).toBeCloseTo(0.5 - 43.5 / CAMERA_CONSTANTS.filmWidthMm, 12);
    expect(rawUpperLeft?.canonicalFilmUv.v).toBeCloseTo(0.5 - 30.8 / CAMERA_CONSTANTS.filmHeightMm, 12);
    expect(rawUpperLeft?.displayUv.u).toBeCloseTo(1 - (rawUpperLeft?.canonicalFilmUv.u ?? 0), 12);
    expect(rawUpperLeft?.displayUv.v).toBeCloseTo(rawUpperLeft?.canonicalFilmUv.v ?? 0, 12);
    expect(uprightUpperLeft?.displayUv.u).toBeCloseTo(uprightUpperLeft?.canonicalFilmUv.u ?? 0, 12);
    expect(uprightUpperLeft?.displayUv.v).toBeCloseTo(1 - (uprightUpperLeft?.canonicalFilmUv.v ?? 0), 12);
    expect(new Set(raw.map(({ cssContentBoxPx }) => `${cssContentBoxPx.x},${cssContentBoxPx.y}`)).size)
      .toBe(GROUND_GLASS_M6B_CALIBRATION_LANDMARKS.length);
    expect(raw.every((landmark) => landmark.onGridIntersection)).toBe(true);
  });

  it("keeps physical points fixed while the visible display window pans and crops", () => {
    const crop = {
      active: true,
      centerU: 0.78,
      centerV: 0.22,
      widthFraction: 0.25,
      heightFraction: 0.25,
    };
    const full = expectedFor("raw");
    const cropped = expectedFor("raw", crop);
    const centerFull = full.find((landmark) => landmark.id === "center");
    const centerCrop = cropped.find((landmark) => landmark.id === "center");
    expect(centerCrop?.physicalMm).toEqual(centerFull?.physicalMm);
    expect(centerCrop?.canonicalFilmUv).toEqual(centerFull?.canonicalFilmUv);
    expect(centerCrop?.visibleInCrop).toBe(false);
    expect(cropped.filter((landmark) => landmark.visibleInCrop).length).toBeGreaterThan(0);
    expect(cropped.find((landmark) => landmark.id === "upper-left")?.cssContentBoxPx)
      .not.toEqual(full.find((landmark) => landmark.id === "upper-left")?.cssContentBoxPx);
  });

  it("measures image, target, and grid errors independently and detects one-axis mutations", () => {
    const expected = expectedFor("upright");
    const aligned = alignedMeasurements(expected);
    expect(aligned.maximumErrorPx).toBe(0);
    expect(aligned.rmsErrorPx).toBe(0);

    const first = expected[0];
    if (!first) throw new Error("Fixture omitted the center landmark");
    const broken = evaluateGroundGlassM6bAlignment({
      expected,
      measuredImageById: { center: { x: first.cssContentBoxPx.x + 7, y: first.cssContentBoxPx.y } },
      measuredTargetById: { center: { x: first.cssContentBoxPx.x, y: first.cssContentBoxPx.y - 5 } },
      measuredGridById: { center: { x: first.cssContentBoxPx.x + 3, y: first.cssContentBoxPx.y + 2 } },
    });
    expect(broken.measurements[0]?.imageErrorXPx).toBe(7);
    expect(broken.measurements[0]?.targetErrorYPx).toBe(-5);
    expect(broken.measurements[0]?.gridToLandmarkErrorPx).toBeCloseTo(Math.hypot(4, 2), 12);
    expect(broken.maximumErrorPx).toBeGreaterThan(5);
  });

  it.each([
    { name: "Raw image horizontal flip removed", target: "image", mutate: (x: number, y: number, width: number, height: number) => { void height; return { x: width - x, y }; } },
    { name: "Raw image vertical flip removed", target: "image", mutate: (x: number, y: number, width: number, height: number) => { void width; return { x, y: height - y }; } },
    { name: "image-only horizontal inversion", target: "image", mutate: (x: number, y: number, width: number, height: number) => { void height; return { x: width - x, y }; } },
    { name: "image-only vertical inversion", target: "image", mutate: (x: number, y: number, width: number, height: number) => { void width; return { x, y: height - y }; } },
    { name: "overlay-only horizontal inversion", target: "target", mutate: (x: number, y: number, width: number, height: number) => { void height; return { x: width - x, y }; } },
    { name: "overlay-only vertical inversion", target: "target", mutate: (x: number, y: number, width: number, height: number) => { void width; return { x, y: height - y }; } },
  ] as const)("rejects $name", ({ target, mutate }) => {
    const expected = expectedFor("raw");
    const width = 400;
    const height = 320;
    const imageById = Object.fromEntries(expected.map((landmark) => [landmark.id,
      landmark.visibleInCrop ? mutate(landmark.cssContentBoxPx.x, landmark.cssContentBoxPx.y, width, height) : null]));
    const targetById = Object.fromEntries(expected.map((landmark) => [landmark.id,
      landmark.visibleInCrop ? landmark.cssContentBoxPx : null]));
    const gridById = Object.fromEntries(expected.map((landmark) => [landmark.id,
      landmark.visibleInCrop && landmark.onGridIntersection ? landmark.cssContentBoxPx : null]));
    const result = evaluateGroundGlassM6bAlignment({
      expected,
      measuredImageById: target === "image" ? imageById : Object.fromEntries(expected.map((landmark) => [landmark.id,
        landmark.visibleInCrop ? landmark.cssContentBoxPx : null])),
      measuredTargetById: target === "target" ? imageById : targetById,
      measuredGridById: gridById,
    });
    expect(result.maximumErrorPx).toBeGreaterThan(2);
  });

  it.each([
    { name: "physical grid X origin shifted", mutate: (x: number, y: number) => ({ x: x + 10, y }) },
    { name: "physical grid Y origin shifted", mutate: (x: number, y: number) => ({ x, y: y + 10 }) },
    { name: "physical grid spacing altered", mutate: (x: number, y: number) => ({ x: x * 1.1, y: y * 1.1 }) },
  ] as const)("rejects $name", ({ mutate }) => {
    const expected = expectedFor("upright");
    const aligned = Object.fromEntries(expected.map((landmark) => [landmark.id,
      landmark.visibleInCrop ? landmark.cssContentBoxPx : null]));
    const result = evaluateGroundGlassM6bAlignment({
      expected,
      measuredImageById: aligned,
      measuredTargetById: aligned,
      measuredGridById: Object.fromEntries(expected.map((landmark) => [landmark.id,
        landmark.visibleInCrop && landmark.onGridIntersection
          ? mutate(landmark.cssContentBoxPx.x, landmark.cssContentBoxPx.y)
          : null])),
    });
    expect(result.maximumErrorPx).toBeGreaterThan(2);
    expect(result.measurements.filter(({ gridToLandmarkErrorPx }) => gridToLandmarkErrorPx !== null)
      .every(({ gridToLandmarkErrorPx }) => (gridToLandmarkErrorPx ?? 0) > 0)).toBe(true);
  });

  it("rejects crop mismatches, stale overlays, stale resize geometry, device-pixel scaling, and border-box offsets", () => {
    const crop = { active: true, centerU: 0.72, centerV: 0.31, widthFraction: 0.25, heightFraction: 0.25 };
    const panned = { ...crop, centerU: 0.625, centerV: 0.375 };
    const expected = expectedFor("raw", panned);
    const center = expectedFor("raw", crop);
    const fullFilm = expectedFor("raw");
    const oldDimensions = expectedFor("raw", panned);
    const resized = resolveGroundGlassM6bExpectedLandmarks({
      filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
      filmHeightMm: CAMERA_CONSTANTS.filmHeightMm,
      gridSquareMm: 10,
      displayWidthPx: 500,
      displayHeightPx: 400,
      inspectionWindow: panned,
      previewMode: "raw",
    });
    const aligned = (source: typeof expected, _width: number, _height: number, field: "image" | "target" | "grid") =>
      Object.fromEntries(expected.map((landmark, index) => {
        if (!landmark.visibleInCrop || (field === "grid" && !landmark.onGridIntersection)) return [landmark.id, null];
        const point = source[index]?.cssContentBoxPx ?? landmark.cssContentBoxPx;
        return [landmark.id, point];
      }));
    const run = (targetById: ReturnType<typeof aligned>, gridById: ReturnType<typeof aligned>, imageById = aligned(expected, 400, 320, "image")) =>
      evaluateGroundGlassM6bAlignment({ expected, measuredImageById: imageById, measuredTargetById: targetById, measuredGridById: gridById });
    const expectedGrid = aligned(expected, 400, 320, "grid");

    const staleCropGrid = run(aligned(expected, 400, 320, "target"), aligned(fullFilm, 400, 320, "grid"));
    const stalePanTarget = run(aligned(center, 400, 320, "target"), expectedGrid);
    const staleResizeTarget = evaluateGroundGlassM6bAlignment({
      expected: resized,
      measuredImageById: aligned(oldDimensions, 400, 320, "image"),
      measuredTargetById: aligned(oldDimensions, 400, 320, "target"),
      measuredGridById: aligned(oldDimensions, 400, 320, "grid"),
    });
    const devicePixelCoordinates = run(
      Object.fromEntries(expected.map(({ id, visibleInCrop, cssContentBoxPx }) => [id,
        visibleInCrop ? { x: cssContentBoxPx.x * 2, y: cssContentBoxPx.y * 2 } : null])),
      expectedGrid,
    );
    const borderBoxCoordinates = run(
      Object.fromEntries(expected.map(({ id, visibleInCrop, cssContentBoxPx }) => [id,
        visibleInCrop ? { x: cssContentBoxPx.x + 1, y: cssContentBoxPx.y + 1 } : null])),
      expectedGrid,
    );

    expect(staleCropGrid.maximumErrorPx).toBeGreaterThan(2);
    expect(stalePanTarget.maximumErrorPx).toBeGreaterThan(2);
    expect(staleResizeTarget.maximumErrorPx).toBeGreaterThan(2);
    expect(devicePixelCoordinates.maximumErrorPx).toBeGreaterThan(2);
    expect(borderBoxCoordinates.maximumErrorPx).toBeGreaterThanOrEqual(1);
  });

  it("detects double target-origin conversion and a V-inverted Raw crop", () => {
    const displayWindow = { active: true, centerU: 0.17, centerV: 0.28, widthFraction: 0.25, heightFraction: 0.25 };
    const sourceWindow = mapGroundGlassInspectionWindowToRttSourceCrop(displayWindow, "raw");
    const doubleConvertedWindow = mapGroundGlassInspectionWindowToRttSourceCrop(sourceWindow, "raw");
    const invertedCrop = { ...sourceWindow, centerV: 1 - sourceWindow.centerV };
    expect(sourceWindow.centerU).toBeCloseTo(0.83, 12);
    expect(sourceWindow.centerV).toBeCloseTo(0.72, 12);
    expect(doubleConvertedWindow.centerU).toBeCloseTo(displayWindow.centerU, 12);
    expect(doubleConvertedWindow.centerV).toBeCloseTo(displayWindow.centerV, 12);
    expect(doubleConvertedWindow.widthFraction).toBe(displayWindow.widthFraction);
    expect(doubleConvertedWindow.heightFraction).toBe(displayWindow.heightFraction);
    expect(doubleConvertedWindow).not.toEqual(sourceWindow);
    expect(invertedCrop).not.toEqual(sourceWindow);

    const expected = expectedFor("raw", displayWindow);
    const inverted = expectedFor("raw", invertedCrop);
    const aligned = Object.fromEntries(expected.map((landmark) => [landmark.id,
      landmark.visibleInCrop ? landmark.cssContentBoxPx : null]));
    const wrongSourceLocations = Object.fromEntries(expected.map((landmark, index) => [landmark.id,
      landmark.visibleInCrop ? inverted[index]?.cssContentBoxPx ?? null : null]));
    const result = evaluateGroundGlassM6bAlignment({
      expected,
      measuredImageById: wrongSourceLocations,
      measuredTargetById: aligned,
      measuredGridById: aligned,
    });
    expect(result.maximumErrorPx).toBeGreaterThan(2);
  });

  it("does not grant the M6B calibration fixture to the Macro bellows teaching scene", () => {
    expect(isGroundGlassM6bFixtureBuildAuthorizedForFlags({
      developmentBuild: true,
      rawPilotFlag: "true",
      m6PresentationFlag: "true",
      testSeamFlag: "true",
    }, true, macroBellowsExtensionScene)).toBe(false);
  });

  it("projects synthetic focus targets through the existing film-plane target projector", () => {
    const camera = { ...DEFAULT_CAMERA_STATE, activeSceneId: architectureRiseScene.id };
    const opticsState = deriveOpticsState(camera, architectureRiseScene);
    const fixtureScene = createGroundGlassM6bCalibrationScene(architectureRiseScene, opticsState);
    const projected = projectSceneFocusTargetsToGroundGlass({
      sceneDef: fixtureScene,
      opticsState,
      aperture: camera.aperture,
      previewMode: "raw",
    });
    expect(projected).toHaveLength(GROUND_GLASS_M6B_CALIBRATION_LANDMARKS.length);
    projected.forEach((target, index) => {
      const landmark = GROUND_GLASS_M6B_CALIBRATION_LANDMARKS[index];
      if (!landmark) throw new Error("Projection omitted a calibration landmark definition");
      expect(target.id).toBe(landmark.id);
      expect(target.visible).toBe(true);
      expect(target.physicalFilmUv.u).toBeCloseTo(0.5 + landmark.physicalXMm / CAMERA_CONSTANTS.filmWidthMm, 6);
      expect(target.physicalFilmUv.v).toBeCloseTo(0.5 - landmark.physicalYMm / CAMERA_CONSTANTS.filmHeightMm, 6);
    });
  });

  it("fingerprints the exact fixture bytes and presentation state for capture provenance", () => {
    const first = createGroundGlassM6bCalibrationSource();
    const second = createGroundGlassM6bCalibrationSource();
    expect(first.sourceFingerprint).toBe(fingerprintGroundGlassM6bSource(first.rgba));
    expect(first.sourceFingerprint).toBe(second.sourceFingerprint);
    second.rgba[0] = 0.25;
    expect(fingerprintGroundGlassM6bSource(second.rgba)).not.toBe(first.sourceFingerprint);
    expect(fingerprintGroundGlassM6bPresentationState({ throughputGain: 1 }))
      .not.toBe(fingerprintGroundGlassM6bPresentationState({ throughputGain: 0.5 }));
  });

  it("provides known linear RGB, breakpoint, HDR, and partial-alpha source samples", () => {
    const source = createGroundGlassM6bCalibrationSource();
    expect(source.widthPx).toBe(512);
    expect(source.heightPx).toBe(512);
    expect(source.swatches.map((swatch) => swatch.id)).toEqual(expect.arrayContaining([
      "black", "middle-gray", "white", "saturated-red", "saturated-green", "saturated-blue",
      "srgb-break-low", "srgb-break-mid", "srgb-break-high", "partial-alpha", "hdr",
    ]));
    expect(source.swatches.find((swatch) => swatch.id === "partial-alpha")?.linearRgba[3]).toBe(0.35);
    expect(source.swatches.find((swatch) => swatch.id === "hdr")?.linearRgba[0]).toBe(1.5);
    expect(source.rgba.some((value) => value > 1)).toBe(true);
    expect(source.samplingBoundaries).toEqual([{
      id: "nearest-edge-saturated-red",
      sourceUvTopOrigin: { u: 170.83 / 512, v: 490.5 / 512 },
      expectedNearestTexel: { x: 170, y: 490 },
      adjacentTexel: { x: 171, y: 490 },
    }]);
    const edge = source.samplingBoundaries[0]!;
    expect(Math.floor(edge.sourceUvTopOrigin.u * source.widthPx)).toBe(edge.expectedNearestTexel.x);
    expect(edge.adjacentTexel.x).toBe(edge.expectedNearestTexel.x + 1);
    expect(source.fieldProbes).toHaveLength(10);
    source.fieldProbes.forEach((probe) => {
      expect(probe.visibleInCrop).toBe(true);
      const x = Math.floor(probe.sourceUvTopOrigin.u * source.widthPx);
      const y = Math.floor(probe.sourceUvTopOrigin.v * source.heightPx);
      const offset = (y * source.widthPx + x) * 4;
      expect(Array.from(source.rgba.slice(offset, offset + 4))).toEqual([Math.fround(0.18), Math.fround(0.18), Math.fround(0.18), 1]);
    });
  });
});

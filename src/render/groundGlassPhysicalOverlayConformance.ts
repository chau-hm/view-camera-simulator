import type { DerivedOpticsState } from "../types/optics";
import type { SceneDefinition } from "../types/scene";
import { CAMERA_CONSTANTS } from "../utils/constants";
import type { GroundGlassInspectionWindow } from "./groundGlassInspectionWindow";
import { mapPhysicalFilmUvToGroundGlassDisplayUv, type GroundGlassPreviewMode } from "./groundGlassTargetProjection";

export const GROUND_GLASS_M6B_FIXTURE_REVISION = "m6b-physical-overlay-v1";
export const GROUND_GLASS_M6B_GRID_SQUARE_MM = 10;
export const GROUND_GLASS_M6B_SOURCE_WIDTH_PX = 512;
export const GROUND_GLASS_M6B_SOURCE_HEIGHT_PX = 512;
export const GROUND_GLASS_M6B_MARKER_RADIUS_SOURCE_PX = 10;
export const GROUND_GLASS_M6B_FIELD_LINEAR_RGBA = [0.18, 0.18, 0.18, 1] as const;

/** Uniform-field probes avoid every landmark and swatch while spanning film center and edge positions. */
export const GROUND_GLASS_M6B_PRESENTATION_FIELD_PROBES = Object.freeze([
  { id: "field-center-upper", physicalXMm: 0, physicalYMm: 18 },
  { id: "field-center-lower", physicalXMm: 0, physicalYMm: -18 },
  { id: "field-left", physicalXMm: -27, physicalYMm: 0 },
  { id: "field-right", physicalXMm: 27, physicalYMm: 0 },
  { id: "field-upper", physicalXMm: 0, physicalYMm: 35 },
  { id: "field-lower", physicalXMm: 0, physicalYMm: -35 },
  { id: "field-upper-right", physicalXMm: 28, physicalYMm: 28 },
  { id: "field-lower-left", physicalXMm: -28, physicalYMm: -28 },
  { id: "field-edge-right", physicalXMm: 55, physicalYMm: 20 },
  { id: "field-edge-left", physicalXMm: -55, physicalYMm: -20 },
] as const);

export type GroundGlassM6bCalibrationLandmark = Readonly<{
  id: string;
  label: string;
  physicalXMm: number;
  physicalYMm: number;
  color: "red" | "green" | "blue" | "yellow" | "magenta";
  shape: "square" | "cross" | "circle" | "diamond" | "asymmetric";
  linearRgba: readonly [number, number, number, number];
}>;

/** Thirteen asymmetric, non-collinear points on the shared 10 mm grid, including nearest in-film edge intersections. */
export const GROUND_GLASS_M6B_CALIBRATION_LANDMARKS = Object.freeze([
  { id: "center", label: "Center", physicalXMm: -3.5, physicalYMm: 0.8, color: "red", shape: "square", linearRgba: [0.92, 0.035, 0.02, 1] },
  { id: "upper-left", label: "Upper left", physicalXMm: -43.5, physicalYMm: 30.8, color: "green", shape: "cross", linearRgba: [0.02, 0.88, 0.08, 1] },
  { id: "upper-right", label: "Upper right", physicalXMm: 46.5, physicalYMm: 10.8, color: "blue", shape: "circle", linearRgba: [0.025, 0.12, 0.94, 1] },
  { id: "lower-left", label: "Lower left", physicalXMm: -53.5, physicalYMm: -29.2, color: "yellow", shape: "diamond", linearRgba: [0.94, 0.82, 0.025, 1] },
  { id: "lower-right", label: "Lower right", physicalXMm: 36.5, physicalYMm: -39.2, color: "magenta", shape: "circle", linearRgba: [0.9, 0.025, 0.72, 1] },
  { id: "film-upper-left", label: "Film upper left", physicalXMm: -CAMERA_CONSTANTS.filmWidthMm / 2 + GROUND_GLASS_M6B_GRID_SQUARE_MM, physicalYMm: CAMERA_CONSTANTS.filmHeightMm / 2 - GROUND_GLASS_M6B_GRID_SQUARE_MM, color: "red", shape: "square", linearRgba: [0.92, 0.035, 0.02, 1] },
  { id: "film-upper-right", label: "Film upper right", physicalXMm: -CAMERA_CONSTANTS.filmWidthMm / 2 + Math.floor(CAMERA_CONSTANTS.filmWidthMm / GROUND_GLASS_M6B_GRID_SQUARE_MM) * GROUND_GLASS_M6B_GRID_SQUARE_MM, physicalYMm: CAMERA_CONSTANTS.filmHeightMm / 2 - GROUND_GLASS_M6B_GRID_SQUARE_MM, color: "green", shape: "cross", linearRgba: [0.02, 0.88, 0.08, 1] },
  { id: "film-lower-left", label: "Film lower left", physicalXMm: -CAMERA_CONSTANTS.filmWidthMm / 2 + GROUND_GLASS_M6B_GRID_SQUARE_MM, physicalYMm: CAMERA_CONSTANTS.filmHeightMm / 2 - Math.floor(CAMERA_CONSTANTS.filmHeightMm / GROUND_GLASS_M6B_GRID_SQUARE_MM) * GROUND_GLASS_M6B_GRID_SQUARE_MM, color: "blue", shape: "circle", linearRgba: [0.025, 0.12, 0.94, 1] },
  { id: "film-lower-right", label: "Film lower right", physicalXMm: -CAMERA_CONSTANTS.filmWidthMm / 2 + Math.floor(CAMERA_CONSTANTS.filmWidthMm / GROUND_GLASS_M6B_GRID_SQUARE_MM) * GROUND_GLASS_M6B_GRID_SQUARE_MM, physicalYMm: CAMERA_CONSTANTS.filmHeightMm / 2 - Math.floor(CAMERA_CONSTANTS.filmHeightMm / GROUND_GLASS_M6B_GRID_SQUARE_MM) * GROUND_GLASS_M6B_GRID_SQUARE_MM, color: "yellow", shape: "diamond", linearRgba: [0.94, 0.82, 0.025, 1] },
  { id: "film-left-center", label: "Film left center", physicalXMm: -CAMERA_CONSTANTS.filmWidthMm / 2 + GROUND_GLASS_M6B_GRID_SQUARE_MM, physicalYMm: 0.8, color: "magenta", shape: "circle", linearRgba: [0.9, 0.025, 0.72, 1] },
  { id: "film-right-center", label: "Film right center", physicalXMm: -CAMERA_CONSTANTS.filmWidthMm / 2 + Math.floor(CAMERA_CONSTANTS.filmWidthMm / GROUND_GLASS_M6B_GRID_SQUARE_MM) * GROUND_GLASS_M6B_GRID_SQUARE_MM, physicalYMm: 0.8, color: "red", shape: "square", linearRgba: [0.92, 0.035, 0.02, 1] },
  { id: "film-center-top", label: "Film center top", physicalXMm: -CAMERA_CONSTANTS.filmWidthMm / 2 + Math.round(CAMERA_CONSTANTS.filmWidthMm / (2 * GROUND_GLASS_M6B_GRID_SQUARE_MM)) * GROUND_GLASS_M6B_GRID_SQUARE_MM, physicalYMm: CAMERA_CONSTANTS.filmHeightMm / 2 - GROUND_GLASS_M6B_GRID_SQUARE_MM, color: "green", shape: "cross", linearRgba: [0.02, 0.88, 0.08, 1] },
  { id: "film-center-bottom", label: "Film center bottom", physicalXMm: -CAMERA_CONSTANTS.filmWidthMm / 2 + Math.round(CAMERA_CONSTANTS.filmWidthMm / (2 * GROUND_GLASS_M6B_GRID_SQUARE_MM)) * GROUND_GLASS_M6B_GRID_SQUARE_MM, physicalYMm: CAMERA_CONSTANTS.filmHeightMm / 2 - Math.floor(CAMERA_CONSTANTS.filmHeightMm / GROUND_GLASS_M6B_GRID_SQUARE_MM) * GROUND_GLASS_M6B_GRID_SQUARE_MM, color: "blue", shape: "circle", linearRgba: [0.025, 0.12, 0.94, 1] },
] as const satisfies readonly GroundGlassM6bCalibrationLandmark[]);

export type GroundGlassM6bExpectedLandmark = Readonly<{
  id: string;
  physicalMm: Readonly<{ x: number; y: number }>;
  canonicalFilmUv: Readonly<{ u: number; v: number }>;
  displayUv: Readonly<{ u: number; v: number }>;
  cssContentBoxPx: Readonly<{ x: number; y: number }>;
  visibleInCrop: boolean;
  onGridIntersection: boolean;
}>;

export const resolveGroundGlassM6bExpectedLandmarks = (input: Readonly<{
  filmWidthMm: number;
  filmHeightMm: number;
  gridSquareMm: number;
  displayWidthPx: number;
  displayHeightPx: number;
  inspectionWindow: GroundGlassInspectionWindow;
  previewMode: GroundGlassPreviewMode;
  landmarks?: readonly GroundGlassM6bCalibrationLandmark[];
}>): readonly GroundGlassM6bExpectedLandmark[] => {
  const landmarks = input.landmarks ?? GROUND_GLASS_M6B_CALIBRATION_LANDMARKS;
  const window = input.inspectionWindow;
  const width = window.active ? window.widthFraction : 1;
  const height = window.active ? window.heightFraction : 1;
  const centerU = window.active ? window.centerU : 0.5;
  const centerV = window.active ? window.centerV : 0.5;
  const originU = centerU - width / 2;
  const originV = centerV - height / 2;
  return landmarks.map((landmark) => {
    const canonicalFilmUv = {
      u: 0.5 + landmark.physicalXMm / input.filmWidthMm,
      v: 0.5 - landmark.physicalYMm / input.filmHeightMm,
    };
    const displayUv = mapPhysicalFilmUvToGroundGlassDisplayUv(canonicalFilmUv, input.previewMode);
    const cropUv = {
      u: (displayUv.u - originU) / width,
      v: (displayUv.v - originV) / height,
    };
    // The shared CSS grid is phased at canonical film UV (0, 0), which is the
    // physical upper-left film corner. Film width/height are not whole grid
    // multiples, so testing multiples from the film center would misclassify
    // real grid intersections.
    const gridColumn = (landmark.physicalXMm + input.filmWidthMm / 2) / input.gridSquareMm;
    const gridRow = (input.filmHeightMm / 2 - landmark.physicalYMm) / input.gridSquareMm;
    const onGridIntersection = Math.abs(gridColumn - Math.round(gridColumn)) < 1e-9 &&
      Math.abs(gridRow - Math.round(gridRow)) < 1e-9;
    return {
      id: landmark.id,
      physicalMm: { x: landmark.physicalXMm, y: landmark.physicalYMm },
      canonicalFilmUv,
      displayUv,
      cssContentBoxPx: {
        x: cropUv.u * input.displayWidthPx,
        y: cropUv.v * input.displayHeightPx,
      },
      visibleInCrop: cropUv.u >= 0 && cropUv.u <= 1 && cropUv.v >= 0 && cropUv.v <= 1,
      onGridIntersection,
    };
  });
};

export type GroundGlassM6bMeasuredPoint = Readonly<{ x: number; y: number }> | null;

export type GroundGlassM6bLandmarkMeasurement = Readonly<{
  id: string;
  status: "measured" | "outside-current-crop" | "unsupported";
  expectedImagePx: Readonly<{ x: number; y: number }>;
  expectedTargetPx: Readonly<{ x: number; y: number }>;
  expectedGridIntersectionPx: Readonly<{ x: number; y: number }> | null;
  measuredImagePx: GroundGlassM6bMeasuredPoint;
  measuredTargetPx: GroundGlassM6bMeasuredPoint;
  measuredGridIntersectionPx: GroundGlassM6bMeasuredPoint;
  imageErrorXPx: number | null;
  imageErrorYPx: number | null;
  imageMappingErrorPx: number | null;
  targetErrorXPx: number | null;
  targetErrorYPx: number | null;
  overlayMappingErrorPx: number | null;
  gridErrorXPx: number | null;
  gridErrorYPx: number | null;
  gridMappingErrorPx: number | null;
  gridToLandmarkErrorPx: number | null;
}>;

export type GroundGlassM6bAlignmentMeasurement = Readonly<{
  measurements: readonly GroundGlassM6bLandmarkMeasurement[];
  horizontalErrorPx: number | null;
  verticalErrorPx: number | null;
  maximumErrorPx: number | null;
  rmsErrorPx: number | null;
  measuredLandmarkCount: number;
  outsideCurrentCropCount: number;
  unsupportedCount: number;
}>;

const distance = (left: GroundGlassM6bMeasuredPoint, right: GroundGlassM6bMeasuredPoint): number | null =>
  left && right ? Math.hypot(left.x - right.x, left.y - right.y) : null;

/** Compares independent raster detections and DOM overlay measurements with physical-film expectations. */
export const evaluateGroundGlassM6bAlignment = (input: Readonly<{
  expected: readonly GroundGlassM6bExpectedLandmark[];
  measuredImageById: Readonly<Record<string, GroundGlassM6bMeasuredPoint>>;
  measuredTargetById: Readonly<Record<string, GroundGlassM6bMeasuredPoint>>;
  measuredGridById: Readonly<Record<string, GroundGlassM6bMeasuredPoint>>;
}>): GroundGlassM6bAlignmentMeasurement => {
  const measurements = input.expected.map((expected) => {
    const measuredImagePx = input.measuredImageById[expected.id] ?? null;
    const measuredTargetPx = input.measuredTargetById[expected.id] ?? null;
    const measuredGridIntersectionPx = input.measuredGridById[expected.id] ?? null;
    const expectedPoint = expected.cssContentBoxPx;
    const imageErrorXPx = measuredImagePx ? measuredImagePx.x - expectedPoint.x : null;
    const imageErrorYPx = measuredImagePx ? measuredImagePx.y - expectedPoint.y : null;
    const targetErrorXPx = measuredTargetPx ? measuredTargetPx.x - expectedPoint.x : null;
    const targetErrorYPx = measuredTargetPx ? measuredTargetPx.y - expectedPoint.y : null;
    const imageMappingErrorPx = distance(measuredImagePx, expectedPoint);
    const overlayMappingErrorPx = distance(measuredTargetPx, expectedPoint);
    const gridErrorXPx = expected.onGridIntersection && measuredGridIntersectionPx
      ? measuredGridIntersectionPx.x - expectedPoint.x
      : null;
    const gridErrorYPx = expected.onGridIntersection && measuredGridIntersectionPx
      ? measuredGridIntersectionPx.y - expectedPoint.y
      : null;
    const gridMappingErrorPx = expected.onGridIntersection
      ? distance(measuredGridIntersectionPx, expectedPoint)
      : null;
    return {
      id: expected.id,
      status: expected.visibleInCrop
        ? measuredImagePx && measuredTargetPx && (!expected.onGridIntersection || measuredGridIntersectionPx)
          ? "measured" as const
          : "unsupported" as const
        : "outside-current-crop" as const,
      expectedImagePx: expectedPoint,
      expectedTargetPx: expectedPoint,
      expectedGridIntersectionPx: expected.onGridIntersection ? expectedPoint : null,
      measuredImagePx,
      measuredTargetPx,
      measuredGridIntersectionPx,
      imageErrorXPx,
      imageErrorYPx,
      imageMappingErrorPx,
      targetErrorXPx,
      targetErrorYPx,
      overlayMappingErrorPx,
      gridErrorXPx,
      gridErrorYPx,
      gridMappingErrorPx,
      gridToLandmarkErrorPx: expected.onGridIntersection
        ? distance(measuredGridIntersectionPx, measuredImagePx)
        : null,
    };
  });
  const measured = measurements.filter((measurement) => measurement.status === "measured");
  const spatialErrors = measured.flatMap((measurement) => [
    measurement.imageMappingErrorPx,
    measurement.overlayMappingErrorPx,
    measurement.gridMappingErrorPx,
    measurement.gridToLandmarkErrorPx,
  ]).filter((error): error is number => error !== null);
  const horizontalErrors = measured.flatMap((measurement) => [
    measurement.imageErrorXPx,
    measurement.targetErrorXPx,
    measurement.gridErrorXPx,
  ]).filter((error): error is number => error !== null);
  const verticalErrors = measured.flatMap((measurement) => [
    measurement.imageErrorYPx,
    measurement.targetErrorYPx,
    measurement.gridErrorYPx,
  ]).filter((error): error is number => error !== null);
  return {
    measurements,
    horizontalErrorPx: horizontalErrors.length > 0
      ? Math.sqrt(horizontalErrors.reduce((sum, value) => sum + value * value, 0) / horizontalErrors.length)
      : null,
    verticalErrorPx: verticalErrors.length > 0
      ? Math.sqrt(verticalErrors.reduce((sum, value) => sum + value * value, 0) / verticalErrors.length)
      : null,
    maximumErrorPx: spatialErrors.length > 0 ? Math.max(...spatialErrors) : null,
    rmsErrorPx: spatialErrors.length > 0
      ? Math.sqrt(spatialErrors.reduce((sum, value) => sum + value * value, 0) / spatialErrors.length)
      : null,
    measuredLandmarkCount: measured.length,
    outsideCurrentCropCount: measurements.filter((measurement) => measurement.status === "outside-current-crop").length,
    unsupportedCount: measurements.filter((measurement) => measurement.status === "unsupported").length,
  };
};

const isInsideShape = (shape: GroundGlassM6bCalibrationLandmark["shape"], x: number, y: number): boolean => {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (shape === "square") return ax <= 10 && ay <= 10;
  if (shape === "cross") return (ax <= 2 && ay <= 10) || (ay <= 2 && ax <= 10);
  if (shape === "circle") return x * x + y * y <= 100;
  if (shape === "diamond") return ax + ay <= 14;
  return (ax <= 2 && ay <= 10) || (ay <= 2 && x >= -2 && x <= 10);
};

const paint = (data: Float32Array, width: number, height: number, x: number, y: number, rgba: readonly number[]): void => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const offset = (y * width + x) * 4;
  data[offset] = rgba[0] ?? 0;
  data[offset + 1] = rgba[1] ?? 0;
  data[offset + 2] = rgba[2] ?? 0;
  data[offset + 3] = rgba[3] ?? 1;
};

const COLOR_SWATCHES = Object.freeze([
  { id: "black", rgba: [0, 0, 0, 1] },
  { id: "low-gray", rgba: [0.002, 0.002, 0.002, 1] },
  { id: "middle-gray", rgba: [0.18, 0.18, 0.18, 1] },
  { id: "srgb-break-low", rgba: [0.003, 0.003, 0.003, 1] },
  { id: "srgb-break-mid", rgba: [0.0031308, 0.0031308, 0.0031308, 1] },
  { id: "srgb-break-high", rgba: [0.0033, 0.0033, 0.0033, 1] },
  { id: "white", rgba: [1, 1, 1, 1] },
  { id: "saturated-red", rgba: [1, 0, 0, 1] },
  { id: "saturated-green", rgba: [0, 1, 0, 1] },
  { id: "saturated-blue", rgba: [0, 0, 1, 1] },
  { id: "asymmetric-rgb", rgba: [0.72, 0.19, 0.035, 1] },
  { id: "partial-alpha", rgba: [0.55, 0.23, 0.08, 0.35] },
  { id: "hdr", rgba: [1.5, 0.5, 0.12, 1] },
] as const);

export type GroundGlassM6bColorSwatch = Readonly<{
  id: string;
  linearRgba: readonly [number, number, number, number];
  sourceUvTopOrigin: Readonly<{ u: number; v: number }>;
}>;

export type GroundGlassM6bPresentationFieldProbe = Readonly<{
  id: string;
  physicalMm: Readonly<{ x: number; y: number }>;
  linearRgba: readonly [number, number, number, number];
  sourceUvTopOrigin: Readonly<{ u: number; v: number }>;
  visibleInCrop: boolean;
}>;

export type GroundGlassM6bSamplingBoundary = Readonly<{
  id: string;
  sourceUvTopOrigin: Readonly<{ u: number; v: number }>;
  expectedNearestTexel: Readonly<{ x: number; y: number }>;
  adjacentTexel: Readonly<{ x: number; y: number }>;
}>;

/** Compact deterministic trace fingerprint; this is not a cryptographic integrity primitive. */
export const fingerprintGroundGlassM6bBytes = (bytes: Uint8Array): string => {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

export const fingerprintGroundGlassM6bSource = (rgba: Float32Array): string =>
  fingerprintGroundGlassM6bBytes(new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength));

export const fingerprintGroundGlassM6bPresentationState = (state: unknown): string => {
  const serialized = JSON.stringify(state);
  if (serialized === undefined) throw new Error("M6B presentation state is not serializable");
  return fingerprintGroundGlassM6bBytes(new TextEncoder().encode(serialized));
};

/** Float32, nearest-sampled linear source pixels for the native M6 material fixture. */
export const createGroundGlassM6bCalibrationSource = (input: Readonly<{
  inspectionWindow?: GroundGlassInspectionWindow;
  previewMode?: GroundGlassPreviewMode;
  widthPx?: number;
  heightPx?: number;
}> = {}): Readonly<{
  widthPx: number;
  heightPx: number;
  rgba: Float32Array;
  sourceFingerprint: string;
  swatches: readonly GroundGlassM6bColorSwatch[];
  fieldProbes: readonly GroundGlassM6bPresentationFieldProbe[];
  samplingBoundaries: readonly GroundGlassM6bSamplingBoundary[];
}> => {
  const widthPx = input.widthPx ?? GROUND_GLASS_M6B_SOURCE_WIDTH_PX;
  const heightPx = input.heightPx ?? GROUND_GLASS_M6B_SOURCE_HEIGHT_PX;
  const crop = input.inspectionWindow ?? { active: false, centerU: 0.5, centerV: 0.5, widthFraction: 1, heightFraction: 1 };
  const previewMode = input.previewMode ?? "upright";
  const cropWidth = crop.active ? crop.widthFraction : 1;
  const cropHeight = crop.active ? crop.heightFraction : 1;
  const cropLeft = (crop.active ? crop.centerU : 0.5) - cropWidth / 2;
  const cropTop = (crop.active ? crop.centerV : 0.5) - cropHeight / 2;
  const rgba = new Float32Array(widthPx * heightPx * 4);
  for (let pixel = 0; pixel < widthPx * heightPx; pixel += 1) {
    rgba[pixel * 4] = GROUND_GLASS_M6B_FIELD_LINEAR_RGBA[0];
    rgba[pixel * 4 + 1] = GROUND_GLASS_M6B_FIELD_LINEAR_RGBA[1];
    rgba[pixel * 4 + 2] = GROUND_GLASS_M6B_FIELD_LINEAR_RGBA[2];
    rgba[pixel * 4 + 3] = GROUND_GLASS_M6B_FIELD_LINEAR_RGBA[3];
  }

  GROUND_GLASS_M6B_CALIBRATION_LANDMARKS.forEach((landmark) => {
    const filmUv = {
      u: 0.5 + landmark.physicalXMm / CAMERA_CONSTANTS.filmWidthMm,
      v: 0.5 - landmark.physicalYMm / CAMERA_CONSTANTS.filmHeightMm,
    };
    const displayUv = previewMode === "raw"
      ? { u: 1 - filmUv.u, v: filmUv.v }
      : { u: filmUv.u, v: 1 - filmUv.v };
    const displayLocalUv = {
      u: (displayUv.u - cropLeft) / cropWidth,
      v: (displayUv.v - cropTop) / cropHeight,
    };
    if (displayLocalUv.u < 0 || displayLocalUv.u > 1 || displayLocalUv.v < 0 || displayLocalUv.v > 1) return;
    // Independently encode the source coordinate sampled by the M6 fullscreen material:
    // Raw flips both fullscreen UV axes; Upright samples the fullscreen UV unchanged.
    const sourceUvTopOrigin = previewMode === "raw"
      ? { u: 1 - displayLocalUv.u, v: 1 - displayLocalUv.v }
      : displayLocalUv;
    const centerX = Math.round(sourceUvTopOrigin.u * (widthPx - 1));
    const centerY = Math.round(sourceUvTopOrigin.v * (heightPx - 1));
    for (let y = -GROUND_GLASS_M6B_MARKER_RADIUS_SOURCE_PX; y <= GROUND_GLASS_M6B_MARKER_RADIUS_SOURCE_PX; y += 1) {
      for (let x = -GROUND_GLASS_M6B_MARKER_RADIUS_SOURCE_PX; x <= GROUND_GLASS_M6B_MARKER_RADIUS_SOURCE_PX; x += 1) {
        if (isInsideShape(landmark.shape, x, y)) {
          paint(rgba, widthPx, heightPx, centerX + x, centerY + y, landmark.linearRgba);
        }
      }
    }
  });

  const swatchWidthPx = 16;
  const swatchHeightPx = 16;
  const swatchGapPx = 5;
  const swatchStartX = 8;
  const swatchY = heightPx - 30;
  const swatches = COLOR_SWATCHES.map((swatch, index) => {
    const startX = swatchStartX + index * (swatchWidthPx + swatchGapPx);
    for (let y = 0; y < swatchHeightPx; y += 1) {
      for (let x = 0; x < swatchWidthPx; x += 1) {
        paint(rgba, widthPx, heightPx, startX + x, swatchY + y, swatch.rgba);
      }
    }
    return {
      id: swatch.id,
      linearRgba: swatch.rgba as readonly [number, number, number, number],
      sourceUvTopOrigin: {
        u: (startX + swatchWidthPx / 2) / widthPx,
        v: (swatchY + swatchHeightPx / 2) / heightPx,
      },
    };
  });
  const redSwatchStartX = swatchStartX + COLOR_SWATCHES.findIndex(({ id }) => id === "saturated-red") * (swatchWidthPx + swatchGapPx);
  const redSwatchEndX = redSwatchStartX + swatchWidthPx;
  const samplingBoundaries: readonly GroundGlassM6bSamplingBoundary[] = [{
    id: "nearest-edge-saturated-red",
    // Place the source coordinate just inside the final red texel. At the
    // 514px output raster this lands on a fragment whose linear-filter
    // footprint straddles the red/gray edge, while nearest sampling must
    // return the final red texel exactly.
    sourceUvTopOrigin: {
      u: (redSwatchEndX - 0.17) / widthPx,
      v: (swatchY + swatchHeightPx / 2 + 0.5) / heightPx,
    },
    expectedNearestTexel: { x: redSwatchEndX - 1, y: swatchY + swatchHeightPx / 2 },
    adjacentTexel: { x: redSwatchEndX, y: swatchY + swatchHeightPx / 2 },
  }];
  const fieldProbes = GROUND_GLASS_M6B_PRESENTATION_FIELD_PROBES.map((probe) => {
    const filmUv = {
      u: 0.5 + probe.physicalXMm / CAMERA_CONSTANTS.filmWidthMm,
      v: 0.5 - probe.physicalYMm / CAMERA_CONSTANTS.filmHeightMm,
    };
    const displayUv = previewMode === "raw"
      ? { u: 1 - filmUv.u, v: filmUv.v }
      : { u: filmUv.u, v: 1 - filmUv.v };
    const displayLocalUv = {
      u: (displayUv.u - cropLeft) / cropWidth,
      v: (displayUv.v - cropTop) / cropHeight,
    };
    return {
      id: probe.id,
      physicalMm: { x: probe.physicalXMm, y: probe.physicalYMm },
      linearRgba: GROUND_GLASS_M6B_FIELD_LINEAR_RGBA,
      sourceUvTopOrigin: previewMode === "raw"
        ? { u: 1 - displayLocalUv.u, v: 1 - displayLocalUv.v }
        : displayLocalUv,
      visibleInCrop: displayLocalUv.u >= 0 && displayLocalUv.u <= 1 &&
        displayLocalUv.v >= 0 && displayLocalUv.v <= 1,
    };
  });
  return {
    widthPx,
    heightPx,
    rgba,
    sourceFingerprint: fingerprintGroundGlassM6bSource(rgba),
    swatches,
    fieldProbes,
    samplingBoundaries,
  };
};

const interpolatePoint = (
  topLeft: DerivedOpticsState["filmPlaneCornersWorld"]["topLeft"],
  topRight: DerivedOpticsState["filmPlaneCornersWorld"]["topRight"],
  bottomLeft: DerivedOpticsState["filmPlaneCornersWorld"]["bottomLeft"],
  bottomRight: DerivedOpticsState["filmPlaneCornersWorld"]["bottomRight"],
  u: number,
  v: number,
) => ({
  x: (1 - u) * (1 - v) * topLeft.x + u * (1 - v) * topRight.x + (1 - u) * v * bottomLeft.x + u * v * bottomRight.x,
  y: (1 - u) * (1 - v) * topLeft.y + u * (1 - v) * topRight.y + (1 - u) * v * bottomLeft.y + u * v * bottomRight.y,
  z: (1 - u) * (1 - v) * topLeft.z + u * (1 - v) * topRight.z + (1 - u) * v * bottomLeft.z + u * v * bottomRight.z,
});

/** Builds unrendered synthetic focus-target positions so the existing projection path can position the fixture overlays. */
export const createGroundGlassM6bCalibrationScene = (
  scene: SceneDefinition,
  opticsState: DerivedOpticsState,
): SceneDefinition => ({
  ...scene,
  focusTargets: GROUND_GLASS_M6B_CALIBRATION_LANDMARKS.map((landmark) => {
    const u = 0.5 + landmark.physicalXMm / CAMERA_CONSTANTS.filmWidthMm;
    const v = 0.5 - landmark.physicalYMm / CAMERA_CONSTANTS.filmHeightMm;
    const filmPoint = interpolatePoint(
      opticsState.filmPlaneCornersWorld.topLeft,
      opticsState.filmPlaneCornersWorld.topRight,
      opticsState.filmPlaneCornersWorld.bottomLeft,
      opticsState.filmPlaneCornersWorld.bottomRight,
      u,
      v,
    );
    return {
      id: landmark.id,
      label: landmark.label,
      weight: 1,
      worldPosition: {
        x: 2 * opticsState.lensCenterWorld.x - filmPoint.x,
        y: 2 * opticsState.lensCenterWorld.y - filmPoint.y,
        z: 2 * opticsState.lensCenterWorld.z - filmPoint.z,
      },
    };
  }),
});

export const mapGroundGlassM6bTargetIntoInspectionWindow = (input: Readonly<{
  displayUv: Readonly<{ u: number; v: number }>;
  inspectionWindow: GroundGlassInspectionWindow;
}>): Readonly<{ u: number; v: number; visible: boolean }> => {
  const window = input.inspectionWindow;
  const width = window.active ? window.widthFraction : 1;
  const height = window.active ? window.heightFraction : 1;
  const originU = (window.active ? window.centerU : 0.5) - width / 2;
  const originV = (window.active ? window.centerV : 0.5) - height / 2;
  const u = (input.displayUv.u - originU) / width;
  const v = (input.displayUv.v - originV) / height;
  return { u, v, visible: u >= 0 && u <= 1 && v >= 0 && v <= 1 };
};

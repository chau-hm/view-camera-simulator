import { describe, expect, it } from "vitest";
import {
  resolveGroundGlassPhysicalGrid,
} from "../../render/groundGlassPhysicalGrid";
import {
  resolveGroundGlassInspectionWindow,
  FULL_GROUND_GLASS_INSPECTION_WINDOW,
} from "../../render/groundGlassInspectionWindow";

const FILM_WIDTH_MM = 127;
const FILM_HEIGHT_MM = 101.6;
const GRID_SQUARE_MM = 10;
const DISPLAY_WIDTH_PX = 500;
const DISPLAY_HEIGHT_PX = 400;

const resolveGrid = (inspectionWindow = FULL_GROUND_GLASS_INSPECTION_WINDOW, previewMode: "raw" | "upright" = "raw") =>
  resolveGroundGlassPhysicalGrid({
    filmWidthMm: FILM_WIDTH_MM,
    filmHeightMm: FILM_HEIGHT_MM,
    gridSquareMm: GRID_SQUARE_MM,
    displayWidthPx: DISPLAY_WIDTH_PX,
    displayHeightPx: DISPLAY_HEIGHT_PX,
    inspectionWindow,
    previewMode,
  });

describe("physical Ground Glass grid", () => {
  it("derives a 10 mm square from the complete physical film", () => {
    const grid = resolveGrid();

    expect(grid).not.toBeNull();
    expect(grid?.sampledFilmWidthMm).toBe(FILM_WIDTH_MM);
    expect(grid?.sampledFilmHeightMm).toBe(FILM_HEIGHT_MM);
    expect(grid?.spacingXPx).toBeCloseTo(DISPLAY_WIDTH_PX * GRID_SQUARE_MM / FILM_WIDTH_MM, 12);
    expect(grid?.spacingYPx).toBeCloseTo(DISPLAY_HEIGHT_PX * GRID_SQUARE_MM / FILM_HEIGHT_MM, 12);
    expect(grid?.originXPx).toBeCloseTo(DISPLAY_WIDTH_PX, 12);
    expect(grid?.originYPx).toBeCloseTo(0, 12);
  });

  it("scales the same physical square with the 4x inspection crop", () => {
    const loupe = resolveGroundGlassInspectionWindow({
      active: true,
      normalizedPan: { x: 0, y: 0 },
      magnification: 4,
    });
    const fullGrid = resolveGrid();
    const loupeGrid = resolveGrid(loupe);

    expect(loupeGrid).not.toBeNull();
    expect(loupeGrid?.sampledFilmWidthMm).toBeCloseTo(FILM_WIDTH_MM / 4, 12);
    expect(loupeGrid?.sampledFilmHeightMm).toBeCloseTo(FILM_HEIGHT_MM / 4, 12);
    expect(loupeGrid!.spacingXPx / fullGrid!.spacingXPx).toBeCloseTo(4, 12);
    expect(loupeGrid!.spacingYPx / fullGrid!.spacingYPx).toBeCloseTo(4, 12);
  });

  it("keeps the grid phase tied to a non-centred physical film window", () => {
    const loupe = resolveGroundGlassInspectionWindow({
      active: true,
      normalizedPan: { x: 0.5, y: -0.5 },
      magnification: 4,
    });
    const grid = resolveGrid(loupe);
    const widthFraction = loupe.widthFraction;
    const heightFraction = loupe.heightFraction;
    const windowOriginU = loupe.centerU - widthFraction / 2;
    const windowOriginV = loupe.centerV - heightFraction / 2;

    expect(grid).not.toBeNull();
    expect(grid?.originXPx).toBeCloseTo(
      (1 - windowOriginU) / widthFraction * DISPLAY_WIDTH_PX,
      12,
    );
    expect(grid?.originYPx).toBeCloseTo(
      -windowOriginV / heightFraction * DISPLAY_HEIGHT_PX,
      12,
    );
  });

  it("keeps square size physical while mapping the film origin per display mode", () => {
    const raw = resolveGrid(FULL_GROUND_GLASS_INSPECTION_WINDOW, "raw");
    const upright = resolveGrid(FULL_GROUND_GLASS_INSPECTION_WINDOW, "upright");

    expect(upright?.spacingXPx).toBeCloseTo(raw!.spacingXPx, 12);
    expect(upright?.spacingYPx).toBeCloseTo(raw!.spacingYPx, 12);
    expect(raw?.originXPx).toBeCloseTo(DISPLAY_WIDTH_PX, 12);
    expect(raw?.originYPx).toBeCloseTo(0, 12);
    expect(upright?.originXPx).toBeCloseTo(0, 12);
    expect(upright?.originYPx).toBeCloseTo(DISPLAY_HEIGHT_PX, 12);
  });

  it("rejects non-physical inputs instead of inventing a screen scale", () => {
    expect(resolveGroundGlassPhysicalGrid({
      filmWidthMm: FILM_WIDTH_MM,
      filmHeightMm: FILM_HEIGHT_MM,
      gridSquareMm: 0,
      displayWidthPx: DISPLAY_WIDTH_PX,
      displayHeightPx: DISPLAY_HEIGHT_PX,
      inspectionWindow: FULL_GROUND_GLASS_INSPECTION_WINDOW,
      previewMode: "raw",
    })).toBeNull();
  });
});

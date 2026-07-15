import { describe, expect, it } from "vitest";
import { planeFromPointNormal } from "../../core/math/plane";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  deriveScheimpflugConstruction,
  SCHEIMPFLUG_DIRECTION_TOLERANCE,
  SCHEIMPFLUG_POINT_TOLERANCE_MM,
} from "../../core/optics/scheimpflugConstruction";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import tableTiltGeometry from "../../scenes/tableTiltGeometry";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { supportsScheimpflugConstruction } from "../../render/scheimpflugSceneSupport";

const constructionFor = (overrides: Partial<typeof DEFAULT_CAMERA_STATE>) => {
  const optics = deriveOpticsState(
    {
      ...DEFAULT_CAMERA_STATE,
      ...tableTiltScene.cameraPreset,
      activeSceneId: tableTiltScene.id,
      ...overrides,
    },
    tableTiltScene,
  );
  return {
    optics,
    construction: deriveScheimpflugConstruction({
      filmPlane: optics.filmPlane,
      lensPlane: optics.lensPlane,
      focusPlane: optics.focusPlane,
    }),
  };
};

const expectValidConstruction = (
  construction: ReturnType<typeof deriveScheimpflugConstruction>,
) => {
  expect(construction.isValid).toBe(true);
  expect(construction.commonLine).not.toBeNull();
  expect(Number.isFinite(construction.pointResidualMm)).toBe(true);
  expect(Number.isFinite(construction.directionResidual)).toBe(true);
  expect(Math.abs(construction.pointResidualMm!)).toBeLessThanOrEqual(
    SCHEIMPFLUG_POINT_TOLERANCE_MM,
  );
  expect(Math.abs(construction.directionResidual!)).toBeLessThanOrEqual(
    SCHEIMPFLUG_DIRECTION_TOLERANCE,
  );
  const direction = construction.commonLine!.direction;
  expect(Math.hypot(direction.x, direction.y, direction.z)).toBeCloseTo(1, 12);
  const firstSignificant = [direction.x, direction.y, direction.z].find(
    (component) => Math.abs(component) > 1e-12,
  );
  expect(firstSignificant).toBeGreaterThan(0);
};

describe("Scheimpflug construction model", () => {
  it("exposes the teaching control for Table Tilt and Shelf Swing only", () => {
    expect(supportsScheimpflugConstruction("table-tilt")).toBe(true);
    expect(supportsScheimpflugConstruction("shelf-swing")).toBe(true);
    expect(supportsScheimpflugConstruction("architecture-rise")).toBe(false);
    expect(supportsScheimpflugConstruction("focus-fundamentals-two-targets")).toBe(false);
  });
  it("documents the unavailable parallel-plane state without inventing a line", () => {
    const { construction } = constructionFor({ frontTiltDeg: 0, frontSwingDeg: 0 });
    expect(construction).toEqual({
      commonLine: null,
      pointResidualMm: null,
      directionResidual: null,
      isValid: false,
      unavailableReason: "Film and lens planes are parallel.",
    });
  });

  it("validates calibrated positive and negative Table Tilt states", () => {
    for (const frontTiltDeg of [
      tableTiltGeometry.tableTiltCalibration.frontTiltDeg,
      -tableTiltGeometry.tableTiltCalibration.frontTiltDeg,
    ]) {
      expectValidConstruction(
        constructionFor({
          frontTiltDeg,
          focusDistanceMm: tableTiltGeometry.tableTiltCalibration.focusDistanceMm,
        }).construction,
      );
    }
  });

  it("validates swing-only and combined movement geometry", () => {
    const shelfOptics = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        ...shelfSwingScene.cameraPreset,
        activeSceneId: shelfSwingScene.id,
        frontSwingDeg: 6,
      },
      shelfSwingScene,
    );
    expectValidConstruction(
      deriveScheimpflugConstruction({
        filmPlane: shelfOptics.filmPlane,
        lensPlane: shelfOptics.lensPlane,
        focusPlane: shelfOptics.focusPlane,
      }),
    );
    expectValidConstruction(
      constructionFor({ frontTiltDeg: 6, frontSwingDeg: 5 }).construction,
    );
  });

  it("keeps line direction deterministic when equivalent plane normals are reversed", () => {
    const { optics, construction } = constructionFor({ frontTiltDeg: 6, frontSwingDeg: 4 });
    const reversed = deriveScheimpflugConstruction({
      filmPlane: planeFromPointNormal(optics.filmPlane.point, {
        x: -optics.filmPlane.normal.x,
        y: -optics.filmPlane.normal.y,
        z: -optics.filmPlane.normal.z,
      }),
      lensPlane: planeFromPointNormal(optics.lensPlane.point, {
        x: -optics.lensPlane.normal.x,
        y: -optics.lensPlane.normal.y,
        z: -optics.lensPlane.normal.z,
      }),
      focusPlane: optics.focusPlane,
    });
    expectValidConstruction(construction);
    expectValidConstruction(reversed);
    expect(reversed.commonLine!.direction).toEqual(construction.commonLine!.direction);
  });
});

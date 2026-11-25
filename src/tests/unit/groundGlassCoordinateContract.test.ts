import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../render/groundGlassFilmPlaneProjection";
import {
  FULL_GROUND_GLASS_INSPECTION_WINDOW,
  mapGroundGlassInspectionWindowToRttSourceCrop,
  resolveGroundGlassInspectionFilmWindowMm,
  resolveGroundGlassInspectionWindow,
} from "../../render/groundGlassInspectionWindow";
import { configureGroundGlassCamera } from "../../render/configureGroundGlassCamera";
import { resolveGroundGlassCoverageRenderState } from "../../render/groundGlassCoverage";
import {
  applyGroundGlassRttDisplayTransform,
  mapGroundGlassRttTextureUvToCanonicalFilmUv,
  resolveGroundGlassRttDisplayTransform,
} from "../../render/groundGlassRttOrientation";
import { mapPhysicalFilmUvToGroundGlassDisplayUv } from "../../render/groundGlassTargetProjection";
import { resolvePhysicalLensCoverageRenderGeometry } from "../../render/imageCircleGeometry";
import type { DerivedOpticsState, FilmPlaneCorners, Vec3 } from "../../types/optics";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const FILM_WIDTH_MM = 127;
const FILM_HEIGHT_MM = 101.6;
const WORLD_SCALE = 0.001;

type Uv = { u: number; v: number };
type ReferencePoint = {
  label: string;
  physical: Uv;
  raw: Uv;
  upright: Uv;
  cropTop: Uv;
  filmMm: { x: number; y: number };
};

const REFERENCE_POINTS: ReferencePoint[] = [
  { label: "off-center upper-left", physical: { u: 0.17, v: 0.28 }, raw: { u: 0.83, v: 0.28 }, upright: { u: 0.17, v: 0.72 }, cropTop: { u: 0.17, v: 0.72 }, filmMm: { x: -41.91, y: 22.352 } },
  { label: "off-center upper-right", physical: { u: 0.82, v: 0.21 }, raw: { u: 0.18, v: 0.21 }, upright: { u: 0.82, v: 0.79 }, cropTop: { u: 0.82, v: 0.79 }, filmMm: { x: 40.64, y: 29.464 } },
  { label: "off-center lower-left", physical: { u: 0.23, v: 0.79 }, raw: { u: 0.77, v: 0.79 }, upright: { u: 0.23, v: 0.21 }, cropTop: { u: 0.23, v: 0.21 }, filmMm: { x: -34.29, y: -29.464 } },
  { label: "off-center lower-right", physical: { u: 0.76, v: 0.84 }, raw: { u: 0.24, v: 0.84 }, upright: { u: 0.76, v: 0.16 }, cropTop: { u: 0.76, v: 0.16 }, filmMm: { x: 33.02, y: -34.544 } },
  { label: "noncentral interior", physical: { u: 0.37, v: 0.61 }, raw: { u: 0.63, v: 0.61 }, upright: { u: 0.37, v: 0.39 }, cropTop: { u: 0.37, v: 0.39 }, filmMm: { x: -16.51, y: -11.176 } },
];

const corners: FilmPlaneCorners = {
  topLeft: { x: -63.5, y: 50.8, z: -100 },
  topRight: { x: 63.5, y: 50.8, z: -100 },
  bottomLeft: { x: -63.5, y: -50.8, z: -100 },
  bottomRight: { x: 63.5, y: -50.8, z: -100 },
};
const lens: Vec3 = { x: 0, y: 0, z: 0 };

const filmPointAt = ({ u, v }: Uv): Vec3 => ({
  x: corners.topLeft.x + (corners.topRight.x - corners.topLeft.x) * u +
    (corners.bottomLeft.x - corners.topLeft.x) * v,
  y: corners.topLeft.y + (corners.topRight.y - corners.topLeft.y) * u +
    (corners.bottomLeft.y - corners.topLeft.y) * v,
  z: corners.topLeft.z,
});

const reflectFilmPoint = (point: Vec3): THREE.Vector3 =>
  new THREE.Vector3(2 * lens.x - point.x, 2 * lens.y - point.y, 2 * lens.z - point.z)
    .multiplyScalar(WORLD_SCALE);

const expectUv = (actual: Uv, expected: Uv, label: string) => {
  expect(actual.u, label + " u").toBeCloseTo(expected.u, 8);
  expect(actual.v, label + " v").toBeCloseTo(expected.v, 8);
};

describe("Ground Glass physical film / RTT coordinate contract", () => {
  it("matches fixed asymmetric film, sampler, display, and source-crop references", () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    const optics = { filmPlaneCornersWorld: corners, lensCenterWorld: lens } as unknown as DerivedOpticsState;
    const configured = configureGroundGlassCamera(camera, optics, 0.01, 1000);
    expect(configured.ok).toBe(true);
    if (!configured.ok) return;

    for (const point of REFERENCE_POINTS) {
      const filmPoint = filmPointAt(point.physical);
      const reflectedMm = {
        x: 2 * lens.x - filmPoint.x,
        y: 2 * lens.y - filmPoint.y,
        z: 2 * lens.z - filmPoint.z,
      };
      const projected = projectWorldPointToFilmPlaneGroundGlass({
        worldPoint: reflectedMm,
        lensCenterWorld: lens,
        filmPlaneCornersWorld: corners,
      });
      expect(projected.visible, point.label).toBe(true);
      expectUv({ u: projected.uRaw, v: projected.vRaw }, point.physical, point.label + " physical projection");

      const ndc = reflectFilmPoint(filmPoint).project(camera);
      const sourceUv = { u: (ndc.x + 1) / 2, v: (ndc.y + 1) / 2 };
      expectUv(sourceUv, point.physical, point.label + " configured RTT camera");
      expectUv(
        mapGroundGlassRttTextureUvToCanonicalFilmUv(sourceUv),
        point.physical,
        point.label + " sampler-to-film mapping",
      );

      const rawSample = applyGroundGlassRttDisplayTransform(
        sourceUv,
        resolveGroundGlassRttDisplayTransform("raw"),
      );
      const uprightSample = applyGroundGlassRttDisplayTransform(
        sourceUv,
        resolveGroundGlassRttDisplayTransform("upright"),
      );
      expectUv({ u: rawSample.u, v: 1 - rawSample.v }, point.raw, point.label + " Raw framebuffer");
      expectUv({ u: uprightSample.u, v: 1 - uprightSample.v }, point.upright, point.label + " Upright framebuffer");
      expectUv(mapPhysicalFilmUvToGroundGlassDisplayUv(point.physical, "raw"), point.raw, point.label + " Raw target");
      expectUv(mapPhysicalFilmUvToGroundGlassDisplayUv(point.physical, "upright"), point.upright, point.label + " Upright target");

      for (const mode of ["raw", "upright"] as const) {
        const shown = point[mode];
        const crop = mapGroundGlassInspectionWindowToRttSourceCrop({
          active: true,
          centerU: shown.u,
          centerV: shown.v,
          widthFraction: 0.25,
          heightFraction: 0.25,
        }, mode);
        expectUv({ u: crop.centerU, v: crop.centerV }, point.cropTop, point.label + " " + mode + " crop");
        const physicalCrop = resolveGroundGlassInspectionFilmWindowMm({
          filmWidthMm: FILM_WIDTH_MM,
          filmHeightMm: FILM_HEIGHT_MM,
          inspectionWindow: crop,
        });
        expect(physicalCrop.centerXMm, point.label + " crop X").toBeCloseTo(point.filmMm.x, 8);
        expect(physicalCrop.centerYMm, point.label + " crop Y").toBeCloseTo(point.filmMm.y, 8);
        expect(physicalCrop.widthMm).toBeCloseTo(31.75, 8);
        expect(physicalCrop.heightMm).toBeCloseTo(25.4, 8);
      }
    }
  });

  it("maps non-centered 4x pan to the expected crop side and clamps edge windows", () => {
    const displayed = resolveGroundGlassInspectionWindow({
      active: true,
      normalizedPan: { x: -0.6, y: 0.4 },
      magnification: 4,
    });
    expect(displayed.centerU).toBeCloseTo(0.725, 12);
    expect(displayed.centerV).toBeCloseTo(0.35, 12);
    expect(displayed.widthFraction).toBe(0.25);
    expect(displayed.heightFraction).toBe(0.25);

    const rawCrop = mapGroundGlassInspectionWindowToRttSourceCrop(displayed, "raw");
    expect(rawCrop.centerU).toBeCloseTo(0.275, 12);
    expect(rawCrop.centerV).toBeCloseTo(0.65, 12);
    const rawFilm = resolveGroundGlassInspectionFilmWindowMm({
      filmWidthMm: FILM_WIDTH_MM,
      filmHeightMm: FILM_HEIGHT_MM,
      inspectionWindow: rawCrop,
    });
    expect(rawFilm.centerXMm).toBeCloseTo(-28.575, 8);
    expect(rawFilm.centerYMm).toBeCloseTo(15.24, 8);
    expect(rawFilm.widthMm).toBeCloseTo(31.75, 8);
    expect(rawFilm.heightMm).toBeCloseTo(25.4, 8);

    const uprightCrop = mapGroundGlassInspectionWindowToRttSourceCrop(displayed, "upright");
    expect(uprightCrop.centerU).toBeCloseTo(0.725, 12);
    expect(uprightCrop.centerV).toBeCloseTo(0.35, 12);
    const uprightFilm = resolveGroundGlassInspectionFilmWindowMm({
      filmWidthMm: FILM_WIDTH_MM,
      filmHeightMm: FILM_HEIGHT_MM,
      inspectionWindow: uprightCrop,
    });
    expect(uprightFilm.centerXMm).toBeCloseTo(28.575, 8);
    expect(uprightFilm.centerYMm).toBeCloseTo(-15.24, 8);
    expect(uprightFilm.widthMm).toBeCloseTo(31.75, 8);
    expect(uprightFilm.heightMm).toBeCloseTo(25.4, 8);

    const edge = resolveGroundGlassInspectionWindow({
      active: true,
      normalizedPan: { x: -1, y: -1 },
      magnification: 4,
    });
    expect(edge.centerU).toBe(0.875);
    expect(edge.centerV).toBe(0.875);
    for (const mode of ["raw", "upright"] as const) {
      const crop = mapGroundGlassInspectionWindowToRttSourceCrop(edge, mode);
      expect(crop.centerU - crop.widthFraction / 2).toBeGreaterThanOrEqual(0);
      expect(crop.centerU + crop.widthFraction / 2).toBeLessThanOrEqual(1);
      expect(crop.centerV - crop.heightFraction / 2).toBeGreaterThanOrEqual(0);
      expect(crop.centerV + crop.heightFraction / 2).toBeLessThanOrEqual(1);
    }
    expect(
      resolveGroundGlassInspectionFilmWindowMm({
        filmWidthMm: FILM_WIDTH_MM,
        filmHeightMm: FILM_HEIGHT_MM,
        inspectionWindow: FULL_GROUND_GLASS_INSPECTION_WINDOW,
      }),
    ).toEqual({ centerXMm: 0, centerYMm: 0, widthMm: FILM_WIDTH_MM, heightMm: FILM_HEIGHT_MM });
  });

  it("keeps shifted Architecture Rise coverage on the canonical physical film side through display and crop", () => {
    const cameraState = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureRiseScene.cameraPreset,
      activeSceneId: architectureRiseScene.id,
      frontShiftMm: 60,
      focusDistanceMm: 9000,
    };
    const optics = deriveOpticsState(cameraState, architectureRiseScene);
    const coverage = optics.groundGlassCoverage;
    expect(coverage.kind).toBe("parallel-circle");
    if (coverage.kind !== "parallel-circle") return;

    const geometry = resolvePhysicalLensCoverageRenderGeometry({
      coverage,
      rearStandardFrame: optics.rearStandardFrame,
    });
    expect(geometry?.kind).toBe("parallel-circle");
    if (geometry?.kind !== "parallel-circle") return;
    expect(Math.abs(coverage.opticalAxisOffsetXMm)).toBeGreaterThan(1);

    const delta = {
      x: geometry.centerWorld.x - optics.filmCenterWorld.x,
      y: geometry.centerWorld.y - optics.filmCenterWorld.y,
      z: geometry.centerWorld.z - optics.filmCenterWorld.z,
    };
    const circleX = delta.x * optics.rearStandardFrame.rightWorld.x +
      delta.y * optics.rearStandardFrame.rightWorld.y +
      delta.z * optics.rearStandardFrame.rightWorld.z;
    const circleY = delta.x * optics.rearStandardFrame.upWorld.x +
      delta.y * optics.rearStandardFrame.upWorld.y +
      delta.z * optics.rearStandardFrame.upWorld.z;
    expect(circleX).toBeCloseTo(coverage.opticalAxisOffsetXMm, 8);
    expect(circleY).toBeCloseTo(coverage.opticalAxisOffsetYMm, 8);

    const filmUv = {
      u: 0.5 + circleX / FILM_WIDTH_MM,
      v: 0.5 - circleY / FILM_HEIGHT_MM,
    };
    for (const mode of ["raw", "upright"] as const) {
      const displayUv = mapPhysicalFilmUvToGroundGlassDisplayUv(filmUv, mode);
      const crop = mapGroundGlassInspectionWindowToRttSourceCrop({
        active: true,
        centerU: displayUv.u,
        centerV: displayUv.v,
        widthFraction: 0.25,
        heightFraction: 0.25,
      }, mode);
      const renderedCoverage = resolveGroundGlassCoverageRenderState({
        state: coverage,
        rawDebug: false,
        filmWidthMm: FILM_WIDTH_MM,
        filmHeightMm: FILM_HEIGHT_MM,
        inspectionWindow: crop,
        renderWidthPx: 800,
        renderHeightPx: 640,
      });
      expect(renderedCoverage.active).toBe(true);
      expect(renderedCoverage.geometry?.kind).toBe("parallel-circle");
      if (renderedCoverage.geometry?.kind !== "parallel-circle") continue;
      expect(renderedCoverage.geometry.opticalAxisOffsetXMm).toBeCloseTo(coverage.opticalAxisOffsetXMm, 10);
      expect(renderedCoverage.geometry.opticalAxisOffsetYMm).toBeCloseTo(coverage.opticalAxisOffsetYMm, 10);
      // The 60 mm shifted circle center is inside the full film but outside
      // the allowable center of a quarter-film crop, so the crop intentionally
      // clamps to the right physical edge instead of recentering the circle.
      expect(renderedCoverage.filmWindow.centerXMm).toBeCloseTo(47.625, 8);
      expect(renderedCoverage.filmWindow.centerYMm).toBeCloseTo(circleY, 8);
    }
  });
});

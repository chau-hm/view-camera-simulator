import { describe, expect, it } from "vitest";
import {
  CONCEPTUAL_LENS_APERTURE_MIN_RADIUS_MM,
  CONCEPTUAL_LENS_APERTURE_OUTER_RADIUS_MM,
  CONCEPTUAL_LENS_APERTURE_VISIBILITY_WINDOW_SEGMENT_COUNT,
  CONCEPTUAL_LENS_IRIS_EFFECTIVE_RADIUS_SAMPLE_COUNT,
  CONCEPTUAL_LENS_IRIS_BLADE_COUNT,
  resolveConceptualApertureBlades,
  resolveConceptualApertureBladePolygon,
  resolveConceptualApertureBladePolygons,
  resolveConceptualApertureEffectiveRadius,
  resolveConceptualApertureOpening,
  resolveConceptualApertureVisibleBladePolygons,
  resolveConceptualFilmHolderGeometry,
  resolveConceptualGroundGlassGeometry,
} from "../../render/conceptualCameraAnatomyGeometry";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

describe("conceptual rear-back anatomy geometry", () => {
  it("keeps the Ground Glass and Film Holder sensitive surfaces on the same local plane", () => {
    const groundGlass = resolveConceptualGroundGlassGeometry();
    const filmHolder = resolveConceptualFilmHolderGeometry();

    expect(filmHolder.surface).toEqual(groundGlass.surface);
    expect(groundGlass.surface.centerLocal).toEqual({ x: 0, y: 0, z: 0 });
    expect(groundGlass.surface.normalLocal).toEqual({ x: 0, y: 0, z: 1 });
    expect(filmHolder.holder.centerLocal.z).toBeLessThan(0);
    expect(filmHolder.holder.centerLocal.z + filmHolder.holder.depthMm / 2).toBeLessThan(0);
  });

  it("resolves deterministic film dimensions from the canonical film format", () => {
    const groundGlass = resolveConceptualGroundGlassGeometry();
    const filmHolder = resolveConceptualFilmHolderGeometry();

    expect(groundGlass.surface.widthMm).toBe(CAMERA_CONSTANTS.filmWidthMm);
    expect(groundGlass.surface.heightMm).toBe(CAMERA_CONSTANTS.filmHeightMm);
    expect(filmHolder.surface.widthMm).toBe(CAMERA_CONSTANTS.filmWidthMm);
    expect(filmHolder.surface.heightMm).toBe(CAMERA_CONSTANTS.filmHeightMm);
    expect(resolveConceptualGroundGlassGeometry()).toEqual(groundGlass);
    expect(resolveConceptualFilmHolderGeometry()).toEqual(filmHolder);
  });
});

describe("conceptual aperture opening geometry", () => {
  it("decreases monotonically as the canonical f-number increases", () => {
    const openings = CAMERA_CONSTANTS.apertureOptions.map((aperture) =>
      resolveConceptualApertureOpening({ aperture }).openingDiameterMm,
    );

    for (let index = 1; index < openings.length; index += 1) {
      expect(openings[index - 1]).toBeGreaterThan(openings[index]);
    }
  });

  it("keeps every supported aperture finite, positive, and inside the lens barrel", () => {
    for (const aperture of CAMERA_CONSTANTS.apertureOptions) {
      const opening = resolveConceptualApertureOpening({ aperture });
      expect(Number.isFinite(opening.openingRadiusMm)).toBe(true);
      expect(opening.openingRadiusMm).toBeGreaterThanOrEqual(
        CONCEPTUAL_LENS_APERTURE_MIN_RADIUS_MM,
      );
      expect(opening.openingRadiusMm).toBeLessThan(CONCEPTUAL_LENS_APERTURE_OUTER_RADIUS_MM);
      expect(opening.openingDiameterMm).toBe(opening.openingRadiusMm * 2);
    }
  });

  it("sanitizes invalid visual inputs without changing the optical model", () => {
    const opening = resolveConceptualApertureOpening({
      aperture: Number.NaN,
      focalLengthMm: Number.POSITIVE_INFINITY,
    });

    expect(Number.isFinite(opening.openingRadiusMm)).toBe(true);
    expect(opening.openingRadiusMm).toBeGreaterThan(0);
    expect(opening.openingRadiusMm).toBeLessThan(opening.outerRadiusMm);
    expect(opening.entrancePupilDiameterMm).toBe(
      CAMERA_CONSTANTS.focalLengthMm / DEFAULT_CAMERA_STATE.aperture,
    );
  });

  it("resolves overlapping straight-edged diaphragm blades for every supported aperture", () => {
    const wide = resolveConceptualApertureBlades({ aperture: 5.6 });
    const narrow = resolveConceptualApertureBlades({ aperture: 32 });

    expect(wide).toHaveLength(CONCEPTUAL_LENS_IRIS_BLADE_COUNT);
    expect(wide[0].pivot.x).not.toBe(0);
    expect(wide[0].pivot.y).toBe(0);
    expect(wide[0].points).toBe(wide[1].points);
    expect(wide[0].points).toEqual(narrow[0].points);
    expect(wide[0].rotationRad).toBeGreaterThan(narrow[0].rotationRad);
    expect(wide[1].rotationRad - narrow[1].rotationRad).toBeCloseTo(
      wide[0].rotationRad - narrow[0].rotationRad,
    );
    expect(wide.every((blade) => blade.points.length === 4)).toBe(true);
    expect(
      CAMERA_CONSTANTS.apertureOptions
        .flatMap((aperture) => resolveConceptualApertureBlades({ aperture }))
        .every((blade) =>
          Number.isFinite(blade.pivot.x) &&
          Number.isFinite(blade.pivot.y) &&
          Number.isFinite(blade.rotationRad) &&
          blade.points.every(
            (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
          ),
        ),
    ).toBe(true);
    expect(resolveConceptualApertureBlades({ aperture: 5.6 })).toEqual(wide);
  });

  it("calibrates the measured transformed opening to every supported aperture", () => {
    const apertures = CAMERA_CONSTANTS.apertureOptions;
    const measurements = apertures.map((aperture) => {
      const target = resolveConceptualApertureOpening({ aperture }).openingRadiusMm;
      const blades = resolveConceptualApertureBlades({ aperture });
      const actual = resolveConceptualApertureEffectiveRadius(
        blades,
        CONCEPTUAL_LENS_IRIS_EFFECTIVE_RADIUS_SAMPLE_COUNT,
      );

      return { aperture, target, actual };
    });
    for (const { target, actual } of measurements) {
      expect(Math.abs(actual - target) / target).toBeLessThanOrEqual(0.05);
    }
    for (let index = 1; index < measurements.length; index += 1) {
      expect(measurements[index - 1].actual).toBeGreaterThan(measurements[index].actual);
    }
    expect(measurements.at(-1)!.actual).toBeLessThan(measurements[0].actual * 0.3);

    const polygons = resolveConceptualApertureBladePolygons(
      resolveConceptualApertureBlades({ aperture: 11 }),
    );
    expect(polygons).toHaveLength(CONCEPTUAL_LENS_IRIS_BLADE_COUNT);
    expect(polygons[0]).not.toEqual(resolveConceptualApertureBlades({ aperture: 11 })[0].points);
    expect(polygons[0]).toEqual(
      resolveConceptualApertureBladePolygon(
        resolveConceptualApertureBlades({ aperture: 11 })[0],
      ),
    );
  });

  it("uses the supplied focal length when solving blade closure", () => {
    const focalLengthMm = 120;
    const measurements = CAMERA_CONSTANTS.apertureOptions.map((aperture) => {
      const target = resolveConceptualApertureOpening({ aperture, focalLengthMm }).openingRadiusMm;
      const actual = resolveConceptualApertureEffectiveRadius(
        resolveConceptualApertureBlades({ aperture, focalLengthMm }),
      );

      return { target, actual };
    });

    for (const { target, actual } of measurements) {
      expect(Math.abs(actual - target) / target).toBeLessThanOrEqual(0.05);
    }
  });

  it("clips only the rendered blade polygons to the fixed diaphragm window", () => {
    const apertures = CAMERA_CONSTANTS.apertureOptions;
    const wideBlades = resolveConceptualApertureBlades({ aperture: apertures[0] });
    const mechanicalPolygons = resolveConceptualApertureBladePolygons(wideBlades);
    const maximumMechanicalRadius = Math.max(
      ...mechanicalPolygons.flatMap((polygon) =>
        polygon.map((point) => Math.hypot(point.x, point.y)),
      ),
    );

    expect(CONCEPTUAL_LENS_APERTURE_VISIBILITY_WINDOW_SEGMENT_COUNT).toBe(64);
    expect(maximumMechanicalRadius).toBeGreaterThan(CONCEPTUAL_LENS_APERTURE_OUTER_RADIUS_MM);

    for (const aperture of apertures) {
      const blades = resolveConceptualApertureBlades({ aperture });
      const visiblePolygons = resolveConceptualApertureVisibleBladePolygons(blades);

      expect(visiblePolygons).toHaveLength(CONCEPTUAL_LENS_IRIS_BLADE_COUNT);
      expect(visiblePolygons.every((polygon) => polygon.length >= 3)).toBe(true);
      expect(
        visiblePolygons
          .flatMap((polygon) => polygon)
          .every(
            (point) =>
              Number.isFinite(point.x) &&
              Number.isFinite(point.y) &&
              Math.hypot(point.x, point.y) <= CONCEPTUAL_LENS_APERTURE_OUTER_RADIUS_MM + 1e-6,
          ),
      ).toBe(true);
      expect(visiblePolygons).toEqual(
        resolveConceptualApertureVisibleBladePolygons(
          resolveConceptualApertureBlades({ aperture }),
        ),
      );
    }

    expect(
      resolveConceptualApertureVisibleBladePolygons(wideBlades),
    ).not.toEqual(mechanicalPolygons);
  });
});

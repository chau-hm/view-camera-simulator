import { describe, expect, it } from "vitest";
import {
  CONCEPTUAL_LENS_APERTURE_MIN_RADIUS_MM,
  CONCEPTUAL_LENS_APERTURE_OUTER_RADIUS_MM,
  CONCEPTUAL_LENS_IRIS_BLADE_COUNT,
  resolveConceptualApertureBlades,
  resolveConceptualApertureOpening,
  resolveConceptualFilmHolderGeometry,
  resolveConceptualGroundGlassGeometry,
} from "../../render/conceptualCameraAnatomyGeometry";
import { CAMERA_CONSTANTS } from "../../utils/constants";

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
    const openings = [8, 16, 32].map((aperture) =>
      resolveConceptualApertureOpening({ aperture }).openingDiameterMm,
    );

    expect(openings[0]).toBeGreaterThan(openings[1]);
    expect(openings[1]).toBeGreaterThan(openings[2]);
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
      CAMERA_CONSTANTS.focalLengthMm / CAMERA_CONSTANTS.apertureOptions[1],
    );
  });

  it("resolves a deterministic set of visible iris blades around the canonical opening", () => {
    const wide = resolveConceptualApertureBlades({ aperture: 5.6 });
    const narrow = resolveConceptualApertureBlades({ aperture: 32 });

    expect(wide).toHaveLength(CONCEPTUAL_LENS_IRIS_BLADE_COUNT);
    expect(wide).toEqual(resolveConceptualApertureBlades({ aperture: 5.6 }));
    expect(wide[0].innerRadiusMm).toBeGreaterThan(narrow[0].innerRadiusMm);
    expect(wide.every((blade) => blade.outerRadiusMm > blade.innerRadiusMm)).toBe(true);
    expect(wide.every((blade) => Number.isFinite(blade.thetaStartRad))).toBe(true);
    expect(wide.every((blade) => Number.isFinite(blade.thetaLengthRad))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { planeFromPointNormal } from "../../core/math/plane";
import { vec } from "../../core/math/vec";
import { computePhysicalBlurFootprint } from "../../core/optics/computePhysicalBlurFootprint";
import type { Plane, Vec3 } from "../../types/optics";

const focalLengthMm = 150;
const apertureFNumber = 2.8;
const lensCenter = vec(0, 0, 0);
const lensNormal = vec(0, 0, 1);
const basisX = vec(1, 0, 0);
const basisY = vec(0, 1, 0);

// Two overlapping image contributions with distinct apparent object points.
const directPoint = vec(0, 0, 1000);
const secondaryPoint = vec(0, 0, 500);

const imageDistanceForObjectMm = (objectDistanceMm: number): number =>
  (focalLengthMm * objectDistanceMm) / (objectDistanceMm - focalLengthMm);

const filmAtObjectDistance = (objectDistanceMm: number): Plane =>
  planeFromPointNormal(
    vec(0, 0, -imageDistanceForObjectMm(objectDistanceMm)),
    lensNormal,
  );

const footprintAtFilm = (objectPoint: Vec3, filmPlane: Plane) =>
  computePhysicalBlurFootprint({
    objectPoint,
    lensCenter,
    lensPlaneNormal: lensNormal,
    lensPlaneBasisX: basisX,
    lensPlaneBasisY: basisY,
    filmPlane,
    filmPlaneBasisX: basisX,
    filmPlaneBasisY: basisY,
    focalLengthMm,
    apertureFNumber,
  });

describe("Ground Glass independent radiance focus CPU reference", () => {
  it("case A: keeps the direct point sharp while the secondary point is physically defocused", () => {
    const film = filmAtObjectDistance(1000);
    const direct = footprintAtFilm(directPoint, film);
    const secondary = footprintAtFilm(secondaryPoint, film);

    expect(direct.valid).toBe(true);
    expect(Math.abs(direct.signedCoCDiameterMm)).toBeLessThan(1e-7);
    expect(secondary.valid).toBe(true);
    expect(secondary.signedCoCDiameterMm).toBeLessThan(0);
    expect(secondary.signedCoCDiameterMm).toBeCloseTo(-9.4537815126, 6);
    expect(secondary.majorRadiusMm).toBeGreaterThan(4.5);
    expect(secondary.majorRadiusMm).toBeCloseTo(4.7268907563, 6);
    expect(secondary.majorRadiusMm).toBeGreaterThan(direct.majorRadiusMm + 4.5);
  });

  it("case B: swapping the film focus makes the secondary sharp and the direct point defocused", () => {
    const film = filmAtObjectDistance(500);
    const direct = footprintAtFilm(directPoint, film);
    const secondary = footprintAtFilm(secondaryPoint, film);

    expect(secondary.valid).toBe(true);
    expect(Math.abs(secondary.signedCoCDiameterMm)).toBeLessThan(1e-7);
    expect(direct.valid).toBe(true);
    expect(direct.signedCoCDiameterMm).toBeGreaterThan(0);
    expect(direct.signedCoCDiameterMm).toBeCloseTo(11.4795918367, 6);
    expect(direct.majorRadiusMm).toBeGreaterThan(4.5);
    expect(direct.majorRadiusMm).toBeCloseTo(5.7397959184, 6);
    expect(direct.majorRadiusMm).toBeGreaterThan(secondary.majorRadiusMm + 4.5);
  });

  it("case C: equal apparent focus semantics agree with a single-focus reference", () => {
    const film = filmAtObjectDistance(1000);
    const direct = footprintAtFilm(directPoint, film);
    const secondary = footprintAtFilm(vec(0, 0, 1000), film);
    const singleContributionReference = footprintAtFilm(vec(0, 0, 1000), film);

    for (const contribution of [direct, secondary]) {
      expect(contribution.valid).toBe(true);
      expect(contribution.signedCoCDiameterMm).toBeCloseTo(
        singleContributionReference.signedCoCDiameterMm,
        7,
      );
      expect(contribution.majorRadiusMm).toBeCloseTo(
        singleContributionReference.majorRadiusMm,
        7,
      );
      expect(contribution.minorRadiusMm).toBeCloseTo(
        singleContributionReference.minorRadiusMm,
        7,
      );
    }
  });
});

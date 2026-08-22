import { describe, expect, it } from "vitest";
import { planeFromPointNormal } from "../../core/math/plane";
import { rotateAroundX, rotateAroundY, vec } from "../../core/math/vec";
import {
  computePhysicalBlurFootprint,
  deriveOrthonormalPlaneBasis,
} from "../../core/optics/computePhysicalBlurFootprint";
import { computeSignedPhysicalCoCDiameterMm } from "../../core/optics/thinLensModel";
import type { Plane, Vec3 } from "../../types/optics";

const focalLengthMm = 150;
const apertureFNumber = 8;
const objectPoint = vec(30, 20, 1000);
const lensCenter = vec(0, 0, 0);
const lensNormal = vec(0, 0, 1);
const lensBasisX = vec(1, 0, 0);
const lensBasisY = vec(0, 1, 0);
const filmBasisX = vec(1, 0, 0);
const filmBasisY = vec(0, 1, 0);

const createFixture = (filmPlane: Plane, point = objectPoint, aperture = apertureFNumber) =>
  computePhysicalBlurFootprint({
    objectPoint: point,
    lensCenter,
    lensPlaneNormal: lensNormal,
    lensPlaneBasisX: lensBasisX,
    lensPlaneBasisY: lensBasisY,
    filmPlane,
    filmPlaneBasisX: filmBasisX,
    filmPlaneBasisY: filmBasisY,
    focalLengthMm,
    apertureFNumber: aperture,
  });

const parallelFilm = (filmDistanceMm: number): Plane =>
  planeFromPointNormal(vec(0, 0, -filmDistanceMm), vec(0, 0, 1));

const rotateGeometryAroundZ = (value: Vec3, angleDeg: number): Vec3 => {
  const radians = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return vec(value.x * cos - value.y * sin, value.x * sin + value.y * cos, value.z);
};

describe("physical arbitrary-plane blur footprint", () => {
  it("reduces to the signed physical CoC circle for parallel planes", () => {
    const filmDistanceMm = 160;
    const footprint = createFixture(parallelFilm(filmDistanceMm));
    const scalar = computeSignedPhysicalCoCDiameterMm({
      focalLengthMm,
      apertureFNumber,
      objectDistanceMm: 1000,
      filmDistanceMm,
    });

    expect(footprint.valid).toBe(true);
    expect(footprint.majorRadiusMm).toBeCloseTo(footprint.minorRadiusMm, 8);
    expect(2 * footprint.majorRadiusMm).toBeCloseTo(Math.abs(scalar), 8);
    expect(footprint.signedCoCDiameterMm).toBeCloseTo(scalar, 8);
  });

  it("collapses both axes at exact focus", () => {
    const objectDistanceMm = 1000;
    const imageDistanceMm = (focalLengthMm * objectDistanceMm) /
      (objectDistanceMm - focalLengthMm);
    const footprint = createFixture(parallelFilm(imageDistanceMm));

    expect(footprint.valid).toBe(true);
    expect(footprint.majorRadiusMm).toBeCloseTo(0, 8);
    expect(footprint.minorRadiusMm).toBeCloseTo(0, 8);
    expect(footprint.signedCoCDiameterMm).toBeCloseTo(0, 8);
  });

  it("keeps the optical near/far sign while preserving scalar magnitude", () => {
    const filmDistanceMm = (focalLengthMm * 1000) / (1000 - focalLengthMm);
    const nearObjectDistanceMm = 800;
    const farObjectDistanceMm = 1500;
    const nearFootprint = createFixture(
      parallelFilm(filmDistanceMm),
      vec(0, 0, nearObjectDistanceMm),
    );
    const farFootprint = createFixture(
      parallelFilm(filmDistanceMm),
      vec(0, 0, farObjectDistanceMm),
    );

    expect(nearFootprint.signedCoCDiameterMm).toBeLessThan(0);
    expect(farFootprint.signedCoCDiameterMm).toBeGreaterThan(0);
    expect(Math.abs(nearFootprint.signedCoCDiameterMm)).toBeCloseTo(
      Math.abs(computeSignedPhysicalCoCDiameterMm({
        focalLengthMm,
        apertureFNumber,
        objectDistanceMm: nearObjectDistanceMm,
        filmDistanceMm,
      })),
      8,
    );
    expect(Math.abs(farFootprint.signedCoCDiameterMm)).toBeCloseTo(
      Math.abs(computeSignedPhysicalCoCDiameterMm({
        focalLengthMm,
        apertureFNumber,
        objectDistanceMm: farObjectDistanceMm,
        filmDistanceMm,
      })),
      8,
    );
  });

  it("derives anisotropy from a film tilt rather than a screen-space stretch", () => {
    const tiltDeg = 25;
    const tiltedNormal = rotateAroundX(lensNormal, tiltDeg);
    const tiltedUp = rotateAroundX(filmBasisY, tiltDeg);
    const tiltedPlane = planeFromPointNormal(vec(0, 0, -160), tiltedNormal);
    const tiltedBasis = deriveOrthonormalPlaneBasis(tiltedNormal, filmBasisX, tiltedUp);
    if (!tiltedBasis) throw new Error("tilted film basis should resolve");

    const footprint = computePhysicalBlurFootprint({
      objectPoint: vec(30, 20, 1000),
      lensCenter,
      lensPlaneNormal: lensNormal,
      lensPlaneBasisX: lensBasisX,
      lensPlaneBasisY: lensBasisY,
      filmPlane: tiltedPlane,
      filmPlaneBasisX: tiltedBasis.x,
      filmPlaneBasisY: tiltedBasis.y,
      focalLengthMm,
      apertureFNumber,
    });

    expect(footprint.valid).toBe(true);
    expect(footprint.majorRadiusMm).toBeGreaterThan(footprint.minorRadiusMm);
    expect(Number.isFinite(footprint.orientationRad)).toBe(true);
  });

  it("rotates the anisotropic footprint coherently around the orthogonal axis", () => {
    const tiltDeg = 25;
    const tiltedNormal = rotateAroundY(lensNormal, tiltDeg);
    const tiltedRight = rotateAroundY(filmBasisX, tiltDeg);
    const tiltedPlane = planeFromPointNormal(vec(0, 0, -160), tiltedNormal);
    const tiltedBasis = deriveOrthonormalPlaneBasis(tiltedNormal, tiltedRight, filmBasisY);
    if (!tiltedBasis) throw new Error("tilted film basis should resolve");

    const footprint = computePhysicalBlurFootprint({
      objectPoint: vec(30, 20, 1000),
      lensCenter,
      lensPlaneNormal: lensNormal,
      lensPlaneBasisX: lensBasisX,
      lensPlaneBasisY: lensBasisY,
      filmPlane: tiltedPlane,
      filmPlaneBasisX: tiltedBasis.x,
      filmPlaneBasisY: tiltedBasis.y,
      focalLengthMm,
      apertureFNumber,
    });

    expect(footprint.valid).toBe(true);
    expect(footprint.majorRadiusMm).toBeGreaterThan(footprint.minorRadiusMm);
    expect(footprint.orientationRad).toBeGreaterThanOrEqual(0);
    expect(footprint.orientationRad).toBeLessThan(Math.PI);
  });

  it("preserves singular radii under an equivalent rigid coordinate rotation", () => {
    const original = createFixture(parallelFilm(160));
    const angleDeg = 37;
    const rotatedObject = rotateGeometryAroundZ(objectPoint, angleDeg);
    const rotatedLens = rotateGeometryAroundZ(lensCenter, angleDeg);
    const rotatedPlane = planeFromPointNormal(
      rotateGeometryAroundZ(vec(0, 0, -160), angleDeg),
      rotateGeometryAroundZ(lensNormal, angleDeg),
    );
    const rotatedFootprint = computePhysicalBlurFootprint({
      objectPoint: rotatedObject,
      lensCenter: rotatedLens,
      lensPlaneNormal: rotateGeometryAroundZ(lensNormal, angleDeg),
      lensPlaneBasisX: rotateGeometryAroundZ(lensBasisX, angleDeg),
      lensPlaneBasisY: rotateGeometryAroundZ(lensBasisY, angleDeg),
      filmPlane: rotatedPlane,
      filmPlaneBasisX: rotateGeometryAroundZ(filmBasisX, angleDeg),
      filmPlaneBasisY: rotateGeometryAroundZ(filmBasisY, angleDeg),
      focalLengthMm,
      apertureFNumber,
    });

    expect(rotatedFootprint.majorRadiusMm).toBeCloseTo(original.majorRadiusMm, 8);
    expect(rotatedFootprint.minorRadiusMm).toBeCloseTo(original.minorRadiusMm, 8);
  });

  it("scales both footprint axes with aperture diameter", () => {
    const f8 = createFixture(parallelFilm(160), objectPoint, 8);
    const f16 = createFixture(parallelFilm(160), objectPoint, 16);

    expect(f8.majorRadiusMm / f16.majorRadiusMm).toBeCloseTo(2, 8);
    expect(f8.minorRadiusMm / f16.minorRadiusMm).toBeCloseTo(2, 8);
  });

  it("fails closed for unresolved geometry without non-finite output", () => {
    const footprint = computePhysicalBlurFootprint({
      objectPoint,
      lensCenter,
      lensPlaneNormal: vec(0, 0, 0),
      lensPlaneBasisX: lensBasisX,
      lensPlaneBasisY: lensBasisY,
      filmPlane: parallelFilm(160),
      filmPlaneBasisX: filmBasisX,
      filmPlaneBasisY: filmBasisY,
      focalLengthMm,
      apertureFNumber,
    });

    expect(footprint.valid).toBe(false);
    expect(footprint).toEqual({
      valid: false,
      signedCoCDiameterMm: 0,
      majorRadiusMm: 0,
      minorRadiusMm: 0,
      orientationRad: 0,
    });
  });
});

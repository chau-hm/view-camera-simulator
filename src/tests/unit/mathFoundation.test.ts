import { describe, expect, it } from "vitest";
import {
  add,
  angleDeg,
  cross,
  distance,
  dot,
  epsilonGuard,
  isFiniteVec3,
  normalize,
  rotateAroundX,
  rotateAroundY,
  safeNormalize,
  scale,
  subtract,
  vec,
} from "../../core/math/vec";
import {
  arePlanesNearlyParallel,
  intersectPlanes,
  planeFromPointNormal,
  pointToPlaneDistance,
  pointToPlaneSignedDistance,
} from "../../core/math/plane";
import { intersectRayPlane } from "../../core/math/ray";

describe("phase 3 math foundation", () => {
  it("implements vec add/subtract/scale", () => {
    expect(add(vec(1, 2, 3), vec(4, 5, 6))).toEqual(vec(5, 7, 9));
    expect(subtract(vec(5, 7, 9), vec(4, 5, 6))).toEqual(vec(1, 2, 3));
    expect(scale(vec(1, -2, 3), 2)).toEqual(vec(2, -4, 6));
  });

  it("implements vec dot/cross", () => {
    expect(dot(vec(1, 2, 3), vec(4, 5, 6))).toBe(32);
    expect(cross(vec(1, 0, 0), vec(0, 1, 0))).toEqual(vec(0, 0, 1));
  });

  it("implements normalize and safe normalize", () => {
    expect(normalize(vec(0, 3, 4))).toEqual(vec(0, 0.6, 0.8));
    expect(safeNormalize(vec(0, 0, 0))).toEqual(vec(0, 0, 1));
    expect(safeNormalize(vec(Number.NaN, 0, 0), vec(1, 0, 0))).toEqual(vec(1, 0, 0));
  });

  it("implements vec distance and angle", () => {
    expect(distance(vec(0, 0, 0), vec(3, 4, 0))).toBe(5);
    expect(angleDeg(vec(0, 0, 1), vec(0, 1, 0))).toBeCloseTo(90, 8);
  });

  it("implements x/y rotation helpers", () => {
    expect(rotateAroundX(vec(0, 1, 0), 90).z).toBeCloseTo(1, 8);
    expect(rotateAroundY(vec(0, 0, 1), 90).x).toBeCloseTo(1, 8);
  });

  it("builds normalized planes", () => {
    const plane = planeFromPointNormal(vec(0, 0, 10), vec(0, 0, 2));
    expect(plane.normal).toEqual(vec(0, 0, 1));
    expect(plane.distance).toBe(10);
  });

  it("computes point-to-plane distances", () => {
    const plane = planeFromPointNormal(vec(0, 0, 10), vec(0, 0, 1));
    expect(pointToPlaneSignedDistance(vec(0, 0, 12), plane)).toBe(2);
    expect(pointToPlaneSignedDistance(vec(0, 0, 8), plane)).toBe(-2);
    expect(pointToPlaneDistance(vec(0, 0, 8), plane)).toBe(2);
  });

  it("computes ray-plane intersection with null for parallel rays", () => {
    const plane = planeFromPointNormal(vec(0, 0, 10), vec(0, 0, 1));
    const hit = intersectRayPlane(
      {
        origin: vec(0, 0, 0),
        direction: vec(0, 0, 1),
      },
      plane,
    );
    expect(hit).not.toBeNull();
    expect(hit?.distance).toBe(10);
    expect(hit?.point).toEqual(vec(0, 0, 10));

    const miss = intersectRayPlane(
      {
        origin: vec(0, 0, 0),
        direction: vec(1, 0, 0),
      },
      plane,
    );
    expect(miss).toBeNull();
  });

  it("computes plane-plane intersection lines", () => {
    const horizontal = planeFromPointNormal(vec(0, 0, 0), vec(0, 1, 0));
    const vertical = planeFromPointNormal(vec(0, 0, 0), vec(1, 0, 0));
    const intersection = intersectPlanes(horizontal, vertical);
    expect(intersection).not.toBeNull();
    expect(intersection?.direction).toEqual(vec(0, 0, -1));
    expect(intersection?.point.x).toBeCloseTo(0, 8);
    expect(intersection?.point.y).toBeCloseTo(0, 8);
  });

  it("checks nearly parallel planes by threshold", () => {
    const a = planeFromPointNormal(vec(0, 0, 0), vec(0, 0, 1));
    const b = planeFromPointNormal(vec(0, 0, 1), vec(0, 0.001, 1));
    expect(arePlanesNearlyParallel(a, b, 1)).toBe(true);
    expect(arePlanesNearlyParallel(a, b, 0.0001)).toBe(false);
  });

  it("provides numeric safety helpers", () => {
    expect(isFiniteVec3(vec(1, 2, 3))).toBe(true);
    expect(isFiniteVec3(vec(Number.POSITIVE_INFINITY, 2, 3))).toBe(false);
    expect(epsilonGuard(1e-12, 1e-9)).toBe(0);
    expect(epsilonGuard(1e-3, 1e-9)).toBe(1e-3);
  });
});

import type { Plane, Ray, Vec3 } from "../../types/optics";
import { planeFromPointNormal } from "../math/plane";
import { add, scale } from "../math/vec";

const APERTURE_TOLERANCE_MM: Record<number, number> = {
  5.6: 800,
  11: 1600,
  22: 3200,
  32: 4800,
};

export const mapApertureToToleranceMm = (aperture: number): number => APERTURE_TOLERANCE_MM[aperture] ?? 16;

// Thin-lens hyperfocal DOF calculation
// Inputs:
// - focalLengthMm: f
// - apertureFNumber: N
// - circleOfConfusionMm: c
// - lensCenterWorld: Vec3
// - opticalAxis: Ray (origin, direction normalized)
// - focusObjectDistanceMm: U (object distance measured from lens centre)
// Returns planes located at lensCenter + direction * nearU / farU

export const calculateDepthOfField = (
  {
    focalLengthMm,
    apertureFNumber,
    circleOfConfusionMm,
    lensCenterWorld,
    opticalAxis,
    focusObjectDistanceMm,
    // optional visual cap in mm when far is infinite
    visualCapMm = 10000,
  }:
    {
      focalLengthMm: number;
      apertureFNumber: number;
      circleOfConfusionMm: number;
      lensCenterWorld: Vec3;
      opticalAxis: Ray;
      focusObjectDistanceMm: number;
      visualCapMm?: number;
    },
): { depthOfFieldNearPlane: Plane; depthOfFieldFarPlane: Plane; farIsInfinite: boolean; nearU: number; farU: number } => {
  const f = focalLengthMm;
  const N = apertureFNumber;
  const c = circleOfConfusionMm;
  const U = focusObjectDistanceMm;

  // hyperfocal
  const H = (f * f) / (N * c) + f;

  const nearU = (H * U) / (H + (U - f));

  const denom = H - (U - f);
  let farU: number;
  let farIsInfinite = false;
  if (denom <= 1e-9) {
    farIsInfinite = true;
    farU = Infinity;
  } else {
    farU = (H * U) / denom;
  }

  // Ensure nearU is positive and in front of lens
  const dir = opticalAxis.direction;

  const nearPoint = add(lensCenterWorld, scale(dir, nearU));
  const farPoint = farIsInfinite ? add(lensCenterWorld, scale(dir, visualCapMm)) : add(lensCenterWorld, scale(dir, farU));

  return {
    depthOfFieldNearPlane: planeFromPointNormal(nearPoint, dir),
    depthOfFieldFarPlane: planeFromPointNormal(farPoint, dir),
    farIsInfinite,
    nearU,
    farU,
  };
};

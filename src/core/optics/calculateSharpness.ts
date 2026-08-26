import type { FocusTargetSharpness } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import { pointToPlaneDistance } from "../math/plane";
import type { Plane, Vec3 } from "../../types/optics";
import { clamp } from "../math/clamps";

import { computePhysicalBlurFootprint } from "./computePhysicalBlurFootprint";
import {
  calculatePhysicalSharpnessFromEquivalentCoCDiameterMm,
  focusTargetStatusForSharpness,
} from "./physicalSharpness";
import type { Ray } from "../../types/optics";
import { safeNormalize, subtract, dot } from "../math/vec";
import { sampleDofWedge } from "./dofWedge";

export type PhysicalFocusGeometry = {
  lensCenterWorld: Vec3;
  lensPlaneNormal: Vec3;
  lensPlaneBasisX: Vec3;
  lensPlaneBasisY: Vec3;
  filmPlane: Plane;
  filmPlaneBasisX: Vec3;
  filmPlaneBasisY: Vec3;
  focalLengthMm: number;
  apertureFNumber: number;
};

type PhysicalSampleEvaluation = {
  equivalentCoCDiameterMm: number | null;
  sharpness: number;
  status: FocusTargetSharpness["status"];
};

const evaluatePhysicalPosition = (
  worldPosition: Vec3,
  geometry: PhysicalFocusGeometry,
): PhysicalSampleEvaluation => {
  const footprint = computePhysicalBlurFootprint({
    objectPoint: worldPosition,
    lensCenter: geometry.lensCenterWorld,
    lensPlaneNormal: geometry.lensPlaneNormal,
    lensPlaneBasisX: geometry.lensPlaneBasisX,
    lensPlaneBasisY: geometry.lensPlaneBasisY,
    filmPlane: geometry.filmPlane,
    filmPlaneBasisX: geometry.filmPlaneBasisX,
    filmPlaneBasisY: geometry.filmPlaneBasisY,
    focalLengthMm: geometry.focalLengthMm,
    apertureFNumber: geometry.apertureFNumber,
  });
  const equivalentCoCDiameterMm = footprint.valid
    ? Math.abs(footprint.signedCoCDiameterMm)
    : null;
  const sharpness = calculatePhysicalSharpnessFromEquivalentCoCDiameterMm(
    equivalentCoCDiameterMm,
  );
  return {
    equivalentCoCDiameterMm,
    sharpness,
    status: focusTargetStatusForSharpness(sharpness),
  };
};

export const calculateSharpness = (
  scene: SceneDefinition,
  focusPlane: Plane | null,
  _aperture: number,
  lensCenterWorld: Vec3,
  nearPlane: Plane | null,
  farPlane: Plane | null,
  physicalGeometry?: PhysicalFocusGeometry,
): FocusTargetSharpness[] => {
  return scene.focusTargets.map((target) => {
    const positions = target.sampleWorldPositions?.length
      ? target.sampleWorldPositions
      : [target.worldPosition];
    const evaluatePosition = (worldPosition: Vec3) => {
      const direction = safeNormalize(subtract(worldPosition, lensCenterWorld), {
        x: 0,
        y: 0,
        z: 1,
      });
      const ray = { origin: lensCenterWorld, direction } as Ray;
      const targetDistanceMm = Math.max(
        0,
        dot(subtract(worldPosition, lensCenterWorld), direction),
      );
      const wedge = sampleDofWedge({
        ray,
        targetDistanceMm,
        nearPlane,
        focusPlane,
        farPlane,
      });
      return {
        worldPosition,
        wedge,
        sharpness: clamp(1 - wedge.normalizedDefocus, 0, 1),
      };
    };
    const evaluatedSamples = positions.map(evaluatePosition);
    const worst = evaluatedSamples.reduce((currentWorst, candidate) =>
      candidate.sharpness < currentWorst.sharpness ? candidate : currentWorst,
    );
    const point = evaluatePosition(target.worldPosition);
    const pointSharpness = point.sharpness;
    const patchSharpness = worst.sharpness;

    const physicalSamples = physicalGeometry
      ? positions.map((position) => evaluatePhysicalPosition(position, physicalGeometry))
      : [];
    const physicalWorst = physicalSamples.length > 0
      ? physicalSamples.reduce((currentWorst, candidate) =>
          currentWorst.equivalentCoCDiameterMm === null
            ? currentWorst
            : candidate.equivalentCoCDiameterMm === null ||
                candidate.equivalentCoCDiameterMm > currentWorst.equivalentCoCDiameterMm
              ? candidate
              : currentWorst,
        )
      : undefined;
    const physicalPoint = physicalGeometry
      ? evaluatePhysicalPosition(target.worldPosition, physicalGeometry)
      : undefined;

    return {
      id: target.id,
      distanceToFocusPlaneMm: focusPlane
        ? Math.max(...positions.map((position) => pointToPlaneDistance(position, focusPlane)))
        : 0,
      // Preserve the established task/evaluator contract: `sharpness` remains
      // conservative whole-patch coverage when a target has multiple samples.
      sharpness: patchSharpness,
      status: focusTargetStatusForSharpness(patchSharpness),
      pointSharpness,
      pointStatus: focusTargetStatusForSharpness(pointSharpness),
      patchSharpness,
      patchStatus: focusTargetStatusForSharpness(patchSharpness),
      ...(physicalPoint && physicalWorst
        ? {
            physicalPointSharpness: physicalPoint.sharpness,
            physicalPointStatus: physicalPoint.status,
            physicalPatchSharpness: physicalWorst.sharpness,
            physicalPatchStatus: physicalWorst.status,
            pointEquivalentCoCDiameterMm: physicalPoint.equivalentCoCDiameterMm,
            patchEquivalentCoCDiameterMm: physicalWorst.equivalentCoCDiameterMm,
          }
        : {}),
      pointNormalizedDefocus: point.wedge.normalizedDefocus,
      patchNormalizedDefocus: worst.wedge.normalizedDefocus,
      insideDepthOfField: evaluatedSamples.every((sample) => sample.wedge.insideDepthOfField),
      targetRayDistanceMm: worst.wedge.targetDistanceMm,
      nearBoundaryDistanceMm: worst.wedge.nearDistanceMm,
      focusBoundaryDistanceMm: worst.wedge.focusDistanceMm,
      farBoundaryDistanceMm: worst.wedge.farDistanceMm,
      normalizedDefocus: worst.wedge.normalizedDefocus,
    };
  });
};

import type { CameraState } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import { calculateDepthOfField } from "./calculateDepthOfField";
import { calculateFocusPlaneWithFallback, calculateFocusPoint } from "./calculateFocusPlane";
import { calculateGroundGlassProjection } from "./calculateGroundGlassProjection";
import { solveLensExtensionForRearDatumFocusDepth, imageDistanceMm } from "./thinLensModel";
import { planeFromPointNormal } from "../math/plane";
import {
  calculateLensFilmHingeLine,
  calculateLensPlane,
  createFilmPlane,
  createOpticalAxis,
  isLensFilmNearlyParallel,
} from "./calculateLensPlane";
import {
  calculateFilmPlaneCorners,
  calculateOffAxisProjectionMatrix,
  createOffAxisProjectionInput,
} from "./calculateOffAxisProjection";
import { calculateSharpness } from "./calculateSharpness";
import { isFiniteVec3, vec, subtract, dot, add, scale } from "../math/vec";

const isFiniteCameraInput = (cameraState: CameraState): boolean =>
  [
    cameraState.focalLengthMm,
    cameraState.focusDistanceMm,
    cameraState.frontRiseMm,
    cameraState.frontTiltDeg,
    cameraState.frontSwingDeg,
  ].every((value) => Number.isFinite(value));

const baseFallbackState = (cameraState: CameraState, errorMessage: string): DerivedOpticsState => {
  const lensCenterWorld = vec(0, cameraState.frontRiseMm, 0);
  const lensNormalWorld = vec(0, 0, 1);
  const { filmCenterWorld, filmNormalWorld, filmPlane } = createFilmPlane(
    cameraState.focalLengthMm,
  );
  const filmPlaneCornersWorld = calculateFilmPlaneCorners(filmPlane);
  const opticalAxis = createOpticalAxis(lensCenterWorld, lensNormalWorld);
  const focusPointWorld = vec(0, 0, cameraState.focusDistanceMm);
  const focusPlane = {
    point: focusPointWorld,
    normal: filmNormalWorld,
    distance: focusPointWorld.z,
  };
  const offAxisProjectionInput = createOffAxisProjectionInput(
    lensCenterWorld,
    filmPlaneCornersWorld,
  );

  return {
    lensCenterWorld,
    lensNormalWorld,
    lensPlane: { point: lensCenterWorld, normal: lensNormalWorld, distance: lensCenterWorld.z },
    filmCenterWorld,
    filmNormalWorld,
    filmPlane,
    filmPlaneCornersWorld,
    opticalAxis,
    lensFilmHingeLine: null,
    focusPointWorld,
    focusPlane,
    depthOfFieldNearPlane: {
      point: { x: 0, y: 0, z: cameraState.focusDistanceMm - 16 },
      normal: filmNormalWorld,
      distance: cameraState.focusDistanceMm - 16,
    },
    depthOfFieldFarPlane: {
      point: { x: 0, y: 0, z: cameraState.focusDistanceMm + 16 },
      normal: filmNormalWorld,
      distance: cameraState.focusDistanceMm + 16,
    },
    offAxisProjectionInput,
    offAxisProjectionMatrix: calculateOffAxisProjectionMatrix(offAxisProjectionInput),
    groundGlassProjection: calculateGroundGlassProjection(cameraState.groundGlassAssistEnabled),
    focusTargets: [],
    diagnostics: {
      isParallelLensFilm: true,
      tiltAngleDeg: cameraState.frontTiltDeg,
      swingAngleDeg: cameraState.frontSwingDeg,
      focusPlaneModel: "parallel",
      fallbackApplied: true,
      errorMessage,
    },
  };
};

export const deriveOpticsState = (
  cameraState: CameraState,
  scene: SceneDefinition,
): DerivedOpticsState => {
  // Special handling for Infinity focus mode: branch early and produce a stable state
  if (cameraState.focusMode === "infinity") {
    if (!Number.isFinite(cameraState.focalLengthMm) || cameraState.focalLengthMm <= 0) {
      return baseFallbackState(cameraState, "Invalid focal length for infinity focus");
    }
    const f = cameraState.focalLengthMm;
    const lensCenterWorld = vec(0, 0, f);
    const lensNormalWorld = vec(0, 0, 1);
    const filmCenterWorld = vec(0, 0, 0);
    const filmNormalWorld = vec(0, 0, 1);
    const filmPlane = planeFromPointNormal(filmCenterWorld, filmNormalWorld);
    const lensPlane = planeFromPointNormal(lensCenterWorld, lensNormalWorld);
    const filmPlaneCornersWorld = calculateFilmPlaneCorners(filmPlane);
    const opticalAxis = createOpticalAxis(lensCenterWorld, lensNormalWorld);

    // For Infinity focus we do NOT provide a physical focus plane or a finite far DOF plane.
    // Provide an optional visual cap for debugging/display only (not used as physical focusPlane)
    const visualCapMm = 12000;

    // Use imageDistance = f and simulate very large object distance to compute near DOF limit
    const dofResult = calculateDepthOfField({
      focalLengthMm: f,
      apertureFNumber: cameraState.aperture,
      circleOfConfusionMm: 0.1,
      lensCenterWorld,
      opticalAxis,
      focusObjectDistanceMm: 1e9,
      visualCapMm,
    });

    const offAxisProjectionInput = createOffAxisProjectionInput(
      lensCenterWorld,
      filmPlaneCornersWorld,
    );

    return {
      lensCenterWorld,
      lensNormalWorld,
      lensPlane,
      filmCenterWorld,
      filmNormalWorld,
      filmPlane,
      filmPlaneCornersWorld,
      opticalAxis,
      lensFilmHingeLine: null,
      // physical focus plane is absent in infinity mode
      focusPointWorld: add(lensCenterWorld, scale(opticalAxis.direction, visualCapMm)),
      focusPlane: null,
      // near plane may be finite — keep it as physical near DOF if the solver produced one inside scene bounds
      depthOfFieldNearPlane: dofResult.depthOfFieldNearPlane,
      // far plane is infinite in infinity focus — do not provide a finite far plane
      depthOfFieldFarPlane: null,
      offAxisProjectionInput,
      offAxisProjectionMatrix: calculateOffAxisProjectionMatrix(offAxisProjectionInput),
      groundGlassProjection: calculateGroundGlassProjection(cameraState.groundGlassAssistEnabled),
      focusTargets: [],
      // expose a scene visual cap depth for renderers that need a non-physical render endpoint
      sceneVisualCapDepthMm: visualCapMm,
      diagnostics: {
        isParallelLensFilm: true,
        tiltAngleDeg: cameraState.frontTiltDeg,
        swingAngleDeg: cameraState.frontSwingDeg,
        focusPlaneModel: "parallel",
        fallbackApplied: false,
        errorMessage: "Infinity focus",
        isInfinityFocus: true,
      },
    };
  }

  if (!isFiniteCameraInput(cameraState)) {
    return baseFallbackState(cameraState, "Invalid camera input");
  }
  if (cameraState.focusDistanceMm <= 0) {
    return baseFallbackState(cameraState, "Invalid focus distance");
  }
  if (cameraState.focalLengthMm <= 0) {
    return baseFallbackState(cameraState, "Invalid focal length");
  }

  const _lensResult = calculateLensPlane(cameraState);
  let lensCenterWorld = _lensResult.lensCenterWorld;
  const lensNormalWorld = _lensResult.lensNormalWorld;
  let lensPlane = _lensResult.lensPlane;
  if (!isFiniteVec3(lensCenterWorld) || !isFiniteVec3(lensNormalWorld)) {
    return baseFallbackState(cameraState, "Invalid lens geometry");
  }

  let { filmCenterWorld, filmNormalWorld, filmPlane } = createFilmPlane(cameraState.focalLengthMm);

  // For Architecture Rise use rear-standard focusing: interpret focusDistanceMm as lens-to-subject distance U
  // and place film at image distance v from the lens (filmCenterWorld.z = -v)
  if (scene.id === "architecture-rise") {
    const U = cameraState.focusDistanceMm; // lens-to-subject distance in mm (object side)
    const f = cameraState.focalLengthMm;
    const v = Number.isFinite(U) && U > f ? imageDistanceMm(f, U) : cameraState.focalLengthMm;
    filmCenterWorld = vec(0, 0, -v);
    filmNormalWorld = vec(0, 0, 1);
    filmPlane = planeFromPointNormal(filmCenterWorld, filmNormalWorld);
  }

  // Prepare to store solved extension for Focus Fundamentals so we don't call solver twice
  let solvedLensExtensionV: number | null = null;
  let solvedObjectDistanceU: number | null = null;

  // For the Focus Fundamentals scene (front-standard focusing):
  // - rear datum / film datum remain at z = 0
  // - lens (front standard) moves to +imageDistanceMm from the rear datum
  // All values remain in mm until conversion at render boundary.
  if (scene.id === "focus-fundamentals-two-targets") {
    // Interpret cameraState.focusDistanceMm as S: focus plane depth from rear datum
    const S = cameraState.focusDistanceMm;
    const f = cameraState.focalLengthMm;
    // solve lens extension v and lens-to-subject distance U
    const { v, U } = solveLensExtensionForRearDatumFocusDepth(S, f);
    solvedLensExtensionV = v;
    solvedObjectDistanceU = U;

    // keep film datum at rear datum (z = 0)
    filmCenterWorld = vec(0, 0, 0);
    filmNormalWorld = vec(0, 0, 1);
    filmPlane = planeFromPointNormal(filmCenterWorld, filmNormalWorld);

    // Move lens center to +v from the rear datum (front standard moves)
    // For this strict baseline, ignore any lateral/front rise: lens x/y are zero
    lensCenterWorld = vec(0, 0, solvedLensExtensionV);
    // recompute lensPlane with updated lens center
    lensPlane = planeFromPointNormal(lensCenterWorld, lensNormalWorld);

    // focus plane world point is at z = S
  }

  const filmPlaneCornersWorld = calculateFilmPlaneCorners(filmPlane);
  const opticalAxis = createOpticalAxis(lensCenterWorld, lensNormalWorld);

  // Determine focus point / plane
  let focusPointWorld = calculateFocusPoint(cameraState, opticalAxis);
  // For Focus Fundamentals scene, cameraState.focusDistanceMm represents S (focus plane depth from rear datum)
  if (scene.id === "focus-fundamentals-two-targets") {
    focusPointWorld = vec(0, 0, cameraState.focusDistanceMm);
  }

  const isParallelLensFilm = isLensFilmNearlyParallel(lensPlane, filmPlane);
  const lensFilmHingeLine = isParallelLensFilm
    ? null
    : calculateLensFilmHingeLine(lensPlane, filmPlane);
  const { focusPlane, focusPlaneModel } = calculateFocusPlaneWithFallback(
    focusPointWorld,
    filmPlane,
    lensFilmHingeLine,
    isParallelLensFilm || !lensFilmHingeLine,
  );

  // For Focus Fundamentals, compute DOF via thin-lens formula using solved lens extension and object distance U
  let depthOfFieldNearPlane;
  let depthOfFieldFarPlane;
  let dofResultGlobal: any = null;
  if (scene.id === "focus-fundamentals-two-targets") {
    const S = cameraState.focusDistanceMm;
    const f = cameraState.focalLengthMm;
    // use previously solved U (should be available)
    const U = solvedObjectDistanceU ?? solveLensExtensionForRearDatumFocusDepth(S, f).U;
    dofResultGlobal = calculateDepthOfField({
      focalLengthMm: f,
      apertureFNumber: cameraState.aperture,
      circleOfConfusionMm: 0.1,
      lensCenterWorld: lensCenterWorld,
      opticalAxis,
      focusObjectDistanceMm: U,
      visualCapMm: 12000,
      filmPlane,
      lensPlane,
      hingeLine: lensFilmHingeLine,
      filmCenterWorld,
    });
    depthOfFieldNearPlane = dofResultGlobal.depthOfFieldNearPlane;
    depthOfFieldFarPlane = dofResultGlobal.depthOfFieldFarPlane;
  } else if (scene.id === "architecture-rise") {
    // For Architecture, interpret cameraState.focusDistanceMm as lens-to-subject object distance U
    const U = cameraState.focusDistanceMm;
    dofResultGlobal = calculateDepthOfField({
      focalLengthMm: cameraState.focalLengthMm,
      apertureFNumber: cameraState.aperture,
      circleOfConfusionMm: 0.1,
      lensCenterWorld,
      opticalAxis,
      focusObjectDistanceMm: U,
      visualCapMm: 12000,
      filmPlane,
      lensPlane,
      hingeLine: lensFilmHingeLine,
      filmCenterWorld,
    });
    depthOfFieldNearPlane = dofResultGlobal.depthOfFieldNearPlane;
    depthOfFieldFarPlane = dofResultGlobal.depthOfFieldFarPlane;
  } else {
    // Compute object distance U from lens center to focus plane along optical axis
    const lensToFocus = subtract(focusPlane.point, lensCenterWorld);
    const U = dot(lensToFocus, opticalAxis.direction);
    dofResultGlobal = calculateDepthOfField({
      focalLengthMm: cameraState.focalLengthMm,
      apertureFNumber: cameraState.aperture,
      circleOfConfusionMm: 0.1,
      lensCenterWorld,
      opticalAxis,
      focusObjectDistanceMm: U,
      visualCapMm: 12000,
      filmPlane,
      lensPlane,
      hingeLine: lensFilmHingeLine,
      filmCenterWorld,
    });
    depthOfFieldNearPlane = dofResultGlobal.depthOfFieldNearPlane;
    depthOfFieldFarPlane = dofResultGlobal.depthOfFieldFarPlane;
  }
  const offAxisProjectionInput = createOffAxisProjectionInput(
    lensCenterWorld,
    filmPlaneCornersWorld,
  );
  const offAxisProjectionMatrix = calculateOffAxisProjectionMatrix(offAxisProjectionInput);

  return {
    lensCenterWorld,
    lensNormalWorld,
    lensPlane,
    filmCenterWorld,
    filmNormalWorld,
    filmPlane,
    filmPlaneCornersWorld,
    opticalAxis,
    lensFilmHingeLine,
    focusPointWorld,
    focusPlane,
    depthOfFieldNearPlane,
    depthOfFieldFarPlane,
    offAxisProjectionInput,
    offAxisProjectionMatrix,
    groundGlassProjection: calculateGroundGlassProjection(cameraState.groundGlassAssistEnabled),
    focusTargets: calculateSharpness(scene, focusPlane ?? null, cameraState.aperture, lensCenterWorld, depthOfFieldNearPlane ?? null, depthOfFieldFarPlane ?? null),
    diagnostics: {
      isParallelLensFilm,
      tiltAngleDeg: cameraState.frontTiltDeg,
      swingAngleDeg: cameraState.frontSwingDeg,
      focusPlaneModel,
      depthOfFieldModel: dofResultGlobal?.depthOfFieldModel ?? "parallel",
      nearU: dofResultGlobal?.nearU ?? null,
      farU: dofResultGlobal?.farU ?? null,
      farIsInfinite: dofResultGlobal?.farIsInfinite ?? false,
      fallbackApplied: false,
      isInfinityFocus: false,
    },
  };
};

import type { CameraState } from "../../types/camera";
import type {
  CameraBodyLocalGeometry,
  CameraBodyTransform,
  CameraRigPlacement,
  CameraRigTransform,
  DerivedOpticsState,
  FilmPlaneCorners,
  Plane,
  StandardFrame,
  Vec3,
} from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import { calculateDepthOfField } from "./calculateDepthOfField";
import { calculateFocusPlaneWithFallback, calculateFocusPoint } from "./calculateFocusPlane";
import { calculateGroundGlassProjection } from "./calculateGroundGlassProjection";
import {
  resolveFocusFundamentalsFocusing,
  type FocusFundamentalsFocusingResult,
} from "./focusFundamentalsFocusing";
import {
  CAMERA_CONSTANTS,
  DEFAULT_CAMERA_RIG_PLACEMENT,
} from "../../utils/constants";
import { planeFromPointNormal } from "../math/plane";
import {
  calculateLensNormal,
  calculateLensPlane,
  createOpticalAxis,
  deriveLensFilmRelationship,
} from "./calculateLensPlane";
import {
  calculateOffAxisProjectionMatrix,
  createOffAxisProjectionInput,
} from "./calculateOffAxisProjection";
import { calculateRearStandardFrame } from "./calculateRearStandardFrame";
import { calculateSharpness } from "./calculateSharpness";
import { ACCEPTABLE_COC_DIAMETER_MM } from "./physicalSharpness";
import { isFiniteVec3, vec, subtract, dot, add, scale } from "../math/vec";
import { calculateFiniteFocusFilmPlane } from "./calculateFiniteFocusFilmPlane";
import { applyCameraRigTransform } from "./applyCameraBodyPitch";
import {
  CAMERA_MOVEMENT_SCENE_CALIBRATION,
  type CameraMovementSceneCalibration,
} from "../../scenes/cameraMovementSceneCalibration";
import {
  isCanonicalCameraRigViewpointPlacement,
  resolveCameraRigViewpointPlacementAtT,
  resolveCameraRigViewpointAnchor,
} from "../../scenes/cameraRigViewpointGeometry";
import { resolveCameraMovementLessonState } from "../../scenes/cameraMovementLessonState";
import { resolveMirrorShiftRigPlacement } from "../../scenes/mirrorShiftLessonState";

const neutralCameraRigTransform = (): CameraRigTransform => ({
  rigOriginWorld: vec(0, 0, 0),
  basePitchDeg: 0,
  bodyPitchDeg: 0,
  bodyPitchPivotRigLocal: vec(0, 0, 0),
});

const resolveCameraRigPlacement = (
  cameraState: CameraState,
  scene: SceneDefinition,
  cameraMovementCalibration: CameraMovementSceneCalibration,
): CameraRigPlacement => {
  if (scene.cameraRigTranslationCapability?.enabled) {
    const rigLateralMm = cameraState.mirrorShiftLessonState?.rigLateralMm ?? 0;
    return resolveMirrorShiftRigPlacement(
      Number.isFinite(rigLateralMm) ? rigLateralMm : 0,
    );
  }
  if (!scene.cameraBodyPitchCapability?.enabled) {
    return DEFAULT_CAMERA_RIG_PLACEMENT;
  }
  const calibration = cameraMovementCalibration.cameraRig;
  if (
    scene.id === "understanding-camera-movements" &&
    cameraState.cameraMovementLessonState
  ) {
    const lessonState = cameraState.cameraMovementLessonState;
    const viewpointT = lessonState.study === "viewpoint" ? lessonState.viewpointT : 0;
    return resolveCameraRigViewpointPlacementAtT(calibration, viewpointT);
  }
  return isCanonicalCameraRigViewpointPlacement(
    cameraState.cameraRigPlacement,
    calibration,
    cameraState.viewpointAnchor,
  )
    ? resolveCameraRigViewpointAnchor(calibration, cameraState.viewpointAnchor)
    : resolveCameraRigViewpointAnchor(calibration, calibration.defaultAnchor);
};

const hasCanonicalCameraRigPlacement = (
  cameraState: CameraState,
  scene: SceneDefinition,
  cameraMovementCalibration: CameraMovementSceneCalibration,
): boolean => {
  if (scene.cameraRigTranslationCapability?.enabled) {
    return Number.isFinite(
      cameraState.mirrorShiftLessonState?.rigLateralMm ?? 0,
    );
  }
  if (!scene.cameraBodyPitchCapability?.enabled) return true;
  return (
    (scene.id === "understanding-camera-movements" &&
      Boolean(cameraState.cameraMovementLessonState)) ||
    isCanonicalCameraRigViewpointPlacement(
      cameraState.cameraRigPlacement,
      cameraMovementCalibration.cameraRig,
      cameraState.viewpointAnchor,
    )
  );
};

const hasFiniteCameraRigInput = (
  cameraState: CameraState,
  scene: SceneDefinition,
  cameraMovementCalibration: CameraMovementSceneCalibration,
): boolean => {
  if (
    scene.cameraRigTranslationCapability?.enabled &&
    !Number.isFinite(cameraState.mirrorShiftLessonState?.rigLateralMm ?? 0)
  ) {
    return false;
  }
  if (!scene.cameraBodyPitchCapability?.enabled) return true;
  return (
    hasCanonicalCameraRigPlacement(cameraState, scene, cameraMovementCalibration) &&
    Number.isFinite(cameraState.cameraBodyPitchDeg) &&
    Boolean(cameraState.cameraBodyPivotWorld) &&
    isFiniteVec3(cameraState.cameraBodyPivotWorld)
  );
};

const resolveCameraRigTransform = (
  cameraState: CameraState,
  scene: SceneDefinition,
  placement: CameraRigPlacement,
): CameraRigTransform => {
  const bodyPitchEnabled = scene.cameraBodyPitchCapability?.enabled === true;
  const translationEnabled = scene.cameraRigTranslationCapability?.enabled === true;
  if (!bodyPitchEnabled && !translationEnabled) {
    return neutralCameraRigTransform();
  }
  const presetPitch = scene.cameraPreset.cameraBodyPitchDeg;
  const presetPivot = scene.cameraPreset.cameraBodyPivotWorld;
  return {
    rigOriginWorld: placement.rigOriginWorld,
    basePitchDeg: placement.basePitchDeg,
    bodyPitchDeg: bodyPitchEnabled && Number.isFinite(cameraState.cameraBodyPitchDeg)
      ? cameraState.cameraBodyPitchDeg
      : bodyPitchEnabled && Number.isFinite(presetPitch)
        ? (presetPitch as number)
        : 0,
    // cameraBodyPivotWorld is a legacy state boundary. Its calibrated value
    // has always been rig-local because the pre-3C-B rig origin was zero.
    bodyPitchPivotRigLocal: bodyPitchEnabled &&
      cameraState.cameraBodyPivotWorld && isFiniteVec3(cameraState.cameraBodyPivotWorld)
        ? cameraState.cameraBodyPivotWorld
        : bodyPitchEnabled && presetPivot && isFiniteVec3(presetPivot)
          ? presetPivot
          : vec(0, 0, 0),
  };
};

/** Materialize the canonical continuous lesson state for legacy optics inputs. */
const resolveCanonicalCameraState = (
  cameraState: CameraState,
  scene: SceneDefinition,
  cameraMovementCalibration: CameraMovementSceneCalibration,
): CameraState => {
  if (
    scene.id !== "understanding-camera-movements" ||
    !cameraState.cameraMovementLessonState
  ) {
    return cameraState;
  }
  const derived = resolveCameraMovementLessonState(
    cameraState.cameraMovementLessonState,
    cameraMovementCalibration.cameraRig,
  );
  return {
    ...cameraState,
    frontShiftMm: 0,
    cameraMovementLessonState: derived.lessonState,
    frontRiseMm: derived.frontRiseMm,
    frontTiltDeg: derived.frontTiltDeg,
    frontSwingDeg: derived.frontSwingDeg,
    rearRiseMm: derived.rearRiseMm,
    rearShiftMm: 0,
    rearTiltDeg: derived.rearTiltDeg,
    rearSwingDeg: 0,
    cameraBodyPitchDeg: derived.cameraBodyPitchDeg,
    viewpointAnchor: derived.viewpointAnchor,
    cameraRigPlacement: derived.cameraRigPlacement,
  };
};

const toLegacyCameraBodyTransform = (
  transform: CameraRigTransform,
): CameraBodyTransform => ({
  pitchDeg: transform.bodyPitchDeg,
  pivotWorld: transform.bodyPitchPivotRigLocal,
});

const createCameraBodyLocalGeometry = ({
  lensCenterLocal,
  lensNormalLocal,
  lensPlaneLocal,
  rearStandardFrameLocal,
  filmPlaneCornersLocal,
}: {
  lensCenterLocal: Vec3;
  lensNormalLocal: Vec3;
  lensPlaneLocal: Plane;
  rearStandardFrameLocal: StandardFrame;
  filmPlaneCornersLocal: FilmPlaneCorners;
}): CameraBodyLocalGeometry => ({
  lensCenterLocal,
  lensNormalLocal,
  lensPlaneLocal,
  filmCenterLocal: rearStandardFrameLocal.centerWorld,
  filmNormalLocal: rearStandardFrameLocal.normalWorld,
  filmPlaneLocal: rearStandardFrameLocal.plane,
  filmPlaneCornersLocal,
  rearStandardFrameLocal,
});

const isFiniteCameraInput = (
  cameraState: CameraState,
  scene: SceneDefinition,
  cameraMovementCalibration: CameraMovementSceneCalibration,
): boolean => {
  const standardInputsFinite = [
    cameraState.focalLengthMm,
    cameraState.focusDistanceMm,
    cameraState.frontRiseMm,
    cameraState.frontShiftMm ?? 0,
    cameraState.frontTiltDeg,
    cameraState.frontSwingDeg,
    cameraState.rearRiseMm,
    cameraState.rearShiftMm,
    cameraState.rearTiltDeg,
    cameraState.rearSwingDeg,
  ].every((value) => Number.isFinite(value));
  if (!standardInputsFinite) return false;
  return hasFiniteCameraRigInput(cameraState, scene, cameraMovementCalibration);
};

const baseFallbackState = (
  cameraState: CameraState,
  scene: SceneDefinition,
  errorMessage: string,
  cameraMovementCalibration: CameraMovementSceneCalibration,
): DerivedOpticsState => {
  // Sanitize every input before constructing any geometry.
  const safeFocalLength =
    Number.isFinite(cameraState.focalLengthMm) && cameraState.focalLengthMm > 0
      ? cameraState.focalLengthMm
      : CAMERA_CONSTANTS.focalLengthMm;
  const safeFocusDistance =
    Number.isFinite(cameraState.focusDistanceMm) && cameraState.focusDistanceMm > 0
      ? cameraState.focusDistanceMm
      : CAMERA_CONSTANTS.defaultFocusDistanceMm;
  const safeFrontRise = Number.isFinite(cameraState.frontRiseMm) ? cameraState.frontRiseMm : 0;
  const safeFrontShift = Number.isFinite(cameraState.frontShiftMm) ? cameraState.frontShiftMm : 0;
  const safeFrontTilt = Number.isFinite(cameraState.frontTiltDeg) ? cameraState.frontTiltDeg : 0;
  const safeFrontSwing = Number.isFinite(cameraState.frontSwingDeg) ? cameraState.frontSwingDeg : 0;
  const safeRearRise = Number.isFinite(cameraState.rearRiseMm) ? cameraState.rearRiseMm : 0;
  const safeRearShift = Number.isFinite(cameraState.rearShiftMm) ? cameraState.rearShiftMm : 0;
  const safeRearTilt = Number.isFinite(cameraState.rearTiltDeg) ? cameraState.rearTiltDeg : 0;
  const safeRearSwing = Number.isFinite(cameraState.rearSwingDeg) ? cameraState.rearSwingDeg : 0;

  // Use canonical helpers for lens and film geometry
  const lensCenterLocal = vec(safeFrontShift, safeFrontRise, 0);
  const lensNormalLocal = calculateLensNormal(safeFrontTilt, safeFrontSwing);
  const lensPlaneLocal = planeFromPointNormal(lensCenterLocal, lensNormalLocal);
  const { filmCenterWorld: baselineFilmCenter } = calculateFiniteFocusFilmPlane({
    focalLengthMm: safeFocalLength,
    focusDistanceMm: safeFocusDistance,
    strategy: scene.finiteFocusStrategy,
    lensNormalLocal,
  });
  const { frame: rearStandardFrameLocal, corners: filmPlaneCornersLocal } =
    calculateRearStandardFrame(
      baselineFilmCenter,
      safeRearRise,
      safeRearTilt,
      CAMERA_CONSTANTS.filmWidthMm,
      CAMERA_CONSTANTS.filmHeightMm,
      safeRearShift,
      safeRearSwing,
    );
  const cameraBodyLocalGeometry = createCameraBodyLocalGeometry({
    lensCenterLocal,
    lensNormalLocal,
    lensPlaneLocal,
    rearStandardFrameLocal,
    filmPlaneCornersLocal,
  });
  const cameraRigPlacement = resolveCameraRigPlacement(
    cameraState,
    scene,
    cameraMovementCalibration,
  );
  const cameraRigTransform = resolveCameraRigTransform(
    cameraState,
    scene,
    cameraRigPlacement,
  );
  const cameraBodyTransform = toLegacyCameraBodyTransform(cameraRigTransform);
  const {
    cameraBodyPivotWorld,
    lensCenterWorld,
    lensNormalWorld,
    lensPlane,
    filmCenterWorld,
    filmNormalWorld,
    filmPlane,
    filmPlaneCornersWorld,
    rearStandardFrame: rearFrame,
  } = applyCameraRigTransform(cameraBodyLocalGeometry, cameraRigTransform);

  // Derive the physical lens/film relationship from the constructed planes
  const lensFilmRel = deriveLensFilmRelationship(lensPlane, filmPlane, scene.id === "table-tilt");

  const opticalAxis = createOpticalAxis(lensCenterWorld, lensNormalWorld);
  const focusPointWorld =
    scene.cameraBodyPitchCapability?.enabled ||
    scene.cameraRigTranslationCapability?.enabled
      ? add(lensCenterWorld, scale(opticalAxis.direction, safeFocusDistance))
      : vec(0, 0, safeFocusDistance);
  const { focusPlane } = calculateFocusPlaneWithFallback(
    focusPointWorld,
    filmPlane,
    lensFilmRel.commonLine,
    lensFilmRel.isParallel || !lensFilmRel.commonLine,
  );
  const offAxisProjectionInput = createOffAxisProjectionInput(
    lensCenterWorld,
    filmPlaneCornersWorld,
  );

  // Conservative synthetic DOF planes derived from the fallback focus plane.
  // Use the canonical plane constructor so Plane.distance is correct for
  // tilted normals rather than manually set to point.z.
  const dofNormal = focusPlane ? focusPlane.normal : filmNormalWorld;
  const dofRefPoint = focusPlane ? focusPlane.point : focusPointWorld;
  const nearPoint = add(dofRefPoint, scale(dofNormal, -16));
  const farPoint = add(dofRefPoint, scale(dofNormal, 16));
  const nearPlane = planeFromPointNormal(nearPoint, dofNormal);
  const farPlane = planeFromPointNormal(farPoint, dofNormal);

  return {
    cameraRigPlacement,
    cameraRigTransform,
    cameraBodyTransform,
    cameraBodyLocalGeometry,
    cameraBodyPivotWorld,
    lensCenterWorld,
    lensNormalWorld,
    lensPlane,
    filmCenterWorld,
    filmNormalWorld,
    filmPlane,
    filmPlaneCornersWorld,
    rearStandardFrame: rearFrame,
    opticalAxis,
    lensFilmHingeLine: lensFilmRel.commonLine,
    focusPointWorld,
    focusPlane,
    depthOfFieldNearPlane: nearPlane,
    depthOfFieldFarPlane: farPlane,
    offAxisProjectionInput,
    offAxisProjectionMatrix: calculateOffAxisProjectionMatrix(offAxisProjectionInput),
    groundGlassProjection: calculateGroundGlassProjection(cameraState.groundGlassAssistEnabled),
    focusTargets: [],
    diagnostics: {
      isParallelLensFilm: lensFilmRel.isParallel,
      tiltAngleDeg: safeFrontTilt,
      swingAngleDeg: safeFrontSwing,
      focusPlaneModel: lensFilmRel.isParallel ? "parallel" : "scheimpflug",
      groundGlassDofModel: "parallel-thin-lens",
      fallbackApplied: true,
      fallbackReason: errorMessage,
      errorMessage,
      focusStandard:
        scene.id === "focus-fundamentals-two-targets" ? "front" : cameraState.focusStandard,
      requestedFocusStandard: cameraState.focusStandard,
    },
  };
};

export const deriveOpticsState = (
  inputCameraState: CameraState,
  scene: SceneDefinition,
  cameraMovementCalibration: CameraMovementSceneCalibration =
    CAMERA_MOVEMENT_SCENE_CALIBRATION,
): DerivedOpticsState => {
  const cameraState = resolveCanonicalCameraState(
    inputCameraState,
    scene,
    cameraMovementCalibration,
  );
  const selectableFocusScene = scene.focusStandardCapability?.enabled === true;
  // Special handling for Infinity focus mode: branch early and produce a stable state
  if (cameraState.focusMode === "infinity") {
    if (!Number.isFinite(cameraState.focalLengthMm) || cameraState.focalLengthMm <= 0) {
      return baseFallbackState(
        cameraState,
        scene,
        "Invalid focal length for infinity focus",
        cameraMovementCalibration,
      );
    }
    // Validate every input consumed by infinity geometry construction,
    // passed to solvers, or returned through diagnostics consumed by renderers.
    const infinityInputsValid =
      Number.isFinite(cameraState.frontRiseMm) &&
      Number.isFinite(cameraState.frontShiftMm ?? 0) &&
      Number.isFinite(cameraState.frontTiltDeg) &&
      Number.isFinite(cameraState.frontSwingDeg) &&
      Number.isFinite(cameraState.rearRiseMm) &&
      Number.isFinite(cameraState.rearShiftMm) &&
      Number.isFinite(cameraState.rearTiltDeg) &&
      Number.isFinite(cameraState.rearSwingDeg) &&
      hasFiniteCameraRigInput(cameraState, scene, cameraMovementCalibration) &&
      CAMERA_CONSTANTS.apertureOptions.includes(
        cameraState.aperture as (typeof CAMERA_CONSTANTS.apertureOptions)[number],
      );
    if (!infinityInputsValid) {
      return baseFallbackState(
        cameraState,
        scene,
        "Invalid input values for infinity focus",
        cameraMovementCalibration,
      );
    }
    const f = cameraState.focalLengthMm;
    const focusFundamentalsFocusing =
      selectableFocusScene
        ? resolveFocusFundamentalsFocusing({
            standard:
              scene.focusStandardCapability?.enabled && cameraState.focusStandard === "rear"
                ? "rear"
                : "front",
            focusMode: "infinity",
            focusDepthMm: cameraState.focusDistanceMm,
            focalLengthMm: f,
            referenceFocusDepthMm:
              scene.focusStandardCapability?.referenceFocusDepthMm ??
              CAMERA_CONSTANTS.defaultFocusDistanceMm,
          })
        : null;
    const lensCenterLocal = vec(
      Number.isFinite(cameraState.frontShiftMm) ? cameraState.frontShiftMm : 0,
      cameraState.frontRiseMm,
      focusFundamentalsFocusing?.lensZMm ?? f,
    );
    const lensNormalLocal = calculateLensNormal(
      cameraState.frontTiltDeg,
      cameraState.frontSwingDeg,
    );
    const lensPlaneLocal = planeFromPointNormal(lensCenterLocal, lensNormalLocal);
    const baselineFilmCenter = vec(
      0,
      0,
      focusFundamentalsFocusing?.filmZMm ?? 0,
    );
    const { frame: rearStandardFrameLocal, corners: filmPlaneCornersLocal } =
      calculateRearStandardFrame(
        baselineFilmCenter,
        cameraState.rearRiseMm,
        cameraState.rearTiltDeg,
        CAMERA_CONSTANTS.filmWidthMm,
        CAMERA_CONSTANTS.filmHeightMm,
        cameraState.rearShiftMm,
        cameraState.rearSwingDeg,
      );
    const cameraBodyLocalGeometry = createCameraBodyLocalGeometry({
      lensCenterLocal,
      lensNormalLocal,
      lensPlaneLocal,
      rearStandardFrameLocal,
      filmPlaneCornersLocal,
    });
    const cameraRigPlacement = resolveCameraRigPlacement(
      cameraState,
      scene,
      cameraMovementCalibration,
    );
    const cameraRigTransform = resolveCameraRigTransform(
      cameraState,
      scene,
      cameraRigPlacement,
    );
    const cameraBodyTransform = toLegacyCameraBodyTransform(cameraRigTransform);
    const {
      cameraBodyPivotWorld,
      lensCenterWorld,
      lensNormalWorld,
      lensPlane,
      filmCenterWorld,
      filmNormalWorld,
      filmPlane,
      filmPlaneCornersWorld,
      rearStandardFrame: rearFrame,
    } = applyCameraRigTransform(cameraBodyLocalGeometry, cameraRigTransform);
    const opticalAxis = createOpticalAxis(lensCenterWorld, lensNormalWorld);

    // For Infinity focus we do NOT provide a physical focus plane or a finite far DOF plane.
    // Provide an optional visual cap for debugging/display only (not used as physical focusPlane)
    const visualCapMm = 12000;

    // Use imageDistance = f and simulate very large object distance to compute near DOF limit
    const dofResult = calculateDepthOfField({
      focalLengthMm: f,
      apertureFNumber: cameraState.aperture,
      circleOfConfusionMm: ACCEPTABLE_COC_DIAMETER_MM,
      lensCenterWorld,
      opticalAxis,
      focusObjectDistanceMm: 1e9,
      visualCapMm,
    });

    // Derive the actual physical lens/film relationship from the constructed
    // planes.  Rear tilt can make the planes non-parallel in infinity mode.
    const infinityLensFilmRel = deriveLensFilmRelationship(
      lensPlane,
      filmPlane,
      scene.id === "table-tilt",
    );

    const offAxisProjectionInput = createOffAxisProjectionInput(
      lensCenterWorld,
      filmPlaneCornersWorld,
    );

    return {
      cameraRigPlacement,
      cameraRigTransform,
      cameraBodyTransform,
      cameraBodyLocalGeometry,
      cameraBodyPivotWorld,
      lensCenterWorld,
      lensNormalWorld,
      lensPlane,
      filmCenterWorld,
      filmNormalWorld,
      filmPlane,
      filmPlaneCornersWorld,
      rearStandardFrame: rearFrame,
      opticalAxis,
      lensFilmHingeLine: infinityLensFilmRel.commonLine,
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
        isParallelLensFilm: infinityLensFilmRel.isParallel,
        tiltAngleDeg: cameraState.frontTiltDeg,
        swingAngleDeg: cameraState.frontSwingDeg,
        focusPlaneModel: infinityLensFilmRel.isParallel ? "parallel" : "scheimpflug",
        groundGlassDofModel: "parallel-thin-lens",
        fallbackApplied: focusFundamentalsFocusing?.fallbackApplied ?? false,
        fallbackReason: focusFundamentalsFocusing?.fallbackReason ?? null,
        errorMessage: focusFundamentalsFocusing?.fallbackReason ?? "Infinity focus",
        isInfinityFocus: true,
        focusStandard: focusFundamentalsFocusing?.standard ?? cameraState.focusStandard,
        requestedFocusStandard: cameraState.focusStandard,
        focusObjectDistanceMm: focusFundamentalsFocusing?.objectDistanceUMm ?? null,
        imageDistanceMm: focusFundamentalsFocusing?.imageDistanceVMm ?? f,
      },
    };
  }

  if (!isFiniteCameraInput(cameraState, scene, cameraMovementCalibration)) {
    return baseFallbackState(
      cameraState,
      scene,
      "Invalid camera input",
      cameraMovementCalibration,
    );
  }
  if (cameraState.focusDistanceMm <= 0) {
    return baseFallbackState(
      cameraState,
      scene,
      "Invalid focus distance",
      cameraMovementCalibration,
    );
  }
  if (cameraState.focalLengthMm <= 0) {
    return baseFallbackState(
      cameraState,
      scene,
      "Invalid focal length",
      cameraMovementCalibration,
    );
  }

  const _lensResult = calculateLensPlane(cameraState);
  let lensCenterLocal = _lensResult.lensCenterWorld;
  const lensNormalLocal = _lensResult.lensNormalWorld;
  let lensPlaneLocal = _lensResult.lensPlane;
  if (!isFiniteVec3(lensCenterLocal) || !isFiniteVec3(lensNormalLocal)) {
    return baseFallbackState(
      cameraState,
      scene,
      "Invalid lens geometry",
      cameraMovementCalibration,
    );
  }

  const baselineFilm = calculateFiniteFocusFilmPlane({
    focalLengthMm: cameraState.focalLengthMm,
    focusDistanceMm: cameraState.focusDistanceMm,
    strategy: scene.finiteFocusStrategy,
    lensNormalLocal,
  });
  if (baselineFilm.fallbackApplied && scene.finiteFocusStrategy) {
    return baseFallbackState(
      cameraState,
      scene,
      "Invalid finite-focus image distance",
      cameraMovementCalibration,
    );
  }
  let { filmCenterWorld: filmCenterLocal } = baselineFilm;

  // Prepare to store the canonical Focus Fundamentals lens/film/U/v solution so
  // every downstream geometry consumer uses exactly one resolved construction.
  let focusFundamentalsFocusing: FocusFundamentalsFocusingResult | null = null;
  let focusFundamentalsFocusDepthMm: number | null = null;

  // For selectable-focus scenes, the canonical front/rear resolver owns
  // lens and film placement in the rear-datum coordinate system.
  // All values remain in mm until conversion at render boundary.
  if (selectableFocusScene) {
    focusFundamentalsFocusing = resolveFocusFundamentalsFocusing({
      standard:
        scene.focusStandardCapability?.enabled && cameraState.focusStandard === "rear"
          ? "rear"
          : "front",
      focusMode: "finite",
      focusDepthMm: cameraState.focusDistanceMm,
      focalLengthMm: cameraState.focalLengthMm,
      referenceFocusDepthMm:
        scene.focusStandardCapability?.referenceFocusDepthMm ??
        CAMERA_CONSTANTS.defaultFocusDistanceMm,
    });
    if (focusFundamentalsFocusing.fallbackApplied) {
      return baseFallbackState(
        cameraState,
        scene,
        focusFundamentalsFocusing.fallbackReason ??
          "Invalid Focus Fundamentals focus geometry",
        cameraMovementCalibration,
      );
    }
    focusFundamentalsFocusDepthMm = focusFundamentalsFocusing.focusDepthMm;
    filmCenterLocal = vec(0, 0, focusFundamentalsFocusing.filmZMm);

    // Keep the selected standard's solved longitudinal position while
    // preserving any canonical front translation already present in state.
    lensCenterLocal = vec(
      Number.isFinite(cameraState.frontShiftMm) ? cameraState.frontShiftMm : 0,
      Number.isFinite(cameraState.frontRiseMm) ? cameraState.frontRiseMm : 0,
      focusFundamentalsFocusing.lensZMm,
    );
    // recompute lensPlane with updated lens center
    lensPlaneLocal = planeFromPointNormal(lensCenterLocal, lensNormalLocal);

    // focus plane world point is at z = S
  }

  if (
    !Number.isFinite(cameraState.rearRiseMm) ||
    !Number.isFinite(cameraState.rearShiftMm) ||
    !Number.isFinite(cameraState.rearTiltDeg) ||
    !Number.isFinite(cameraState.rearSwingDeg)
  ) {
    return baseFallbackState(
      cameraState,
      scene,
      "Invalid rear movement",
      cameraMovementCalibration,
    );
  }
  const { frame: rearStandardFrameLocal, corners: filmPlaneCornersLocal } =
    calculateRearStandardFrame(
      filmCenterLocal,
      cameraState.rearRiseMm,
      cameraState.rearTiltDeg,
      CAMERA_CONSTANTS.filmWidthMm,
      CAMERA_CONSTANTS.filmHeightMm,
      cameraState.rearShiftMm,
      cameraState.rearSwingDeg,
    );
  const cameraBodyLocalGeometry = createCameraBodyLocalGeometry({
    lensCenterLocal,
    lensNormalLocal,
    lensPlaneLocal,
    rearStandardFrameLocal,
    filmPlaneCornersLocal,
  });
  const cameraRigPlacement = resolveCameraRigPlacement(
    cameraState,
    scene,
    cameraMovementCalibration,
  );
  const cameraRigTransform = resolveCameraRigTransform(
    cameraState,
    scene,
    cameraRigPlacement,
  );
  const cameraBodyTransform = toLegacyCameraBodyTransform(cameraRigTransform);
  const {
    cameraBodyPivotWorld,
    lensCenterWorld,
    lensNormalWorld,
    lensPlane,
    filmCenterWorld,
    filmNormalWorld,
    filmPlane,
    filmPlaneCornersWorld,
    rearStandardFrame: rearFrame,
  } = applyCameraRigTransform(cameraBodyLocalGeometry, cameraRigTransform);
  const opticalAxis = createOpticalAxis(lensCenterWorld, lensNormalWorld);

  // Determine focus point / plane
  let focusPointWorld = calculateFocusPoint(cameraState, opticalAxis);
  // For selectable-focus scenes, focusDistanceMm represents S (focus-plane depth
  // from the rear datum), independent of which standard is selected.
  if (selectableFocusScene) {
    focusPointWorld = vec(
      0,
      0,
      focusFundamentalsFocusDepthMm ?? cameraState.focusDistanceMm,
    );
  }

  // Derive lens/film relationship from actual geometry.
  // Table Tilt uses a strict 1e-6° tolerance so 0.01° relative tilt is not collapsed.
  // All other scenes use the shared 0.1° near-parallel threshold.
  const isTableTilt = scene.id === "table-tilt";
  const lensFilmRel = deriveLensFilmRelationship(lensPlane, filmPlane, isTableTilt);
  const isParallelLensFilm = lensFilmRel.isParallel;
  const lensFilmHingeLine = lensFilmRel.commonLine;
  const { focusPlane, focusPlaneModel } = calculateFocusPlaneWithFallback(
    focusPointWorld,
    filmPlane,
    lensFilmHingeLine,
    isParallelLensFilm || !lensFilmHingeLine,
  );

  // For Focus Fundamentals, compute DOF via thin-lens formula using solved lens extension and object distance U
  let depthOfFieldNearPlane;
  let depthOfFieldFarPlane;
  let dofResultGlobal: ReturnType<typeof calculateDepthOfField> | null = null;
  if (scene.id === "focus-fundamentals-two-targets") {
    const f = cameraState.focalLengthMm;
    // Use the actual lens-to-subject U from the canonical front/rear solution.
    const U = focusFundamentalsFocusing?.objectDistanceUMm ?? f * 2;
    dofResultGlobal = calculateDepthOfField({
      focalLengthMm: f,
      apertureFNumber: cameraState.aperture,
      circleOfConfusionMm: ACCEPTABLE_COC_DIAMETER_MM,
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
      circleOfConfusionMm: ACCEPTABLE_COC_DIAMETER_MM,
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
      circleOfConfusionMm: ACCEPTABLE_COC_DIAMETER_MM,
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
    cameraRigPlacement,
    cameraRigTransform,
    cameraBodyTransform,
    cameraBodyLocalGeometry,
    cameraBodyPivotWorld,
    lensCenterWorld,
    lensNormalWorld,
    lensPlane,
    filmCenterWorld,
    filmNormalWorld,
    filmPlane,
    filmPlaneCornersWorld,
    rearStandardFrame: rearFrame,
    opticalAxis,
    lensFilmHingeLine,
    focusPointWorld,
    focusPlane,
    depthOfFieldNearPlane,
    depthOfFieldFarPlane,
    offAxisProjectionInput,
    offAxisProjectionMatrix,
    groundGlassProjection: calculateGroundGlassProjection(cameraState.groundGlassAssistEnabled),
    focusTargets: calculateSharpness(
      scene,
      focusPlane ?? null,
      cameraState.aperture,
      lensCenterWorld,
      depthOfFieldNearPlane ?? null,
      depthOfFieldFarPlane ?? null,
      {
        lensCenterWorld,
        lensPlaneNormal: lensPlane.normal,
        lensPlaneBasisX: rearFrame.rightWorld,
        lensPlaneBasisY: rearFrame.upWorld,
        filmPlane,
        filmPlaneBasisX: rearFrame.rightWorld,
        filmPlaneBasisY: rearFrame.upWorld,
        focalLengthMm: cameraState.focalLengthMm,
        apertureFNumber: cameraState.aperture,
      },
    ),
    diagnostics: {
      isParallelLensFilm,
      tiltAngleDeg: cameraState.frontTiltDeg,
      swingAngleDeg: cameraState.frontSwingDeg,
      focusPlaneModel,
      depthOfFieldModel: dofResultGlobal?.depthOfFieldModel ?? "parallel",
      // The Table Tilt RTT uses the already-derived focus/near/far planes at
      // zero and non-zero tilt alike. This keeps the Focus slider semantics
      // identical to CPU sharpness without changing Focus Fundamentals.
      groundGlassDofModel:
        isTableTilt || dofResultGlobal?.depthOfFieldModel === "scheimpflug-wedge"
          ? "derived-planes"
          : "parallel-thin-lens",
      nearU: dofResultGlobal?.nearU ?? null,
      farU: dofResultGlobal?.farU ?? null,
      farIsInfinite: dofResultGlobal?.farIsInfinite ?? false,
      fallbackApplied:
        focusFundamentalsFocusing?.fallbackApplied ||
        dofResultGlobal?.fallbackApplied === true,
      fallbackReason:
        focusFundamentalsFocusing?.fallbackReason ?? dofResultGlobal?.fallbackReason ?? null,
      isInfinityFocus: false,
      focusStandard: focusFundamentalsFocusing?.standard ?? cameraState.focusStandard,
      requestedFocusStandard: cameraState.focusStandard,
      focusObjectDistanceMm: focusFundamentalsFocusing?.objectDistanceUMm ?? null,
      imageDistanceMm: focusFundamentalsFocusing?.imageDistanceVMm ?? null,
    },
  };
};

import type { TaskDefinition } from "../../types/task";
import architectureGeometry from "../../scenes/architectureRiseGeometry";
import tableTiltGeometry from "../../scenes/tableTiltGeometry";
import shelfSwingGeometry from "../../scenes/shelfSwingGeometry";
import { mirrorShiftScene } from "../../scenes/definitions/mirror-shift";
import { obliqueArchitectureScene } from "../../scenes/definitions/oblique-architecture";
import obliqueArchitectureGeometry from "../../scenes/obliqueArchitectureGeometry";
import {
  MIRROR_SHIFT_SCENE_CALIBRATION,
  resolveMirrorShiftTeachingState,
} from "../../scenes/mirrorShiftCalibration";

const riseTask: TaskDefinition = {
  id: "rise-01",
  sceneId: "architecture-rise",
  mode: "guided",
  enabledControls: ["rise", "focusDistance", "aperture", "geometryView"],
  constraints: {
    movement: "rise-only",
  },
  criteria: [
    {
      id: "rise-building-top-visible",
      type: "composition-visible",
      targetId: "building-top",
      minimumCoverage: 0.95,
    },
    {
      id: "rise-building-main-visible",
      type: "composition-visible",
      targetId: "building-main-body",
      minimumCoverage: 0.7,
    },
    {
      id: "rise-movement-used",
      type: "movement-used",
      movement: "rise",
      minimumAbs: 12,
    },
    {
      id: "rise-movement-range",
      type: "movement-range",
      movement: "rise",
      min: 12,
      max: 35,
    },
  ],
  initialCameraState: {
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
   focusDistanceMm: architectureGeometry.architectureFacadeFocusDistanceMm,
    rearRiseMm: 0,
    rearTiltDeg: 0,
   aperture: 11,
   geometryView: "side",
    groundGlassAssistEnabled: false,
    focusAssistEnabled: false,
    gridEnabled: true,
  },
};

const obliqueRiseTask: TaskDefinition = {
  id: "oblique-rise-01",
  sceneId: obliqueArchitectureScene.id,
  mode: "guided",
  enabledControls: ["rise", "geometryView"],
  constraints: {
    movement: "rise-only",
  },
  criteria: [
    {
      id: "oblique-rise-building-top-visible",
      type: "composition-visible",
      targetId: "building-top",
      minimumCoverage: 0.95,
      coverageMode: "projected-corners",
    },
    {
      id: "oblique-rise-building-base-visible",
      type: "composition-visible",
      targetId: "building-base",
      minimumCoverage: 0.95,
      coverageMode: "projected-corners",
    },
    {
      id: "oblique-rise-camera-level",
      type: "camera-level",
    },
    {
      id: "oblique-rise-movement-used",
      type: "movement-used",
      movement: "rise",
      minimumAbs: 1,
    },
  ],
  initialCameraState: {
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
    focusDistanceMm: obliqueArchitectureGeometry.canonicalFocusDistanceMm,
    rearRiseMm: 0,
    rearTiltDeg: 0,
    aperture: obliqueArchitectureScene.cameraPreset.aperture,
    geometryView: "side",
    groundGlassAssistEnabled: false,
    focusAssistEnabled: false,
    gridEnabled: true,
  },
};

const obliqueSwingFocusTask: TaskDefinition = {
  id: "oblique-swing-focus-01",
  sceneId: obliqueArchitectureScene.id,
  mode: "guided",
  enabledControls: ["swing", "focusDistance", "geometryView"],
  constraints: {},
  criteria: [
    {
      id: "oblique-swing-focus-building-top-visible",
      type: "composition-visible",
      targetId: "building-top",
      minimumCoverage: 0.95,
      coverageMode: "projected-corners",
    },
    {
      id: "oblique-swing-focus-building-base-visible",
      type: "composition-visible",
      targetId: "building-base",
      minimumCoverage: 0.95,
      coverageMode: "projected-corners",
    },
    {
      id: "oblique-swing-focus-camera-level",
      type: "camera-level",
    },
    {
      id: "oblique-swing-focus-near-sharp",
      type: "focus-targets-sharp",
      targetIds: ["facade-near"],
      minimumSharpness: obliqueArchitectureGeometry.facadeSharpnessMinimum,
    },
    {
      id: "oblique-swing-focus-middle-sharp",
      type: "focus-targets-sharp",
      targetIds: ["facade-middle"],
      minimumSharpness: obliqueArchitectureGeometry.facadeSharpnessMinimum,
    },
    {
      id: "oblique-swing-focus-far-sharp",
      type: "focus-targets-sharp",
      targetIds: ["facade-far"],
      minimumSharpness: obliqueArchitectureGeometry.facadeSharpnessMinimum,
    },
  ],
  initialCameraState: {
    frontRiseMm: obliqueArchitectureGeometry.reachableFrontRiseMm,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
    focusDistanceMm: obliqueArchitectureGeometry.canonicalFocusDistanceMm,
    rearRiseMm: 0,
    rearTiltDeg: 0,
    aperture: obliqueArchitectureScene.cameraPreset.aperture,
    geometryView: "top",
    groundGlassAssistEnabled: false,
    focusAssistEnabled: false,
    gridEnabled: true,
  },
};

const tiltTask: TaskDefinition = {
  id: "tilt-01",
  sceneId: "table-tilt",
  mode: "guided",
  enabledControls: ["tilt", "focusDistance", "aperture", "geometryView"],
  constraints: {
    movement: "tilt-only",
  },
  criteria: [
    {
      id: "tilt-allowed-aperture",
      type: "allowed-aperture",
      allowedApertures: [11, 22],
    },
    {
      id: "tilt-rise-zero",
      type: "movement-range",
      movement: "rise",
      min: 0,
      max: 0,
    },
    {
      id: "tilt-swing-zero",
      type: "movement-range",
      movement: "swing",
      min: 0,
      max: 0,
    },
    {
      id: "tilt-movement-range",
      type: "movement-range",
      movement: "tilt",
      min: tableTiltGeometry.tableTiltCalibration.allowedTiltMinDeg,
      max: tableTiltGeometry.tableTiltCalibration.allowedTiltMaxDeg,
    },
    {
      id: "tilt-near-sharp",
      type: "focus-targets-sharp",
      targetIds: ["near-cup"],
      minimumSharpness: tableTiltGeometry.tableTiltCalibration.targetSharpnessMinimum,
    },
    {
      id: "tilt-mid-sharp",
      type: "focus-targets-sharp",
      targetIds: ["mid-notebook"],
      minimumSharpness: tableTiltGeometry.tableTiltCalibration.targetSharpnessMinimum,
    },
    {
      id: "tilt-far-sharp",
      type: "focus-targets-sharp",
      targetIds: ["far-book"],
      minimumSharpness: tableTiltGeometry.tableTiltCalibration.targetSharpnessMinimum,
    },
  ],
  initialCameraState: {
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
   focusDistanceMm: tableTiltGeometry.canonicalFocusDistanceMm,
    rearRiseMm: 0,
    rearTiltDeg: 0,
   aperture: 11,
   geometryView: "side",
    groundGlassAssistEnabled: false,
    focusAssistEnabled: false,
    gridEnabled: true,
  },
};

const swingTask: TaskDefinition = {
  id: "swing-01",
  sceneId: "shelf-swing",
  mode: "guided",
  enabledControls: ["swing", "focusDistance", "aperture", "geometryView"],
  constraints: {
    movement: "swing-only",
  },
  criteria: [
    {
      id: "swing-allowed-aperture",
      type: "allowed-aperture",
      allowedApertures: [11, 22],
    },
    {
      id: "swing-rise-zero",
      type: "movement-range",
      movement: "rise",
      min: 0,
      max: 0,
    },
    {
      id: "swing-tilt-zero",
      type: "movement-range",
      movement: "tilt",
      min: 0,
      max: 0,
    },
    {
      id: "swing-movement-range",
      type: "movement-range",
      movement: "swing",
      min: shelfSwingGeometry.shelfSwingCalibration.allowedSwingMinDeg,
      max: shelfSwingGeometry.shelfSwingCalibration.allowedSwingMaxDeg,
      valueMode: "signed",
    },
    {
      id: "swing-front-sharp",
      type: "focus-targets-sharp",
      targetIds: ["shelf-front"],
      minimumSharpness: shelfSwingGeometry.shelfSwingCalibration.targetSharpnessMinimum,
    },
    {
      id: "swing-middle-sharp",
      type: "focus-targets-sharp",
      targetIds: ["shelf-middle"],
      minimumSharpness: shelfSwingGeometry.shelfSwingCalibration.targetSharpnessMinimum,
    },
    {
      id: "swing-back-sharp",
      type: "focus-targets-sharp",
      targetIds: ["shelf-back"],
      minimumSharpness: shelfSwingGeometry.shelfSwingCalibration.targetSharpnessMinimum,
    },
  ],
  initialCameraState: {
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
   focusDistanceMm: shelfSwingGeometry.middleSubject.focusDetailProbeWorld.z,
    rearRiseMm: 0,
    rearTiltDeg: 0,
   aperture: 11,
   geometryView: "top",
    groundGlassAssistEnabled: false,
    focusAssistEnabled: false,
    gridEnabled: true,
  },
};

const mirrorShiftTask: TaskDefinition = {
  id: "mirror-shift-01",
  sceneId: mirrorShiftScene.id,
  mode: "guided",
  enabledControls: ["cameraPosition", "frontShift", "geometryView"],
  constraints: {
  },
  criteria: [
    {
      id: "mirror-reflection-clear",
      type: "mirror-reflection-clear",
      minimumClearanceMm:
        MIRROR_SHIFT_SCENE_CALIBRATION.tolerances.cameraReflectionClearanceMm,
    },
    {
      id: "mirror-framing-restored",
      type: "mirror-framing-restored",
      maximumCenterErrorNormalized:
        MIRROR_SHIFT_SCENE_CALIBRATION.tolerances.mirrorFramingRestoredNormalized,
    },
    {
      id: "mirror-viewpoint-retained",
      type: "mirror-viewpoint-retained",
      minimumParallaxDeltaNormalized:
        MIRROR_SHIFT_SCENE_CALIBRATION.tolerances.minimumPropParallaxDeltaNormalized,
    },
  ],
  initialCameraState: {
    ...mirrorShiftScene.cameraPreset,
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
    rearRiseMm: 0,
    rearTiltDeg: 0,
    focusDistanceMm: mirrorShiftScene.cameraPreset.focusDistanceMm,
    aperture: mirrorShiftScene.cameraPreset.aperture,
    groundGlassAssistEnabled: false,
    focusAssistEnabled: false,
    gridEnabled: true,
    frontShiftMm: resolveMirrorShiftTeachingState("neutral").frontShiftMm,
    mirrorShiftLessonState: {
      rigLateralMm: resolveMirrorShiftTeachingState("neutral").rigLateralMm,
    },
  },
  initialViewState: {
    showOpticalGeometry: true,
  },
};

export const taskRegistry: Record<string, TaskDefinition> = {
  "rise-01": riseTask,
  "oblique-rise-01": obliqueRiseTask,
  "oblique-swing-focus-01": obliqueSwingFocusTask,
  "tilt-01": tiltTask,
  "swing-01": swingTask,
  "mirror-shift-01": mirrorShiftTask,
};

export const getTaskById = (taskId: string): TaskDefinition | undefined => taskRegistry[taskId];

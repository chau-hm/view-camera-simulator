import type { TaskDefinition } from "../../types/task";
import architectureGeometry from "../../scenes/architectureRiseGeometry";
import architectureForegroundGeometry from "../../scenes/architectureForegroundGeometry";
import tableTiltGeometry from "../../scenes/tableTiltGeometry";
import shelfSwingGeometry from "../../scenes/shelfSwingGeometry";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import { interiorCornerScene } from "../../scenes/definitions/interior-corner";
import { mirrorShiftScene } from "../../scenes/definitions/mirror-shift";
import { obliqueArchitectureScene } from "../../scenes/definitions/oblique-architecture";
import obliqueTabletopGeometry from "../../scenes/obliqueTabletopGeometry";
import obliqueTabletopCompoundCalibration from "../../scenes/obliqueTabletopCompoundCalibration";
import obliqueArchitectureGeometry from "../../scenes/obliqueArchitectureGeometry";
import {
  MIRROR_SHIFT_SCENE_CALIBRATION,
  resolveMirrorShiftTeachingState,
} from "../../scenes/mirrorShiftCalibration";
import {
  INTERIOR_CORNER_GUIDED_FINAL_APERTURE,
  INTERIOR_CORNER_GUIDED_SWING_RANGE,
  INTERIOR_CORNER_GUIDED_TASK_IDS,
} from "../../scenes/interiorCornerGuidedLesson";
import { interiorCornerSwingFocusCalibration } from "../../scenes/interiorCornerSwingFocus";

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
    gridEnabled: true,
  },
};

const architectureForegroundRiseTask: TaskDefinition = {
  id: "architecture-foreground-rise-01",
  sceneId: architectureForegroundScene.id,
  mode: "guided",
  enabledControls: ["rise", "geometryView"],
  constraints: {
    movement: "rise-only",
  },
  criteria: [
    {
      id: "architecture-foreground-rise-building-top-visible",
      type: "composition-visible",
      targetId: "building-top",
      minimumCoverage: 0.95,
      coverageMode: "projected-corners",
    },
    {
      id: "architecture-foreground-rise-building-base-visible",
      type: "composition-visible",
      targetId: "building-base",
      minimumCoverage: 0.95,
      coverageMode: "projected-corners",
    },
    {
      id: "architecture-foreground-rise-camera-level",
      type: "camera-level",
    },
    {
      id: "architecture-foreground-rise-movement-used",
      type: "movement-used",
      movement: "rise",
      minimumAbs: 1,
    },
  ],
  initialCameraState: {
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
    focusDistanceMm: architectureForegroundGeometry.canonicalFocusDistanceMm,
    rearRiseMm: 0,
    rearTiltDeg: 0,
    aperture: architectureForegroundScene.cameraPreset.aperture,
    geometryView: "side",
    groundGlassAssistEnabled: false,
    gridEnabled: true,
  },
};

const architectureForegroundTiltFocusTask: TaskDefinition = {
  id: "architecture-foreground-tilt-focus-01",
  sceneId: architectureForegroundScene.id,
  mode: "guided",
  enabledControls: ["tilt", "focusDistance", "geometryView"],
  constraints: {},
  criteria: [
    {
      id: "architecture-foreground-tilt-focus-building-top-visible",
      type: "composition-visible",
      targetId: "building-top",
      minimumCoverage: 0.95,
      coverageMode: "projected-corners",
    },
    {
      id: "architecture-foreground-tilt-focus-building-base-visible",
      type: "composition-visible",
      targetId: "building-base",
      minimumCoverage: 0.95,
      coverageMode: "projected-corners",
    },
    {
      id: "architecture-foreground-tilt-focus-camera-level",
      type: "camera-level",
    },
    {
      id: "architecture-foreground-tilt-focus-tilt-used",
      type: "movement-used",
      movement: "tilt",
      minimumAbs: 0.1,
    },
    {
      id: "architecture-foreground-tilt-focus-tilt-range",
      type: "movement-range",
      movement: "tilt",
      min: architectureForegroundGeometry.neutralCalibration.tiltFocusRangeDeg.min,
      max: architectureForegroundGeometry.neutralCalibration.tiltFocusRangeDeg.max,
      valueMode: "signed",
    },
    {
      id: "architecture-foreground-tilt-focus-focus-used",
      type: "focus-used",
      minimumAbsMm:
        architectureForegroundGeometry.neutralCalibration.tiltFocusMinimumFocusAdjustmentMm,
    },
    {
      id: "architecture-foreground-tilt-focus-near-sharp",
      type: "focus-targets-sharp",
      targetIds: ["foreground-near"],
      minimumSharpness: architectureForegroundGeometry.neutralCalibration.tiltFocusSharpnessMinimum,
    },
    {
      id: "architecture-foreground-tilt-focus-building-sharp",
      type: "focus-targets-sharp",
      targetIds: ["building-middle"],
      minimumSharpness: architectureForegroundGeometry.neutralCalibration.tiltFocusSharpnessMinimum,
    },
  ],
  initialCameraState: {
    frontRiseMm: architectureForegroundGeometry.neutralCalibration.futureRiseMm,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
    focusDistanceMm: architectureForegroundGeometry.canonicalFocusDistanceMm,
    rearRiseMm: 0,
    rearTiltDeg: 0,
    aperture: architectureForegroundScene.cameraPreset.aperture,
    geometryView: "side",
    groundGlassAssistEnabled: false,
    gridEnabled: true,
  },
};

const architectureForegroundDofTask: TaskDefinition = {
  id: "architecture-foreground-dof-01",
  sceneId: architectureForegroundScene.id,
  mode: "guided",
  enabledControls: ["aperture", "geometryView"],
  constraints: {},
  criteria: [
    {
      id: "architecture-foreground-dof-building-top-visible",
      type: "composition-visible",
      targetId: "building-top",
      minimumCoverage: 0.95,
      coverageMode: "projected-corners",
    },
    {
      id: "architecture-foreground-dof-building-base-visible",
      type: "composition-visible",
      targetId: "building-base",
      minimumCoverage: 0.95,
      coverageMode: "projected-corners",
    },
    {
      id: "architecture-foreground-dof-camera-level",
      type: "camera-level",
    },
    {
      id: "architecture-foreground-dof-aperture",
      type: "allowed-aperture",
      allowedApertures: [...architectureForegroundGeometry.neutralCalibration.dofPassingApertures],
    },
    {
      id: "architecture-foreground-dof-focus-targets",
      type: "focus-targets-sharp",
      targetIds: [
        "foreground-near",
        "foreground-middle",
        "building-base",
        "building-middle",
      ],
      minimumSharpness: architectureForegroundGeometry.neutralCalibration.dofSharpnessMinimum,
    },
  ],
  initialCameraState: {
    frontRiseMm: architectureForegroundGeometry.neutralCalibration.futureRiseMm,
    frontTiltDeg: architectureForegroundGeometry.neutralCalibration.publicTiltFocusSolutionDeg,
    frontSwingDeg: 0,
    focusDistanceMm:
      architectureForegroundGeometry.neutralCalibration.publicTiltFocusFocusDistanceMm,
    rearRiseMm: 0,
    rearTiltDeg: 0,
    aperture: architectureForegroundScene.cameraPreset.aperture,
    geometryView: "side",
    groundGlassAssistEnabled: false,
    gridEnabled: true,
  },
};

const architectureForegroundCompoundTask: TaskDefinition = {
  id: "architecture-foreground-compound-01",
  sceneId: architectureForegroundScene.id,
  mode: "guided",
  enabledControls: ["rise", "tilt", "focusDistance", "aperture", "geometryView"],
  constraints: {},
  criteria: [
    {
      id: "architecture-foreground-compound-building-top-visible",
      type: "composition-visible",
      targetId: "building-top",
      minimumCoverage: 0.95,
      coverageMode: "projected-corners",
    },
    {
      id: "architecture-foreground-compound-building-base-visible",
      type: "composition-visible",
      targetId: "building-base",
      minimumCoverage: 0.95,
      coverageMode: "projected-corners",
    },
    {
      id: "architecture-foreground-compound-camera-level",
      type: "camera-level",
    },
    {
      id: "architecture-foreground-compound-tilt-used",
      type: "movement-used",
      movement: "tilt",
      minimumAbs: 0.1,
    },
    {
      id: "architecture-foreground-compound-tilt-range",
      type: "movement-range",
      movement: "tilt",
      min: architectureForegroundGeometry.neutralCalibration.tiltFocusRangeDeg.min,
      max: architectureForegroundGeometry.neutralCalibration.tiltFocusRangeDeg.max,
      valueMode: "signed",
    },
    {
      id: "architecture-foreground-compound-focus-used",
      type: "focus-used",
      minimumAbsMm:
        architectureForegroundGeometry.neutralCalibration.tiltFocusMinimumFocusAdjustmentMm,
    },
    {
      id: "architecture-foreground-compound-focus-targets",
      type: "focus-targets-sharp",
      targetIds: [
        "foreground-near",
        "foreground-middle",
        "building-base",
        "building-middle",
      ],
      minimumSharpness: architectureForegroundGeometry.neutralCalibration.dofSharpnessMinimum,
    },
  ],
  initialCameraState: {
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
    focusDistanceMm: architectureForegroundGeometry.canonicalFocusDistanceMm,
    rearRiseMm: 0,
    rearTiltDeg: 0,
    aperture: architectureForegroundScene.cameraPreset.aperture,
    geometryView: "side",
    groundGlassAssistEnabled: false,
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
    gridEnabled: true,
  },
};

const obliqueCompoundTask: TaskDefinition = {
  id: "oblique-compound-01",
  sceneId: obliqueArchitectureScene.id,
  mode: "guided",
  enabledControls: ["rise", "swing", "focusDistance", "geometryView"],
  constraints: {},
  criteria: [
    {
      id: "oblique-compound-building-top-visible",
      type: "composition-visible",
      targetId: "building-top",
      minimumCoverage: 0.95,
      coverageMode: "projected-corners",
    },
    {
      id: "oblique-compound-building-base-visible",
      type: "composition-visible",
      targetId: "building-base",
      minimumCoverage: 0.95,
      coverageMode: "projected-corners",
    },
    {
      id: "oblique-compound-camera-level",
      type: "camera-level",
    },
    {
      id: "oblique-compound-near-sharp",
      type: "focus-targets-sharp",
      targetIds: ["facade-near"],
      minimumSharpness: obliqueArchitectureGeometry.facadeSharpnessMinimum,
    },
    {
      id: "oblique-compound-middle-sharp",
      type: "focus-targets-sharp",
      targetIds: ["facade-middle"],
      minimumSharpness: obliqueArchitectureGeometry.facadeSharpnessMinimum,
    },
    {
      id: "oblique-compound-far-sharp",
      type: "focus-targets-sharp",
      targetIds: ["facade-far"],
      minimumSharpness: obliqueArchitectureGeometry.facadeSharpnessMinimum,
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
    geometryView: "top",
    groundGlassAssistEnabled: false,
    gridEnabled: true,
  },
};

const obliqueTabletopCompound = obliqueTabletopCompoundCalibration.public;
const obliqueTabletopVisibleTargetIds = obliqueTabletopGeometry.tabletopVisibleFocusSamples.map(
  (sample) => sample.id,
);
const obliqueTabletopPrincipalTargetIds = [
  ...obliqueTabletopGeometry.tabletopPrincipalDepthSampleIds,
];
const obliqueTabletopTiltOnlyRange = {
  min: obliqueTabletopGeometry.tiltOnlyCalibration.frontTiltDeg - 0.5,
  max: obliqueTabletopGeometry.tiltOnlyCalibration.frontTiltDeg + 0.5,
};
const obliqueTabletopCompoundTiltRange = {
  min: obliqueTabletopCompound.frontTiltDeg - 0.5,
  max: obliqueTabletopCompound.frontTiltDeg + 0.5,
};
const obliqueTabletopCompoundSwingRange = {
  min: obliqueTabletopCompound.frontSwingDeg - 0.5,
  max: obliqueTabletopCompound.frontSwingDeg + 0.5,
};
const obliqueTabletopSwingStage = {
  frontTiltDeg: -7.4,
  frontSwingDeg: -1.4,
  focusDistanceMm: 2630,
} as const;
const obliqueTabletopSwingStageTiltRange = {
  min: obliqueTabletopSwingStage.frontTiltDeg - 0.5,
  max: obliqueTabletopSwingStage.frontTiltDeg + 0.5,
};
const obliqueTabletopSwingStageSwingRange = {
  min: obliqueTabletopSwingStage.frontSwingDeg - 0.5,
  max: obliqueTabletopSwingStage.frontSwingDeg + 0.5,
};
const obliqueTabletopRefineTiltRange = {
  min: Math.min(obliqueTabletopCompoundTiltRange.min, obliqueTabletopSwingStageTiltRange.min),
  max: Math.max(obliqueTabletopCompoundTiltRange.max, obliqueTabletopSwingStageTiltRange.max),
};
const obliqueTabletopSwingLateralTargetIds = obliqueTabletopGeometry.tabletopVisibleFocusSamples
  .filter(({ id }) => id === "far-left" || id === "far-right")
  .map(({ id }) => id);
const obliqueTabletopSharpnessMinimum = 0.8;

const obliqueTabletopTaskCameraState = {
  frontRiseMm: 0,
  frontTiltDeg: 0,
  frontSwingDeg: 0,
  focusDistanceMm: obliqueTabletopGeometry.canonicalFocusDistanceMm,
  rearRiseMm: 0,
  rearTiltDeg: 0,
  aperture: 11 as const,
  geometryView: "side" as const,
  groundGlassAssistEnabled: false,
  gridEnabled: true,
};

const obliqueTabletopFocusTask: TaskDefinition = {
  id: "oblique-tabletop-focus-01",
  sceneId: "oblique-tabletop",
  mode: "guided",
  enabledControls: ["focusDistance", "geometryView"],
  constraints: {},
  criteria: [
    {
      id: "oblique-tabletop-focus-allowed-aperture",
      type: "allowed-aperture",
      allowedApertures: [11],
    },
    {
      id: "oblique-tabletop-focus-rise-zero",
      type: "movement-range",
      movement: "rise",
      min: 0,
      max: 0,
    },
    {
      id: "oblique-tabletop-focus-tilt-zero",
      type: "movement-range",
      movement: "tilt",
      min: 0,
      max: 0,
    },
    {
      id: "oblique-tabletop-focus-swing-zero",
      type: "movement-range",
      movement: "swing",
      min: 0,
      max: 0,
    },
    {
      id: "oblique-tabletop-focus-used",
      type: "focus-used",
      minimumAbsMm: 100,
    },
    {
      id: "oblique-tabletop-focus-middle-sharp",
      type: "focus-targets-sharp",
      targetIds: ["middle"],
      minimumSharpness: obliqueTabletopSharpnessMinimum,
    },
  ],
  initialCameraState: {
    ...obliqueTabletopTaskCameraState,
    focusDistanceMm: obliqueTabletopGeometry.canonicalFocusDistanceMm + 200,
  },
};

const obliqueTabletopTiltTask: TaskDefinition = {
  id: "oblique-tabletop-tilt-01",
  sceneId: "oblique-tabletop",
  mode: "guided",
  enabledControls: ["tilt", "focusDistance", "geometryView"],
  constraints: {
    movement: "tilt-only",
  },
  criteria: [
    {
      id: "oblique-tabletop-tilt-allowed-aperture",
      type: "allowed-aperture",
      allowedApertures: [11],
    },
    {
      id: "oblique-tabletop-tilt-rise-zero",
      type: "movement-range",
      movement: "rise",
      min: 0,
      max: 0,
    },
    {
      id: "oblique-tabletop-tilt-swing-zero",
      type: "movement-range",
      movement: "swing",
      min: 0,
      max: 0,
    },
    {
      id: "oblique-tabletop-tilt-movement-range",
      type: "movement-range",
      movement: "tilt",
      min: obliqueTabletopTiltOnlyRange.min,
      max: obliqueTabletopTiltOnlyRange.max,
      valueMode: "signed",
    },
    {
      id: "oblique-tabletop-tilt-near-sharp",
      type: "focus-targets-sharp",
      targetIds: [obliqueTabletopPrincipalTargetIds[0]],
      minimumSharpness: obliqueTabletopSharpnessMinimum,
    },
    {
      id: "oblique-tabletop-tilt-middle-sharp",
      type: "focus-targets-sharp",
      targetIds: [obliqueTabletopPrincipalTargetIds[1]],
      minimumSharpness: obliqueTabletopSharpnessMinimum,
    },
    {
      id: "oblique-tabletop-tilt-far-sharp",
      type: "focus-targets-sharp",
      targetIds: [obliqueTabletopPrincipalTargetIds[2]],
      minimumSharpness: obliqueTabletopSharpnessMinimum,
    },
  ],
  initialCameraState: {
    ...obliqueTabletopTaskCameraState,
    focusDistanceMm: obliqueTabletopGeometry.canonicalFocusDistanceMm,
  },
};

const obliqueTabletopSwingTask: TaskDefinition = {
  id: "oblique-tabletop-swing-01",
  sceneId: "oblique-tabletop",
  mode: "guided",
  enabledControls: ["tilt", "swing", "focusDistance", "geometryView"],
  constraints: {},
  criteria: [
    {
      id: "oblique-tabletop-swing-allowed-aperture",
      type: "allowed-aperture",
      allowedApertures: [11],
    },
    {
      id: "oblique-tabletop-swing-rise-zero",
      type: "movement-range",
      movement: "rise",
      min: 0,
      max: 0,
    },
    {
      id: "oblique-tabletop-swing-tilt-range",
      type: "movement-range",
      movement: "tilt",
      min: obliqueTabletopSwingStageTiltRange.min,
      max: obliqueTabletopSwingStageTiltRange.max,
      valueMode: "signed",
    },
    {
      id: "oblique-tabletop-swing-movement-range",
      type: "movement-range",
      movement: "swing",
      min: obliqueTabletopSwingStageSwingRange.min,
      max: obliqueTabletopSwingStageSwingRange.max,
      valueMode: "signed",
    },
    {
      id: "oblique-tabletop-swing-focus-used",
      type: "focus-used",
      minimumAbsMm: 50,
    },
    {
      id: "oblique-tabletop-swing-lateral-sharp",
      type: "focus-targets-sharp",
      targetIds: obliqueTabletopSwingLateralTargetIds,
      minimumSharpness: obliqueTabletopSharpnessMinimum,
    },
  ],
  initialCameraState: {
    ...obliqueTabletopTaskCameraState,
    frontTiltDeg: obliqueTabletopGeometry.tiltOnlyCalibration.frontTiltDeg,
    focusDistanceMm: obliqueTabletopGeometry.tiltOnlyCalibration.focusDistanceMm,
    geometryView: "top",
  },
};

const obliqueTabletopRefineTask: TaskDefinition = {
  id: "oblique-tabletop-refine-01",
  sceneId: "oblique-tabletop",
  mode: "guided",
  enabledControls: ["tilt", "swing", "focusDistance", "geometryView"],
  constraints: {},
  criteria: [
    {
      id: "oblique-tabletop-refine-allowed-aperture",
      type: "allowed-aperture",
      allowedApertures: [11],
    },
    {
      id: "oblique-tabletop-refine-rise-zero",
      type: "movement-range",
      movement: "rise",
      min: 0,
      max: 0,
    },
    {
      id: "oblique-tabletop-refine-tilt-range",
      type: "movement-range",
      movement: "tilt",
      min: obliqueTabletopRefineTiltRange.min,
      max: obliqueTabletopRefineTiltRange.max,
      valueMode: "signed",
    },
    {
      id: "oblique-tabletop-refine-swing-range",
      type: "movement-range",
      movement: "swing",
      min: obliqueTabletopCompoundSwingRange.min,
      max: obliqueTabletopCompoundSwingRange.max,
      valueMode: "signed",
    },
    {
      id: "oblique-tabletop-refine-focus-used",
      type: "focus-used",
      minimumAbsMm: 50,
    },
    {
      id: "oblique-tabletop-refine-all-targets-sharp",
      type: "focus-targets-sharp",
      targetIds: obliqueTabletopVisibleTargetIds,
      minimumSharpness: obliqueTabletopSharpnessMinimum,
    },
  ],
  initialCameraState: {
    ...obliqueTabletopTaskCameraState,
    frontTiltDeg: obliqueTabletopSwingStage.frontTiltDeg,
    frontSwingDeg: obliqueTabletopSwingStage.frontSwingDeg,
    focusDistanceMm: obliqueTabletopSwingStage.focusDistanceMm,
    geometryView: "scheimpflug",
  },
};

const obliqueTabletopApertureTask: TaskDefinition = {
  id: "oblique-tabletop-aperture-01",
  sceneId: "oblique-tabletop",
  mode: "guided",
  enabledControls: ["aperture", "geometryView"],
  constraints: {},
  criteria: [
    {
      id: "oblique-tabletop-aperture-allowed-aperture",
      type: "allowed-aperture",
      allowedApertures: [22],
    },
    {
      id: "oblique-tabletop-aperture-rise-zero",
      type: "movement-range",
      movement: "rise",
      min: 0,
      max: 0,
    },
    {
      id: "oblique-tabletop-aperture-tilt-range",
      type: "movement-range",
      movement: "tilt",
      min: obliqueTabletopCompoundTiltRange.min,
      max: obliqueTabletopCompoundTiltRange.max,
      valueMode: "signed",
    },
    {
      id: "oblique-tabletop-aperture-swing-range",
      type: "movement-range",
      movement: "swing",
      min: obliqueTabletopCompoundSwingRange.min,
      max: obliqueTabletopCompoundSwingRange.max,
      valueMode: "signed",
    },
    {
      id: "oblique-tabletop-aperture-all-targets-sharp",
      type: "focus-targets-sharp",
      targetIds: obliqueTabletopVisibleTargetIds,
      minimumSharpness: obliqueTabletopSharpnessMinimum,
    },
  ],
  initialCameraState: {
    ...obliqueTabletopTaskCameraState,
    frontTiltDeg: obliqueTabletopCompound.frontTiltDeg,
    frontSwingDeg: obliqueTabletopCompound.frontSwingDeg,
    focusDistanceMm: obliqueTabletopCompound.focusDistanceMm,
    geometryView: "scheimpflug",
  },
};

const interiorCornerComposedRiseMm = 33;
const interiorCornerSwingRange = INTERIOR_CORNER_GUIDED_SWING_RANGE;
const interiorCornerSwingFocus = interiorCornerSwingFocusCalibration.public;

const interiorCornerInitialCameraState: NonNullable<TaskDefinition["initialCameraState"]> = {
  frontRiseMm: 0,
  frontTiltDeg: 0,
  frontSwingDeg: 0,
  rearRiseMm: 0,
  rearTiltDeg: 0,
  focusDistanceMm: interiorCornerScene.cameraPreset.focusDistanceMm,
  aperture: interiorCornerScene.cameraPreset.aperture,
  geometryView: "top",
  groundGlassAssistEnabled: false,
  gridEnabled: true,
};

const interiorCornerComposeTask: TaskDefinition = {
  id: INTERIOR_CORNER_GUIDED_TASK_IDS.compose,
  sceneId: interiorCornerScene.id,
  mode: "guided",
  enabledControls: ["rise", "geometryView"],
  constraints: {
    movement: "rise-only",
  },
  criteria: [
    {
      id: "interior-corner-compose-composition",
      type: "interior-corner-rise-composition",
    },
    {
      id: "interior-corner-compose-camera-level",
      type: "camera-level",
    },
  ],
  initialCameraState: interiorCornerInitialCameraState,
};

const interiorCornerSwingTask: TaskDefinition = {
  id: INTERIOR_CORNER_GUIDED_TASK_IDS.swing,
  sceneId: interiorCornerScene.id,
  mode: "guided",
  enabledControls: ["swing", "geometryView"],
  constraints: {
    movement: "swing-only",
  },
  criteria: [
    {
      id: "interior-corner-swing-allowed-aperture",
      type: "allowed-aperture",
      allowedApertures: [interiorCornerScene.cameraPreset.aperture],
    },
    {
      id: "interior-corner-swing-composition",
      type: "interior-corner-rise-composition",
    },
    {
      id: "interior-corner-swing-range",
      type: "movement-range",
      movement: "swing",
      min: interiorCornerSwingRange.min,
      max: interiorCornerSwingRange.max,
      valueMode: "signed",
    },
    {
      id: "interior-corner-swing-orientation",
      type: "interior-corner-swing-orientation",
    },
    {
      id: "interior-corner-swing-camera-level",
      type: "camera-level",
    },
  ],
  initialCameraState: {
    ...interiorCornerInitialCameraState,
    frontRiseMm: interiorCornerComposedRiseMm,
    frontSwingDeg: 0,
    focusDistanceMm: interiorCornerScene.cameraPreset.focusDistanceMm,
    geometryView: "top",
  },
};

const interiorCornerRefineTask: TaskDefinition = {
  id: INTERIOR_CORNER_GUIDED_TASK_IDS.refine,
  sceneId: interiorCornerScene.id,
  mode: "guided",
  enabledControls: ["swing", "focusDistance", "geometryView"],
  constraints: {},
  criteria: [
    {
      id: "interior-corner-refine-allowed-aperture",
      type: "allowed-aperture",
      allowedApertures: [interiorCornerScene.cameraPreset.aperture],
    },
    {
      id: "interior-corner-refine-composition",
      type: "interior-corner-rise-composition",
    },
    {
      id: "interior-corner-refine-swing-range",
      type: "movement-range",
      movement: "swing",
      min: interiorCornerSwingRange.min,
      max: interiorCornerSwingRange.max,
      valueMode: "signed",
    },
    {
      id: "interior-corner-refine-focus-used",
      type: "focus-used",
      minimumAbsMm: 100,
    },
    {
      id: "interior-corner-refine-wall-focus",
      type: "interior-corner-wall-focus",
    },
    {
      id: "interior-corner-refine-camera-level",
      type: "camera-level",
    },
  ],
  initialCameraState: {
    ...interiorCornerInitialCameraState,
    frontRiseMm: interiorCornerComposedRiseMm,
    frontSwingDeg: interiorCornerSwingFocus.frontSwingDeg,
    focusDistanceMm: interiorCornerScene.cameraPreset.focusDistanceMm,
    geometryView: "top",
  },
};

const interiorCornerApertureTask: TaskDefinition = {
  id: INTERIOR_CORNER_GUIDED_TASK_IDS.aperture,
  sceneId: interiorCornerScene.id,
  mode: "guided",
  enabledControls: ["aperture", "geometryView"],
  constraints: {},
  criteria: [
    {
      id: "interior-corner-aperture-allowed-aperture",
      type: "allowed-aperture",
      allowedApertures: [INTERIOR_CORNER_GUIDED_FINAL_APERTURE],
    },
    {
      id: "interior-corner-aperture-composition",
      type: "interior-corner-rise-composition",
    },
    {
      id: "interior-corner-aperture-swing-range",
      type: "movement-range",
      movement: "swing",
      min: interiorCornerSwingRange.min,
      max: interiorCornerSwingRange.max,
      valueMode: "signed",
    },
    {
      id: "interior-corner-aperture-focus-preserved",
      type: "interior-corner-focus-preserved",
    },
    {
      id: "interior-corner-aperture-camera-level",
      type: "camera-level",
    },
  ],
  initialCameraState: {
    ...interiorCornerInitialCameraState,
    frontRiseMm: interiorCornerComposedRiseMm,
    frontSwingDeg: interiorCornerSwingFocus.frontSwingDeg,
    focusDistanceMm: interiorCornerSwingFocus.focusDistanceMm,
    aperture: interiorCornerScene.cameraPreset.aperture,
    geometryView: "scheimpflug",
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
  "architecture-foreground-rise-01": architectureForegroundRiseTask,
  "architecture-foreground-tilt-focus-01": architectureForegroundTiltFocusTask,
  "architecture-foreground-dof-01": architectureForegroundDofTask,
  "architecture-foreground-compound-01": architectureForegroundCompoundTask,
  "oblique-swing-focus-01": obliqueSwingFocusTask,
  "oblique-compound-01": obliqueCompoundTask,
  "oblique-tabletop-focus-01": obliqueTabletopFocusTask,
  "oblique-tabletop-tilt-01": obliqueTabletopTiltTask,
  "oblique-tabletop-swing-01": obliqueTabletopSwingTask,
  "oblique-tabletop-refine-01": obliqueTabletopRefineTask,
  "oblique-tabletop-aperture-01": obliqueTabletopApertureTask,
  [interiorCornerComposeTask.id]: interiorCornerComposeTask,
  [interiorCornerSwingTask.id]: interiorCornerSwingTask,
  [interiorCornerRefineTask.id]: interiorCornerRefineTask,
  [interiorCornerApertureTask.id]: interiorCornerApertureTask,
  "tilt-01": tiltTask,
  "swing-01": swingTask,
  "mirror-shift-01": mirrorShiftTask,
};

export const getTaskById = (taskId: string): TaskDefinition | undefined => taskRegistry[taskId];

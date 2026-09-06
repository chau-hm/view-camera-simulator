import type { TaskDefinition } from "../../types/task";
import { taskRegistry as baseTaskRegistry } from "./baseTaskRegistry";
import { interiorCornerScene } from "../../scenes/definitions/interior-corner";
import {
  INTERIOR_CORNER_GUIDED_FINAL_APERTURE,
  INTERIOR_CORNER_GUIDED_SWING_RANGE,
  INTERIOR_CORNER_GUIDED_TASK_IDS,
} from "../../scenes/interiorCornerGuidedLesson";
import { interiorCornerSwingFocusCalibration } from "../../scenes/interiorCornerSwingFocus";

// PR130 landed after PR129/PR131 had already moved main forward. Keep the
// current-main registry byte-for-byte in baseTaskRegistry and replace only the
// superseded Interior Corner task family here. This prevents conflict
// resolution from regressing unrelated guided lessons (notably Oblique
// Tabletop) while preserving PR130's finer Compose → Swing → Refine → Aperture
// teaching sequence.
const nonInteriorTaskRegistry = Object.fromEntries(
  Object.entries(baseTaskRegistry).filter(([taskId]) => !taskId.startsWith("interior-corner-")),
) as Record<string, TaskDefinition>;

const interiorCornerComposedRiseMm = 33;
const interiorCornerSwingRange = INTERIOR_CORNER_GUIDED_SWING_RANGE;
const interiorCornerSwingFocus = interiorCornerSwingFocusCalibration.public;

const interiorCornerInitialCameraState: NonNullable<TaskDefinition["initialCameraState"]> = {
  frontRiseMm: 0,
  frontTiltDeg: 0,
  frontSwingDeg: 0,
  rearRiseMm: 0,
  rearTiltDeg: 0,
  focusMode: "finite",
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
  constraints: { movement: "rise-only" },
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
  constraints: { movement: "swing-only" },
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

export const taskRegistry: Record<string, TaskDefinition> = {
  ...nonInteriorTaskRegistry,
  [interiorCornerComposeTask.id]: interiorCornerComposeTask,
  [interiorCornerSwingTask.id]: interiorCornerSwingTask,
  [interiorCornerRefineTask.id]: interiorCornerRefineTask,
  [interiorCornerApertureTask.id]: interiorCornerApertureTask,
};

export const getTaskById = (taskId: string): TaskDefinition | undefined => taskRegistry[taskId];

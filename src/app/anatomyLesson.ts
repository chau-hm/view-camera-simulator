import { lessonZeroMessageKeys, type LessonZeroMessageKey } from "../i18n/lessonZeroMessageKeys";
import {
  CAMERA_CONTROL_TEACHING,
  resolveCameraControlTeachingCompletion,
  type CameraControlTeachingId,
} from "./cameraControlTeaching";
import type { CameraState } from "../types/camera";
import type {
  ConceptualAnatomyTarget,
  ConceptualCameraPresentation,
  ConceptualRearBackMode,
} from "../render/ConceptualViewCamera";
import type { CameraInspectionTarget } from "../render/sceneViewFraming";

export const LESSON_ZERO_ANATOMY_TARGETS = [
  "lens",
  "lens-board",
  "front-standard",
  "bellows",
  "rear-standard",
  "ground-glass",
  "film-holder",
  "camera-support",
  "aperture",
] as const;

export type LessonZeroAnatomyTarget = (typeof LESSON_ZERO_ANATOMY_TARGETS)[number];

export type LessonZeroAnatomyDefinition = {
  semanticTargets: readonly ConceptualAnatomyTarget[];
};

const partTarget = (
  part: Extract<ConceptualAnatomyTarget, { kind: "part" }>["part"],
): ConceptualAnatomyTarget => ({ kind: "part", part });

const elementTarget = (): ConceptualAnatomyTarget => ({
  kind: "element",
  name: "lens-aperture-iris",
  parentPart: "lens",
});

/** Central lesson-facing vocabulary to render-semantic anatomy mapping. */
export const LESSON_ZERO_ANATOMY: Record<
  LessonZeroAnatomyTarget,
  LessonZeroAnatomyDefinition
> = {
  lens: { semanticTargets: [partTarget("lens")] },
  "lens-board": { semanticTargets: [partTarget("lens-board")] },
  "front-standard": { semanticTargets: [partTarget("front-standard")] },
  bellows: { semanticTargets: [partTarget("bellows")] },
  "rear-standard": { semanticTargets: [partTarget("rear-standard")] },
  "ground-glass": { semanticTargets: [partTarget("ground-glass-back")] },
  "film-holder": { semanticTargets: [partTarget("film-holder")] },
  "camera-support": { semanticTargets: [partTarget("camera-support")] },
  aperture: { semanticTargets: [elementTarget()] },
};

export type LessonZeroStepId =
  | "complete-camera"
  | "front-standard"
  | "lens-and-board"
  | "aperture"
  | "bellows"
  | "rear-standard"
  | "ground-glass"
  | "film-holder"
  | "camera-support"
  | "recap"
  | "controls-overview"
  | "front-rise-control"
  | "front-shift-control"
  | "front-tilt-control"
  | "front-swing-control"
  | "focus-front-control"
  | "focus-rear-control"
  | "aperture-control"
  | "controls-recap";

export type LessonZeroStepSection = "anatomy" | "controls";

export type LessonZeroStep = {
  id: LessonZeroStepId;
  section: LessonZeroStepSection;
  titleKey: LessonZeroMessageKey;
  bodyKey: LessonZeroMessageKey;
  cueKey: LessonZeroMessageKey;
  anatomyTargets: readonly LessonZeroAnatomyTarget[];
  inspectionTarget: CameraInspectionTarget;
  rearBackMode: ConceptualRearBackMode;
  controlTeachingId?: CameraControlTeachingId;
};

export const LESSON_ZERO_STEPS: readonly LessonZeroStep[] = [
  {
    id: "complete-camera",
    section: "anatomy",
    titleKey: lessonZeroMessageKeys.steps.completeCamera.title,
    bodyKey: lessonZeroMessageKeys.steps.completeCamera.body,
    cueKey: lessonZeroMessageKeys.steps.completeCamera.cue,
    anatomyTargets: [],
    inspectionTarget: "whole-camera",
    rearBackMode: "ground-glass",
  },
  {
    id: "front-standard",
    section: "anatomy",
    titleKey: lessonZeroMessageKeys.steps.frontStandard.title,
    bodyKey: lessonZeroMessageKeys.steps.frontStandard.body,
    cueKey: lessonZeroMessageKeys.steps.frontStandard.cue,
    anatomyTargets: ["front-standard"],
    inspectionTarget: "front-standard",
    rearBackMode: "ground-glass",
  },
  {
    id: "lens-and-board",
    section: "anatomy",
    titleKey: lessonZeroMessageKeys.steps.lensAndBoard.title,
    bodyKey: lessonZeroMessageKeys.steps.lensAndBoard.body,
    cueKey: lessonZeroMessageKeys.steps.lensAndBoard.cue,
    anatomyTargets: ["lens", "lens-board"],
    inspectionTarget: "lens-board",
    rearBackMode: "ground-glass",
  },
  {
    id: "aperture",
    section: "anatomy",
    titleKey: lessonZeroMessageKeys.steps.aperture.title,
    bodyKey: lessonZeroMessageKeys.steps.aperture.body,
    cueKey: lessonZeroMessageKeys.steps.aperture.cue,
    anatomyTargets: ["aperture"],
    inspectionTarget: "aperture",
    rearBackMode: "ground-glass",
  },
  {
    id: "bellows",
    section: "anatomy",
    titleKey: lessonZeroMessageKeys.steps.bellows.title,
    bodyKey: lessonZeroMessageKeys.steps.bellows.body,
    cueKey: lessonZeroMessageKeys.steps.bellows.cue,
    anatomyTargets: ["bellows"],
    inspectionTarget: "bellows",
    rearBackMode: "ground-glass",
  },
  {
    id: "rear-standard",
    section: "anatomy",
    titleKey: lessonZeroMessageKeys.steps.rearStandard.title,
    bodyKey: lessonZeroMessageKeys.steps.rearStandard.body,
    cueKey: lessonZeroMessageKeys.steps.rearStandard.cue,
    anatomyTargets: ["rear-standard"],
    inspectionTarget: "rear-standard",
    rearBackMode: "ground-glass",
  },
  {
    id: "ground-glass",
    section: "anatomy",
    titleKey: lessonZeroMessageKeys.steps.groundGlass.title,
    bodyKey: lessonZeroMessageKeys.steps.groundGlass.body,
    cueKey: lessonZeroMessageKeys.steps.groundGlass.cue,
    anatomyTargets: ["ground-glass"],
    inspectionTarget: "ground-glass",
    rearBackMode: "ground-glass",
  },
  {
    id: "film-holder",
    section: "anatomy",
    titleKey: lessonZeroMessageKeys.steps.filmHolder.title,
    bodyKey: lessonZeroMessageKeys.steps.filmHolder.body,
    cueKey: lessonZeroMessageKeys.steps.filmHolder.cue,
    anatomyTargets: ["film-holder"],
    inspectionTarget: "film-holder",
    rearBackMode: "film-holder",
  },
  {
    id: "camera-support",
    section: "anatomy",
    titleKey: lessonZeroMessageKeys.steps.cameraSupport.title,
    bodyKey: lessonZeroMessageKeys.steps.cameraSupport.body,
    cueKey: lessonZeroMessageKeys.steps.cameraSupport.cue,
    anatomyTargets: ["camera-support"],
    inspectionTarget: "camera-support",
    rearBackMode: "ground-glass",
  },
  {
    id: "recap",
    section: "anatomy",
    titleKey: lessonZeroMessageKeys.steps.recap.title,
    bodyKey: lessonZeroMessageKeys.steps.recap.body,
    cueKey: lessonZeroMessageKeys.steps.recap.cue,
    anatomyTargets: [],
    inspectionTarget: "whole-camera",
    rearBackMode: "ground-glass",
  },
  {
    id: "controls-overview",
    section: "controls",
    titleKey: lessonZeroMessageKeys.steps.controlsOverview.title,
    bodyKey: lessonZeroMessageKeys.steps.controlsOverview.body,
    cueKey: lessonZeroMessageKeys.steps.controlsOverview.cue,
    anatomyTargets: [],
    inspectionTarget: "whole-camera",
    rearBackMode: "ground-glass",
  },
  {
    id: "front-rise-control",
    section: "controls",
    titleKey: lessonZeroMessageKeys.steps.frontRiseControl.title,
    bodyKey: lessonZeroMessageKeys.steps.frontRiseControl.body,
    cueKey: lessonZeroMessageKeys.steps.frontRiseControl.cue,
    anatomyTargets: [],
    inspectionTarget: "front-standard",
    rearBackMode: "ground-glass",
    controlTeachingId: "front-rise",
  },
  {
    id: "front-shift-control",
    section: "controls",
    titleKey: lessonZeroMessageKeys.steps.frontShiftControl.title,
    bodyKey: lessonZeroMessageKeys.steps.frontShiftControl.body,
    cueKey: lessonZeroMessageKeys.steps.frontShiftControl.cue,
    anatomyTargets: [],
    inspectionTarget: "front-standard",
    rearBackMode: "ground-glass",
    controlTeachingId: "front-shift",
  },
  {
    id: "front-tilt-control",
    section: "controls",
    titleKey: lessonZeroMessageKeys.steps.frontTiltControl.title,
    bodyKey: lessonZeroMessageKeys.steps.frontTiltControl.body,
    cueKey: lessonZeroMessageKeys.steps.frontTiltControl.cue,
    anatomyTargets: [],
    inspectionTarget: "front-standard",
    rearBackMode: "ground-glass",
    controlTeachingId: "front-tilt",
  },
  {
    id: "front-swing-control",
    section: "controls",
    titleKey: lessonZeroMessageKeys.steps.frontSwingControl.title,
    bodyKey: lessonZeroMessageKeys.steps.frontSwingControl.body,
    cueKey: lessonZeroMessageKeys.steps.frontSwingControl.cue,
    anatomyTargets: [],
    inspectionTarget: "front-standard",
    rearBackMode: "ground-glass",
    controlTeachingId: "front-swing",
  },
  {
    id: "focus-front-control",
    section: "controls",
    titleKey: lessonZeroMessageKeys.steps.focusFrontControl.title,
    bodyKey: lessonZeroMessageKeys.steps.focusFrontControl.body,
    cueKey: lessonZeroMessageKeys.steps.focusFrontControl.cue,
    anatomyTargets: [],
    inspectionTarget: "front-standard",
    rearBackMode: "ground-glass",
    controlTeachingId: "focus-front",
  },
  {
    id: "focus-rear-control",
    section: "controls",
    titleKey: lessonZeroMessageKeys.steps.focusRearControl.title,
    bodyKey: lessonZeroMessageKeys.steps.focusRearControl.body,
    cueKey: lessonZeroMessageKeys.steps.focusRearControl.cue,
    anatomyTargets: [],
    inspectionTarget: "rear-standard",
    rearBackMode: "ground-glass",
    controlTeachingId: "focus-rear",
  },
  {
    id: "aperture-control",
    section: "controls",
    titleKey: lessonZeroMessageKeys.steps.apertureControl.title,
    bodyKey: lessonZeroMessageKeys.steps.apertureControl.body,
    cueKey: lessonZeroMessageKeys.steps.apertureControl.cue,
    anatomyTargets: [],
    inspectionTarget: "aperture",
    rearBackMode: "ground-glass",
    controlTeachingId: "aperture",
  },
  {
    id: "controls-recap",
    section: "controls",
    titleKey: lessonZeroMessageKeys.steps.controlsRecap.title,
    bodyKey: lessonZeroMessageKeys.steps.controlsRecap.body,
    cueKey: lessonZeroMessageKeys.steps.controlsRecap.cue,
    anatomyTargets: [],
    inspectionTarget: "whole-camera",
    rearBackMode: "ground-glass",
  },
];

export const getLessonZeroStep = (index: number): LessonZeroStep =>
  LESSON_ZERO_STEPS[Math.min(Math.max(0, index), LESSON_ZERO_STEPS.length - 1)];

export const resolveLessonZeroCameraPresentation = (
  step: LessonZeroStep,
  showSmallAperture = false,
): ConceptualCameraPresentation => {
  const controlTargets = step.controlTeachingId
    ? CAMERA_CONTROL_TEACHING[step.controlTeachingId].anatomyTargets
    : [];
  const anatomyTargets = [...step.anatomyTargets, ...controlTargets];

  return {
    anatomy: {
      targets: anatomyTargets.flatMap(
        (target) => LESSON_ZERO_ANATOMY[target].semanticTargets,
      ),
    },
    rearBackMode: step.rearBackMode,
    ...(step.id === "aperture"
      ? { aperture: showSmallAperture ? 32 : 5.6 }
      : {}),
  };
};

/**
 * Anatomy steps may inspect a moving part directly. Control and focus steps
 * keep the observer anchored to the stable generic camera datum so local
 * standard movement remains visible against the rest of the camera. Aperture
 * keeps its close lens view because changing the opening does not move the
 * lens assembly.
 */
export const resolveLessonZeroViewportInspectionTarget = (
  step: LessonZeroStep,
): CameraInspectionTarget | undefined =>
  step.section === "controls" &&
  step.controlTeachingId !== undefined &&
  step.controlTeachingId !== "aperture"
    ? undefined
    : step.inspectionTarget;

export const isLessonZeroStepComplete = (
  step: LessonZeroStep,
  camera: CameraState,
): boolean =>
  step.controlTeachingId === undefined ||
  resolveCameraControlTeachingCompletion(step.controlTeachingId, camera);

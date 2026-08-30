import { lessonZeroMessageKeys, type LessonZeroMessageKey } from "../i18n/lessonZeroMessageKeys";
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

type LessonZeroStepId =
  | "complete-camera"
  | "front-standard"
  | "lens-and-board"
  | "aperture"
  | "bellows"
  | "rear-standard"
  | "ground-glass"
  | "film-holder"
  | "camera-support"
  | "recap";

export type LessonZeroStep = {
  id: LessonZeroStepId;
  titleKey: LessonZeroMessageKey;
  bodyKey: LessonZeroMessageKey;
  cueKey: LessonZeroMessageKey;
  anatomyTargets: readonly LessonZeroAnatomyTarget[];
  inspectionTarget: CameraInspectionTarget;
  rearBackMode: ConceptualRearBackMode;
};

export const LESSON_ZERO_STEPS: readonly LessonZeroStep[] = [
  {
    id: "complete-camera",
    titleKey: lessonZeroMessageKeys.steps.completeCamera.title,
    bodyKey: lessonZeroMessageKeys.steps.completeCamera.body,
    cueKey: lessonZeroMessageKeys.steps.completeCamera.cue,
    anatomyTargets: [],
    inspectionTarget: "whole-camera",
    rearBackMode: "ground-glass",
  },
  {
    id: "front-standard",
    titleKey: lessonZeroMessageKeys.steps.frontStandard.title,
    bodyKey: lessonZeroMessageKeys.steps.frontStandard.body,
    cueKey: lessonZeroMessageKeys.steps.frontStandard.cue,
    anatomyTargets: ["front-standard"],
    inspectionTarget: "front-standard",
    rearBackMode: "ground-glass",
  },
  {
    id: "lens-and-board",
    titleKey: lessonZeroMessageKeys.steps.lensAndBoard.title,
    bodyKey: lessonZeroMessageKeys.steps.lensAndBoard.body,
    cueKey: lessonZeroMessageKeys.steps.lensAndBoard.cue,
    anatomyTargets: ["lens", "lens-board"],
    inspectionTarget: "lens-board",
    rearBackMode: "ground-glass",
  },
  {
    id: "aperture",
    titleKey: lessonZeroMessageKeys.steps.aperture.title,
    bodyKey: lessonZeroMessageKeys.steps.aperture.body,
    cueKey: lessonZeroMessageKeys.steps.aperture.cue,
    anatomyTargets: ["aperture"],
    inspectionTarget: "aperture",
    rearBackMode: "ground-glass",
  },
  {
    id: "bellows",
    titleKey: lessonZeroMessageKeys.steps.bellows.title,
    bodyKey: lessonZeroMessageKeys.steps.bellows.body,
    cueKey: lessonZeroMessageKeys.steps.bellows.cue,
    anatomyTargets: ["bellows"],
    inspectionTarget: "bellows",
    rearBackMode: "ground-glass",
  },
  {
    id: "rear-standard",
    titleKey: lessonZeroMessageKeys.steps.rearStandard.title,
    bodyKey: lessonZeroMessageKeys.steps.rearStandard.body,
    cueKey: lessonZeroMessageKeys.steps.rearStandard.cue,
    anatomyTargets: ["rear-standard"],
    inspectionTarget: "rear-standard",
    rearBackMode: "ground-glass",
  },
  {
    id: "ground-glass",
    titleKey: lessonZeroMessageKeys.steps.groundGlass.title,
    bodyKey: lessonZeroMessageKeys.steps.groundGlass.body,
    cueKey: lessonZeroMessageKeys.steps.groundGlass.cue,
    anatomyTargets: ["ground-glass"],
    inspectionTarget: "ground-glass",
    rearBackMode: "ground-glass",
  },
  {
    id: "film-holder",
    titleKey: lessonZeroMessageKeys.steps.filmHolder.title,
    bodyKey: lessonZeroMessageKeys.steps.filmHolder.body,
    cueKey: lessonZeroMessageKeys.steps.filmHolder.cue,
    anatomyTargets: ["film-holder"],
    inspectionTarget: "film-holder",
    rearBackMode: "film-holder",
  },
  {
    id: "camera-support",
    titleKey: lessonZeroMessageKeys.steps.cameraSupport.title,
    bodyKey: lessonZeroMessageKeys.steps.cameraSupport.body,
    cueKey: lessonZeroMessageKeys.steps.cameraSupport.cue,
    anatomyTargets: ["camera-support"],
    inspectionTarget: "camera-support",
    rearBackMode: "ground-glass",
  },
  {
    id: "recap",
    titleKey: lessonZeroMessageKeys.steps.recap.title,
    bodyKey: lessonZeroMessageKeys.steps.recap.body,
    cueKey: lessonZeroMessageKeys.steps.recap.cue,
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
): ConceptualCameraPresentation => ({
  anatomy: {
    targets: step.anatomyTargets.flatMap(
      (target) => LESSON_ZERO_ANATOMY[target].semanticTargets,
    ),
  },
  rearBackMode: step.rearBackMode,
  ...(step.id === "aperture"
    ? { aperture: showSmallAperture ? 32 : 5.6 }
    : {}),
});

import tableTiltGeometry from "../../scenes/tableTiltGeometry";
import shelfSwingGeometry from "../../scenes/shelfSwingGeometry";
import { guidedTaskMessageKeys, type GuidedTaskMessageKey } from "../../i18n/guidedTaskMessageKeys";
import type { MessageRef, MessageValues, TaskDefinition, TaskSuccessCriterion } from "../../types/task";

export type GuidedTaskMessageRef = MessageRef<GuidedTaskMessageKey>;

type GuidedTaskFeedbackKeyMap = {
  passPrimary: GuidedTaskMessageKey;
  passSecondary?: GuidedTaskMessageKey;
  defaultFailPrimary: GuidedTaskMessageKey;
  primary: Record<string, GuidedTaskMessageKey>;
  secondary: Record<string, GuidedTaskMessageKey>;
};

type GuidedTaskCopyKeyMap = {
  title: GuidedTaskMessageKey;
  objective: GuidedTaskMessageKey;
  notes: readonly GuidedTaskMessageKey[];
  criteria: Record<string, GuidedTaskMessageKey>;
  feedback: GuidedTaskFeedbackKeyMap;
};

export type GuidedTaskCopy = {
  title: GuidedTaskMessageRef;
  objective: GuidedTaskMessageRef;
  notes: GuidedTaskMessageRef[];
  criteria: Record<string, GuidedTaskMessageRef>;
  feedback: {
    passPrimary: GuidedTaskMessageRef;
    passSecondary?: GuidedTaskMessageRef;
    defaultFailPrimary: GuidedTaskMessageRef;
    primary: Record<string, GuidedTaskMessageRef>;
    secondary: Record<string, GuidedTaskMessageRef>;
  };
};

const k = guidedTaskMessageKeys;

export const guidedTaskCopyKeyMap: Record<string, GuidedTaskCopyKeyMap> = {
  "rise-01": {
    title: k.rise.title,
    objective: k.rise.objective,
    notes: [k.rise.notes.useRise, k.rise.notes.levelGeometry],
    criteria: {
      "rise-building-top-visible": k.rise.criteria.buildingTopVisible,
      "rise-building-main-visible": k.rise.criteria.buildingMainVisible,
      "rise-movement-used": k.rise.criteria.movementUsed,
      "rise-movement-range": k.rise.criteria.movementRange,
    },
    feedback: {
      passPrimary: k.rise.feedback.passPrimary,
      defaultFailPrimary: k.rise.feedback.defaultFailPrimary,
      primary: {
        "rise-building-top-visible": k.rise.feedback.primary.buildingTopVisible,
        "rise-building-main-visible": k.rise.feedback.primary.buildingMainVisible,
        "rise-movement-used": k.rise.feedback.primary.movementUsed,
        "rise-movement-range": k.rise.feedback.primary.movementRange,
      },
      secondary: {
        "rise-building-top-visible": k.rise.feedback.secondary.buildingTopVisible,
        "rise-building-main-visible": k.rise.feedback.secondary.buildingMainVisible,
        "rise-movement-used": k.rise.feedback.secondary.movementUsed,
        "rise-movement-range": k.rise.feedback.secondary.movementRange,
      },
    },
  },
  "oblique-rise-01": {
    title: k.obliqueRise.title,
    objective: k.obliqueRise.objective,
    notes: [k.obliqueRise.notes.useRise, k.obliqueRise.notes.keepBase, k.obliqueRise.notes.depth],
    criteria: {
      "oblique-rise-building-top-visible": k.obliqueRise.criteria.buildingTopVisible,
      "oblique-rise-building-base-visible": k.obliqueRise.criteria.buildingBaseVisible,
      "oblique-rise-camera-level": k.obliqueRise.criteria.cameraLevel,
      "oblique-rise-movement-used": k.obliqueRise.criteria.movementUsed,
    },
    feedback: {
      passPrimary: k.obliqueRise.feedback.passPrimary,
      defaultFailPrimary: k.obliqueRise.feedback.defaultFailPrimary,
      primary: {
        "oblique-rise-building-top-visible": k.obliqueRise.feedback.primary.buildingTopVisible,
        "oblique-rise-building-base-visible": k.obliqueRise.feedback.primary.buildingBaseVisible,
        "oblique-rise-camera-level": k.obliqueRise.feedback.primary.cameraLevel,
        "oblique-rise-movement-used": k.obliqueRise.feedback.primary.movementUsed,
      },
      secondary: {
        "oblique-rise-building-top-visible": k.obliqueRise.feedback.secondary.buildingTopVisible,
        "oblique-rise-building-base-visible": k.obliqueRise.feedback.secondary.buildingBaseVisible,
        "oblique-rise-camera-level": k.obliqueRise.feedback.secondary.cameraLevel,
        "oblique-rise-movement-used": k.obliqueRise.feedback.secondary.movementUsed,
      },
    },
  },
  "tilt-01": {
    title: k.tableTilt.title,
    objective: k.tableTilt.objective,
    notes: [k.tableTilt.notes.focusAndTilt, k.tableTilt.notes.constraints],
    criteria: {
      "tilt-allowed-aperture": k.tableTilt.criteria.allowedAperture,
      "tilt-rise-zero": k.tableTilt.criteria.riseZero,
      "tilt-swing-zero": k.tableTilt.criteria.swingZero,
      "tilt-movement-range": k.tableTilt.criteria.movementRange,
      "tilt-near-sharp": k.tableTilt.criteria.nearSharp,
      "tilt-mid-sharp": k.tableTilt.criteria.midSharp,
      "tilt-far-sharp": k.tableTilt.criteria.farSharp,
    },
    feedback: {
      passPrimary: k.tableTilt.feedback.passPrimary,
      defaultFailPrimary: k.tableTilt.feedback.defaultFailPrimary,
      primary: {
        "tilt-allowed-aperture": k.tableTilt.feedback.primary.allowedAperture,
        "tilt-rise-zero": k.tableTilt.feedback.primary.riseZero,
        "tilt-swing-zero": k.tableTilt.feedback.primary.swingZero,
        "tilt-movement-range": k.tableTilt.feedback.primary.movementRange,
        "tilt-near-sharp": k.tableTilt.feedback.primary.nearSharp,
        "tilt-mid-sharp": k.tableTilt.feedback.primary.midSharp,
        "tilt-far-sharp": k.tableTilt.feedback.primary.farSharp,
      },
      secondary: {
        "tilt-allowed-aperture": k.tableTilt.feedback.secondary.allowedAperture,
        "tilt-rise-zero": k.tableTilt.feedback.secondary.riseZero,
        "tilt-swing-zero": k.tableTilt.feedback.secondary.swingZero,
        "tilt-movement-range": k.tableTilt.feedback.secondary.movementRange,
        "tilt-near-sharp": k.tableTilt.feedback.secondary.nearSharp,
        "tilt-mid-sharp": k.tableTilt.feedback.secondary.midSharp,
        "tilt-far-sharp": k.tableTilt.feedback.secondary.farSharp,
      },
    },
  },
  "swing-01": {
    title: k.shelfSwing.title,
    objective: k.shelfSwing.objective,
    notes: [k.shelfSwing.notes.focusAndSwing, k.shelfSwing.notes.constraints],
    criteria: {
      "swing-allowed-aperture": k.shelfSwing.criteria.allowedAperture,
      "swing-rise-zero": k.shelfSwing.criteria.riseZero,
      "swing-tilt-zero": k.shelfSwing.criteria.tiltZero,
      "swing-movement-range": k.shelfSwing.criteria.movementRange,
      "swing-front-sharp": k.shelfSwing.criteria.frontSharp,
      "swing-middle-sharp": k.shelfSwing.criteria.middleSharp,
      "swing-back-sharp": k.shelfSwing.criteria.backSharp,
    },
    feedback: {
      passPrimary: k.shelfSwing.feedback.passPrimary,
      defaultFailPrimary: k.shelfSwing.feedback.defaultFailPrimary,
      primary: {
        "swing-allowed-aperture": k.shelfSwing.feedback.primary.allowedAperture,
        "swing-rise-zero": k.shelfSwing.feedback.primary.riseZero,
        "swing-tilt-zero": k.shelfSwing.feedback.primary.tiltZero,
        "swing-movement-range": k.shelfSwing.feedback.primary.movementRange,
        "swing-front-sharp": k.shelfSwing.feedback.primary.frontSharp,
        "swing-middle-sharp": k.shelfSwing.feedback.primary.middleSharp,
        "swing-back-sharp": k.shelfSwing.feedback.primary.backSharp,
      },
      secondary: {
        "swing-allowed-aperture": k.shelfSwing.feedback.secondary.allowedAperture,
        "swing-rise-zero": k.shelfSwing.feedback.secondary.riseZero,
        "swing-tilt-zero": k.shelfSwing.feedback.secondary.tiltZero,
        "swing-movement-range": k.shelfSwing.feedback.secondary.movementRange,
        "swing-front-sharp": k.shelfSwing.feedback.secondary.frontSharp,
        "swing-middle-sharp": k.shelfSwing.feedback.secondary.middleSharp,
        "swing-back-sharp": k.shelfSwing.feedback.secondary.backSharp,
      },
    },
  },
  "mirror-shift-01": {
    title: k.mirrorShift.title,
    objective: k.mirrorShift.objective,
    notes: [
      k.mirrorShift.notes.clearReflection,
      k.mirrorShift.notes.restoreFraming,
      k.mirrorShift.notes.retainViewpoint,
    ],
    criteria: {
      "mirror-reflection-clear": k.mirrorShift.criteria.reflectionClear,
      "mirror-framing-restored": k.mirrorShift.criteria.framingRestored,
      "mirror-viewpoint-retained": k.mirrorShift.criteria.viewpointRetained,
    },
    feedback: {
      passPrimary: k.mirrorShift.feedback.passPrimary,
      passSecondary: k.mirrorShift.feedback.passSecondary,
      defaultFailPrimary: k.mirrorShift.feedback.defaultFailPrimary,
      primary: {
        "mirror-reflection-clear": k.mirrorShift.feedback.primary.reflectionClear,
        "mirror-framing-restored": k.mirrorShift.feedback.primary.framingRestored,
        "mirror-viewpoint-retained": k.mirrorShift.feedback.primary.viewpointRetained,
      },
      secondary: {
        "mirror-reflection-clear": k.mirrorShift.feedback.secondary.reflectionClear,
        "mirror-framing-restored": k.mirrorShift.feedback.secondary.framingRestored,
        "mirror-viewpoint-retained": k.mirrorShift.feedback.secondary.viewpointRetained,
      },
    },
  },
};

const genericCopyKeyMap: GuidedTaskCopyKeyMap = {
  title: k.common.guidedTask,
  objective: k.common.waitingForEvaluation,
  notes: [],
  criteria: {},
  feedback: {
    passPrimary: k.common.genericPassPrimary,
    defaultFailPrimary: k.common.genericFailPrimary,
    primary: {},
    secondary: {},
  },
};

const ref = (key: GuidedTaskMessageKey, values?: MessageValues): GuidedTaskMessageRef =>
  values ? { key, values } : { key };

const criterionValues = (criterion: TaskSuccessCriterion): MessageValues | undefined => {
  switch (criterion.type) {
    case "composition-visible":
      return { coverage: Math.round(criterion.minimumCoverage * 100) };
    case "movement-range":
      return { min: criterion.min, max: criterion.max };
    default:
      return undefined;
  }
};

const feedbackValues = (task: TaskDefinition, criterionId: string): MessageValues | undefined => {
  const criterion = task.criteria.find((entry) => entry.id === criterionId);
  if (criterionId === "tilt-movement-range") {
    return { tiltDeg: tableTiltGeometry.tableTiltCalibration.frontTiltDeg };
  }
  if (criterionId === "swing-movement-range") {
    return { swingDeg: shelfSwingGeometry.shelfSwingCalibration.frontSwingDeg.toFixed(1) };
  }
  if (criterion?.type === "movement-range" && criterionId.endsWith("movement-range")) {
    return { min: criterion.min, max: criterion.max };
  }
  return undefined;
};

const refsFor = (
  task: TaskDefinition,
  values: Record<string, GuidedTaskMessageKey>,
): Record<string, GuidedTaskMessageRef> =>
  Object.fromEntries(
    Object.entries(values).map(([criterionId, key]) => [
      criterionId,
      ref(key, feedbackValues(task, criterionId)),
    ]),
  );

export const getGuidedTaskCopy = (task: TaskDefinition): GuidedTaskCopy => {
  const copyKeys = guidedTaskCopyKeyMap[task.id] ?? genericCopyKeyMap;
  const criteria = Object.fromEntries(
    task.criteria.map((criterion) => [
      criterion.id,
      ref(copyKeys.criteria[criterion.id] ?? k.common.genericCriterion, criterionValues(criterion)),
    ]),
  );
  const primary = refsFor(task, copyKeys.feedback.primary);
  const secondary = refsFor(task, copyKeys.feedback.secondary);
  if (!guidedTaskCopyKeyMap[task.id]) {
    task.criteria.forEach((criterion) => {
      primary[criterion.id] = getCriterionResultMessageRef(criterion, false);
      secondary[criterion.id] = ref(k.common.genericSecondary);
    });
  }
  return {
    title: ref(copyKeys.title),
    objective: ref(copyKeys.objective),
    notes: copyKeys.notes.map((key) => ref(key)),
    criteria,
    feedback: {
      passPrimary: ref(copyKeys.feedback.passPrimary),
      passSecondary: copyKeys.feedback.passSecondary
        ? ref(copyKeys.feedback.passSecondary)
        : undefined,
      defaultFailPrimary: ref(copyKeys.feedback.defaultFailPrimary),
      primary,
      secondary,
    },
  };
};

export const getCriterionResultMessageRef = (
  criterion: TaskSuccessCriterion,
  passed: boolean,
): GuidedTaskMessageRef => {
  const variant = passed ? "pass" : "fail";
  switch (criterion.type) {
    case "focus-targets-sharp":
      return ref(k.results.focusTargetsSharp[variant]);
    case "movement-used":
      return ref(k.results.movementUsed[criterion.movement][variant]);
    case "movement-range":
      return ref(k.results.movementRange[criterion.movement][variant]);
    case "allowed-aperture":
      return ref(k.results.allowedAperture[variant]);
    case "composition-visible":
      return ref(k.results.compositionVisible[variant]);
    case "camera-level":
      return ref(k.results.cameraLevel[variant]);
    case "mirror-reflection-clear":
      return ref(k.results.mirrorReflectionClear[variant]);
    case "mirror-framing-restored":
      return ref(k.results.mirrorFramingRestored[variant]);
    case "mirror-viewpoint-retained":
      return ref(k.results.mirrorViewpointRetained[variant]);
  }
};

export type GuidedControlId = TaskDefinition["enabledControls"][number];

export const getGuidedControlMessageKey = (controlId: GuidedControlId): GuidedTaskMessageKey =>
  guidedTaskMessageKeys.controls[controlId];

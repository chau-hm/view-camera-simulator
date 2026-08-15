import { UI_COPY } from "../../ui/copy";
import type { TaskEvaluation, TaskCriteriaEvaluation } from "../../types/task";
import {
  simulatorMessageKeys,
  type FreePracticeMessageKey,
} from "../../i18n/simulatorMessageKeys";

export function formatControlLabel(controlId: string): string {
  const map: Record<string, string> = {
    focusDistance: "Focus",
    aperture: "Aperture",
    rise: "Rise",
    tilt: "Tilt",
    swing: "Swing",
    focusAssist: "Focus Assist",
    grid: "Grid",
    geometryView: "2D Geometry",
    cameraPosition: "Camera Position",
    frontShift: "Front Shift",
  };
  return map[controlId] ?? controlId;
}

export type FreePracticeGuidanceKeys = {
  objectiveKey: FreePracticeMessageKey;
  bulletKeys: readonly FreePracticeMessageKey[];
};

export type FreePracticeFeedbackKey = {
  observationKey: FreePracticeMessageKey;
};

const genericGuidance: FreePracticeGuidanceKeys = {
  objectiveKey: simulatorMessageKeys.freePractice.generic.objective,
  bulletKeys: [],
};

const guidanceByScene: Record<string, FreePracticeGuidanceKeys> = {
  "understanding-camera-movements": {
    objectiveKey: simulatorMessageKeys.freePractice.understanding.objective,
    bulletKeys: [
      simulatorMessageKeys.freePractice.understanding.bullets.viewpoint,
      simulatorMessageKeys.freePractice.understanding.bullets.tilt,
      simulatorMessageKeys.freePractice.understanding.bullets.verticalFraming,
      simulatorMessageKeys.freePractice.understanding.bullets.compare,
    ],
  },
  "focus-fundamentals-two-targets": {
    objectiveKey: simulatorMessageKeys.freePractice.focusFundamentals.objective,
    bulletKeys: [
      simulatorMessageKeys.freePractice.focusFundamentals.bullets.focusDistance,
      simulatorMessageKeys.freePractice.focusFundamentals.bullets.readouts,
      simulatorMessageKeys.freePractice.focusFundamentals.bullets.compare,
    ],
  },
  "architecture-rise": {
    objectiveKey: simulatorMessageKeys.freePractice.architectureRise.objective,
    bulletKeys: [
      simulatorMessageKeys.freePractice.architectureRise.bullets.rise,
      simulatorMessageKeys.freePractice.architectureRise.bullets.level,
      simulatorMessageKeys.freePractice.architectureRise.bullets.focus,
    ],
  },
  "table-tilt": {
    objectiveKey: simulatorMessageKeys.freePractice.tableTilt.objective,
    bulletKeys: [
      simulatorMessageKeys.freePractice.tableTilt.bullets.focus,
      simulatorMessageKeys.freePractice.tableTilt.bullets.tilt,
      simulatorMessageKeys.freePractice.tableTilt.bullets.patches,
      simulatorMessageKeys.freePractice.tableTilt.bullets.aperture,
    ],
  },
  "shelf-swing": {
    objectiveKey: simulatorMessageKeys.freePractice.shelfSwing.objective,
    bulletKeys: [
      simulatorMessageKeys.freePractice.shelfSwing.bullets.start,
      simulatorMessageKeys.freePractice.shelfSwing.bullets.geometry,
      simulatorMessageKeys.freePractice.shelfSwing.bullets.refine,
      simulatorMessageKeys.freePractice.shelfSwing.bullets.compare,
    ],
  },
  "mirror-shift": {
    objectiveKey: simulatorMessageKeys.freePractice.mirrorShift.objective,
    bulletKeys: [
      simulatorMessageKeys.freePractice.mirrorShift.bullets.position,
      simulatorMessageKeys.freePractice.mirrorShift.bullets.viewpoint,
      simulatorMessageKeys.freePractice.mirrorShift.bullets.framing,
      simulatorMessageKeys.freePractice.mirrorShift.bullets.parallax,
    ],
  },
};

export function getFreePracticeGuidanceKeys(sceneId: string | undefined): FreePracticeGuidanceKeys {
  return (sceneId && guidanceByScene[sceneId]) || genericGuidance;
}

const genericFeedback: FreePracticeFeedbackKey = {
  observationKey: simulatorMessageKeys.freePractice.generic.observation,
};

const feedbackByScene: Record<string, FreePracticeFeedbackKey> = {
  "understanding-camera-movements": {
    observationKey: simulatorMessageKeys.freePractice.understanding.observation,
  },
  "focus-fundamentals-two-targets": {
    observationKey: simulatorMessageKeys.freePractice.focusFundamentals.observation,
  },
  "architecture-rise": {
    observationKey: simulatorMessageKeys.freePractice.architectureRise.observation,
  },
  "table-tilt": {
    observationKey: simulatorMessageKeys.freePractice.tableTilt.observation,
  },
  "shelf-swing": {
    observationKey: simulatorMessageKeys.freePractice.shelfSwing.observation,
  },
  "mirror-shift": {
    observationKey: simulatorMessageKeys.freePractice.mirrorShift.observation,
  },
};

export function getFreePracticeFeedbackKey(sceneId: string | undefined): FreePracticeFeedbackKey {
  return (sceneId && feedbackByScene[sceneId]) || genericFeedback;
}

export function getFeedbackStatus(mode: string, evaluation: TaskEvaluation | null): string {
  if (mode !== "guided") return UI_COPY.simulator.noScoredTask || "No scored task";
  if (!evaluation) return UI_COPY.simulator.notStarted || "Not started";
  if (evaluation.status === "passed") return UI_COPY.simulator.completed || "Completed";
  return UI_COPY.simulator.inProgress || "In progress";
}

export function getPassedCriteriaCount(evaluation: TaskEvaluation | null): {
  passed: number;
  total: number;
} {
  if (!evaluation) return { passed: 0, total: 0 };
  const total = evaluation.criteria.length;
  const passed = evaluation.criteria.filter((c) => c.passed).length;
  return { passed, total };
}

export function getPrimaryFailedCriterion(
  evaluation: TaskEvaluation | null,
): TaskCriteriaEvaluation | null {
  if (!evaluation) return null;
  const failed = evaluation.criteria.find((c) => !c.passed);
  return failed ?? null;
}

export function formatFinalCameraState(finalState?: {
  frontRiseMm?: number;
  frontTiltDeg?: number;
  frontSwingDeg?: number;
  focusDistanceMm?: number;
  aperture?: number;
  frontShiftMm?: number;
  mirrorShiftLessonState?: { rigLateralMm?: number };
} | null): string {
  if (!finalState) return "";
  const mirrorShiftSummary = finalState.mirrorShiftLessonState || finalState.frontShiftMm !== undefined
    ? ` · Camera Position ${finalState.mirrorShiftLessonState?.rigLateralMm ?? 0} mm · Front Shift ${finalState.frontShiftMm ?? 0} mm`
    : "";
  return `Rise ${finalState.frontRiseMm ?? 0} mm · Tilt ${finalState.frontTiltDeg ?? 0}° · Swing ${finalState.frontSwingDeg ?? 0}° · Focus ${finalState.focusDistanceMm ?? 0} mm · Aperture f/${finalState.aperture ?? 11}${mirrorShiftSummary}`;
}

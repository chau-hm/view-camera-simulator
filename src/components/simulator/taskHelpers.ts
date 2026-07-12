import { UI_COPY } from "../../ui/copy";
import type { TaskEvaluation, TaskCriteriaEvaluation } from "../../types/task";

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
  };
  return map[controlId] ?? controlId;
}

export function getFreePracticeGuidance(sceneId: string | undefined): {
  heading: string;
  intro: string;
  bullets: string[];
} {
  const intro = UI_COPY.simulator.freePracticeIntro || "Explore the scene without a scored task.";
  const defaults = {
    "architecture-rise": [
      "Raise the front standard to include more of the building.",
      "Keep tilt and swing at zero to preserve parallel verticals.",
      "Adjust focus and aperture to compare sharpness and depth of field.",
    ],
    "focus-fundamentals-two-targets": [
      "Move focus between the near and far target.",
      "Change aperture to compare depth of field.",
      "Use Focus Assist to compare target sharpness.",
    ],
  } as Record<string, string[]>;

  return {
    heading: UI_COPY.simulator.freePractice || "Free practice",
    intro,
    bullets: sceneId && defaults[sceneId] ? defaults[sceneId] : [],
  };
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

export function formatFinalCameraState(finalState?: { frontRiseMm?: number; frontTiltDeg?: number; frontSwingDeg?: number; focusDistanceMm?: number; aperture?: number } | null): string {
  if (!finalState) return "";
  return `Rise ${finalState.frontRiseMm ?? 0} mm · Tilt ${finalState.frontTiltDeg ?? 0}° · Swing ${finalState.frontSwingDeg ?? 0}° · Focus ${finalState.focusDistanceMm ?? 0} mm · Aperture f/${finalState.aperture ?? 11}`;
}

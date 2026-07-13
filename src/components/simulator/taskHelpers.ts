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

export type FreePracticeGuidance = {
  objective: string;
  bullets: string[];
};

export function getFreePracticeGuidance(sceneId: string | undefined): FreePracticeGuidance {
  const genericObjective = UI_COPY.simulator.freePracticeIntro || "Explore the scene without a scored task.";
  const defaults: Record<string, FreePracticeGuidance> = {
    "architecture-rise": {
      objective: "Explore how front rise changes the framing while the camera remains level.",
      bullets: [
        "Increase Rise to include more of the building.",
        "Keep Tilt and Swing at 0° to preserve parallel vertical lines.",
        "Adjust Focus and Aperture to compare sharpness and depth of field.",
      ],
    },
    "focus-fundamentals-two-targets": {
      objective: "Explore how focus distance and aperture affect two targets at different distances.",
      bullets: [
        "Move focus between the near and far target.",
        "Change Aperture to compare depth of field.",
        "Use Focus Assist to compare target sharpness.",
      ],
    },
    "table-tilt": {
      objective:
        "Use front tilt and focus to bring the near cup, middle notebook and far book into a shared plane of focus.",
      bullets: [
        "Start by focusing on the middle notebook.",
        "Apply positive front tilt and watch the focus plane move toward the tabletop.",
        "Refine focus until all three visible detail targets improve.",
        "Compare f/11 and f/22, but do not rely on f/32 to solve the exercise.",
      ],
    },
  };

  if (sceneId && defaults[sceneId]) return defaults[sceneId];
  return { objective: genericObjective, bullets: [] };
}

export function getFreePracticeFeedback(sceneId: string | undefined): { observation: string } {
  const generic = { observation: UI_COPY.simulator.changesReflected || 'Changes are reflected immediately in the 3D Scene, Ground Glass, Current Settings, and Focus Targets.' };
  const map: Record<string, { observation: string }> = {
    "architecture-rise": { observation: 'Watch the top of the building as Rise changes. The framing should move upward while the vertical edges remain parallel.' },
    "focus-fundamentals-two-targets": { observation: 'Watch the target sharpness bars as Focus distance and Aperture change.' },
    "table-tilt": {
      observation:
        "In 3D and the side-view diagram, watch the green focus plane rotate toward the horizontal probe height and the blue depth-of-field region widen at f/22. On Ground Glass, compare blur in the cup stripe, notebook lines and book checker chart; the Focus Targets readout should improve for all three together.",
    },
  };

  return (sceneId && map[sceneId]) ? map[sceneId] : generic;
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

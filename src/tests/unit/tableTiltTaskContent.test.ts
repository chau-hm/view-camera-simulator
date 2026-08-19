import { describe, expect, it } from "vitest";
import { getGuidedTaskCopy } from "../../core/tasks/guidedTaskCopyKeys";
import tableTiltGeometry from "../../scenes/tableTiltGeometry";
import {
  getFreePracticeFeedbackKey,
  getFreePracticeGuidanceKeys,
} from "../../components/simulator/taskHelpers";
import { getTaskById } from "../../core/tasks/taskRegistry";

describe("Table Tilt lesson content", () => {
  it("provides scene-specific free-practice guidance", () => {
    const guidance = getFreePracticeGuidanceKeys("table-tilt");
    expect(guidance.objectiveKey).toBe("simulator.freePractice.tableTilt.objective");
    expect(guidance.bulletKeys).toEqual([
      "simulator.freePractice.tableTilt.bullets.focus",
      "simulator.freePractice.tableTilt.bullets.tilt",
      "simulator.freePractice.tableTilt.bullets.patches",
      "simulator.freePractice.tableTilt.bullets.aperture",
    ]);
  });

  it("returns a scene-specific observation key", () => {
    expect(getFreePracticeFeedbackKey("table-tilt").observationKey).toBe(
      "simulator.freePractice.tableTilt.observation",
    );
  });

  it("describes the recalibrated guided solution without obsolete thresholds", () => {
    const task = getTaskById("tilt-01")!;
    const copy = getGuidedTaskCopy(task);
    expect(copy.title.key).toBe("tasks.tableTilt.title");
    expect(copy.objective.key).toBe("tasks.tableTilt.objective");
    expect(copy.notes).toEqual([
      { key: "tasks.tableTilt.notes.focusAndTilt" },
      { key: "tasks.tableTilt.notes.constraints" },
    ]);
    expect(copy.criteria["tilt-movement-range"]?.values).toEqual({
      min: tableTiltGeometry.tableTiltCalibration.allowedTiltMinDeg,
      max: tableTiltGeometry.tableTiltCalibration.allowedTiltMaxDeg,
    });
    expect(copy.feedback.primary["tilt-movement-range"]?.values).toEqual({
      tiltDeg: tableTiltGeometry.tableTiltCalibration.frontTiltDeg,
    });
    expect(copy.feedback.primary["tilt-movement-range"]?.key).toBe(
      "tasks.tableTilt.feedback.primary.movementRange",
    );
  });
});

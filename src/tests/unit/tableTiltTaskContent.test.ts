import { describe, expect, it } from "vitest";
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
    const allCopy = [
      ...task.constraints.notes,
      task.feedbackRules.passPrimary,
      task.feedbackRules.defaultFailPrimary,
      ...Object.values(task.feedbackRules.failPrimaryByCriterionId),
      ...Object.values(task.feedbackRules.failSecondaryByCriterionId),
    ].join(" ");
    expect(allCopy).toContain("positive front tilt");
    expect(task.title).toBe("Align the tabletop focus cards with tilt");
    expect(allCopy).toContain("parallel to the tabletop");
    expect(allCopy).toContain("all three focus cards");
    expect(allCopy).toContain("9°");
    expect(allCopy).not.toContain("1.5° to 8°");
  });
});

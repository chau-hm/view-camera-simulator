import { describe, expect, it } from "vitest";
import {
  getFreePracticeFeedback,
  getFreePracticeGuidance,
} from "../../components/simulator/taskHelpers";
import { getTaskById } from "../../core/tasks/taskRegistry";

describe("Table Tilt lesson content", () => {
  it("provides scene-specific free-practice guidance", () => {
    const guidance = getFreePracticeGuidance("table-tilt");
    expect(guidance.objective).toContain("near cup, middle notebook and far book");
    expect(guidance.bullets).toEqual(
      expect.arrayContaining([
        expect.stringContaining("middle notebook"),
        expect.stringContaining("positive front tilt"),
        expect.stringContaining("f/11 and f/22"),
      ]),
    );
  });

  it("explains the shared 3D, DOF, Ground Glass, and target readouts", () => {
    const feedback = getFreePracticeFeedback("table-tilt").observation;
    expect(feedback).toContain("3D");
    expect(feedback).toContain("depth-of-field");
    expect(feedback).toContain("Ground Glass");
    expect(feedback).toContain("Focus Targets");
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
    expect(allCopy).toContain("9°");
    expect(allCopy).not.toContain("1.5° to 8°");
  });
});

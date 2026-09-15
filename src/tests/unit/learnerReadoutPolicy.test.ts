import { describe, expect, it } from "vitest";
import { resolveLearnerReadoutPolicy } from "../../components/simulator/learnerReadoutPolicy";

describe("learner readout policy", () => {
  it("shows Focus Distribution only when focus targets are available", () => {
    expect(resolveLearnerReadoutPolicy({ hasFocusTargets: true })).toEqual({
      showFocusTargets: true,
    });
    expect(resolveLearnerReadoutPolicy({ hasFocusTargets: false })).toEqual({
      showFocusTargets: false,
    });
  });

  it("defaults to hiding learner readouts when capabilities are omitted", () => {
    expect(resolveLearnerReadoutPolicy()).toEqual({
      showFocusTargets: false,
    });
  });
});

import { describe, expect, it } from "vitest";
import { resolveLearnerReadoutPolicy } from "../../components/simulator/learnerReadoutPolicy";

describe("learner readout policy", () => {
  it("maps the six public scenes to their current presentation variants", () => {
    expect(resolveLearnerReadoutPolicy("understanding-camera-movements", { hasFocusTargets: false })).toEqual({
      showFocusTargets: false,
      settingsVariant: "movement",
    });
    expect(resolveLearnerReadoutPolicy("focus-fundamentals-two-targets", { hasFocusTargets: true })).toEqual({
      showFocusTargets: true,
      settingsVariant: "focus-fundamentals",
    });
    expect(resolveLearnerReadoutPolicy("architecture-rise", { hasFocusTargets: true })).toEqual({
      showFocusTargets: true,
      settingsVariant: "standard",
    });
    expect(resolveLearnerReadoutPolicy("table-tilt", { hasFocusTargets: true })).toEqual({
      showFocusTargets: true,
      settingsVariant: "standard",
    });
    expect(resolveLearnerReadoutPolicy("shelf-swing", { hasFocusTargets: true })).toEqual({
      showFocusTargets: true,
      settingsVariant: "standard",
    });
    expect(resolveLearnerReadoutPolicy("mirror-shift", { hasFocusTargets: false })).toEqual({
      showFocusTargets: false,
      settingsVariant: "mirror-shift",
    });
  });

  it("uses a safe standard fallback for unknown scenes", () => {
    expect(resolveLearnerReadoutPolicy("future-scene", { hasFocusTargets: true })).toEqual({
      showFocusTargets: true,
      settingsVariant: "standard",
    });
    expect(resolveLearnerReadoutPolicy("future-empty-scene", { hasFocusTargets: false })).toEqual({
      showFocusTargets: false,
      settingsVariant: "standard",
    });
  });
});

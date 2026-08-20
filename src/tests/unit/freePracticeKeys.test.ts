import { describe, expect, it } from "vitest";
import {
  getFreePracticeFeedbackKey,
  getFreePracticeGuidanceKeys,
} from "../../components/simulator/taskHelpers";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";

const publicSceneIds = [
  "understanding-camera-movements",
  "focus-fundamentals-two-targets",
  "architecture-rise",
  "architecture-foreground",
  "oblique-architecture",
  "table-tilt",
  "shelf-swing",
  "mirror-shift",
] as const;

describe("Free Practice message-key contract", () => {
  it.each(publicSceneIds)("resolves scene-specific keys for %s", (sceneId) => {
    const guidance = getFreePracticeGuidanceKeys(sceneId);
    const feedback = getFreePracticeFeedbackKey(sceneId);

    expect(guidance.objectiveKey).not.toBe(simulatorMessageKeys.freePractice.generic.objective);
    expect(guidance.bulletKeys.length).toBeGreaterThan(0);
    expect(feedback.observationKey).not.toBe(simulatorMessageKeys.freePractice.generic.observation);
  });

  it("keeps a safe generic fallback for unknown scenes", () => {
    expect(getFreePracticeGuidanceKeys("future-scene")).toEqual({
      objectiveKey: simulatorMessageKeys.freePractice.generic.objective,
      bulletKeys: [],
    });
    expect(getFreePracticeFeedbackKey("future-scene")).toEqual({
      observationKey: simulatorMessageKeys.freePractice.generic.observation,
    });
  });
});

export type LearnerReadoutSettingsVariant =
  | "movement"
  | "focus-fundamentals"
  | "standard"
  | "mirror-shift";

export type LearnerReadoutSceneCapabilities = {
  hasFocusTargets: boolean;
};

export type LearnerReadoutPolicy = {
  showFocusTargets: boolean;
  settingsVariant: LearnerReadoutSettingsVariant;
};

const standardPolicy = (hasFocusTargets: boolean): LearnerReadoutPolicy => ({
  showFocusTargets: hasFocusTargets,
  settingsVariant: "standard",
});

/**
 * Resolve learner-readout presentation from stable scene identity. Readout
 * policy is deliberately derived at the presentation boundary rather than
 * stored in simulator state or added to SceneDefinition.
 */
export const resolveLearnerReadoutPolicy = (
  sceneId: string,
  capabilities: LearnerReadoutSceneCapabilities = { hasFocusTargets: false },
): LearnerReadoutPolicy => {
  switch (sceneId) {
    case "understanding-camera-movements":
      return { showFocusTargets: false, settingsVariant: "movement" };
    case "focus-fundamentals-two-targets":
      return { showFocusTargets: true, settingsVariant: "focus-fundamentals" };
    case "mirror-shift":
      return { showFocusTargets: false, settingsVariant: "mirror-shift" };
    default:
      return standardPolicy(capabilities.hasFocusTargets);
  }
};

export type LearnerReadoutSceneCapabilities = {
  hasFocusTargets: boolean;
};

export type LearnerReadoutPolicy = {
  showFocusTargets: boolean;
};

/**
 * Resolve learner-readout presentation from the already-derived scene
 * capabilities. Scenes without focus targets intentionally produce no lower
 * learner readout; the controls and domain-specific teaching surfaces remain
 * responsible for their own state and explanations.
 */
export const resolveLearnerReadoutPolicy = (
  capabilities: LearnerReadoutSceneCapabilities = { hasFocusTargets: false },
): LearnerReadoutPolicy => ({ showFocusTargets: capabilities.hasFocusTargets });

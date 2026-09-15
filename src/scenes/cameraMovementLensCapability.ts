import type { SceneFocalLengthCapability } from "../types/scene";

/**
 * Public focal-length choices for Understanding Camera Movements.
 *
 * The central calibration still keeps its wider candidate set for the
 * workbench; this capability is the deliberately smaller learner-facing API.
 */
export const CAMERA_MOVEMENT_FOCAL_LENGTH_CAPABILITY = {
  enabled: true,
  optionsMm: [90, 150],
  defaultMm: 90,
  optionLabels: {
    90: "wide",
    150: "standard",
  },
} as const satisfies SceneFocalLengthCapability;

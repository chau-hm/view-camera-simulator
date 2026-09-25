import type { SceneFocalLengthCapability } from "../types/scene";

/**
 * Public focal-length choices for Understanding Camera Movements.
 *
 * The public teaching catalog exposes each published simulator lens profile.
 */
export const CAMERA_MOVEMENT_FOCAL_LENGTH_CAPABILITY = {
  enabled: true,
  optionsMm: [90, 105, 120, 150],
  defaultMm: 90,
  optionLabels: {
    90: "wide",
    150: "standard",
  },
} as const satisfies SceneFocalLengthCapability;

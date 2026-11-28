import { architectureRiseScene } from '../../src/scenes/definitions/architecture-rise';
import type { SceneDefinition } from '../../src/types/scene';

/** Room coordinates are translated in metres at the scene boundary; optics stay in mm. */
export const roomCameraScene = {
  ...architectureRiseScene,
  // Tilt/Swing demonstrations need the canonical finite-focus optical-axis
  // conjugate datum, as used by the project's other tilted-subject scenes.
  finiteFocusStrategy: {
    ...architectureRiseScene.finiteFocusStrategy!,
    filmDepthReference: 'optical-axis-conjugate' as const,
  },
  bounds: { min: { x: -2400, y: -1400, z: -15000 }, max: { x: 3000, y: 3000, z: 10000 } },
  focusTargets: [],
  compositionTargets: [],
  cameraRigTranslationCapability: { enabled: true, axis: 'x', state: 'mirrorShiftLessonState' },
} satisfies SceneDefinition;

import { describe, expect, it } from 'vitest';
import { roomCameraScene } from '../../../experiments/room-at-dawn/room-camera-scene';
import { deriveOpticsState } from '../../core/optics/deriveOpticsState';
import { computePhysicalBlurFootprint } from '../../core/optics/computePhysicalBlurFootprint';
import { DEFAULT_CAMERA_STATE } from '../../utils/constants';

const point = { x: 0, y: -551.284540721842, z: 2011.39132344135 };
function footprint(tilt: number, scene = roomCameraScene) {
  const state = deriveOpticsState({ ...DEFAULT_CAMERA_STATE, mode: 'free', activeTaskId: null,
    focalLengthMm: 90, focusDistanceMm: 3120, aperture: 5.6, frontTiltDeg: tilt,
    mirrorShiftLessonState: { rigLateralMm: 0 } }, scene);
  return computePhysicalBlurFootprint({ objectPoint: point, lensCenter: state.lensCenterWorld,
    lensPlaneNormal: state.lensPlane.normal, lensPlaneBasisX: state.rearStandardFrame.rightWorld,
    lensPlaneBasisY: state.rearStandardFrame.upWorld, filmPlane: state.filmPlane,
    filmPlaneBasisX: state.rearStandardFrame.rightWorld, filmPlaneBasisY: state.rearStandardFrame.upWorld,
    focalLengthMm: 90, apertureFNumber: 5.6 });
}

describe('Room-at-Dawn finite-focus datum', () => {
  it('brings a real bed point near the solved tilted focus plane without changing canonical optics', () => {
    const corrected = footprint(9.8);
    const neutral = footprint(0);
    const opposite = footprint(-9.8);
    const legacy = footprint(9.8, { ...roomCameraScene, finiteFocusStrategy: {
      ...roomCameraScene.finiteFocusStrategy, filmDepthReference: 'rear-standard-z' as never,
    } });
    expect(corrected.valid && neutral.valid && opposite.valid && legacy.valid).toBe(true);
    expect(Math.abs(corrected.signedCoCDiameterMm)).toBeLessThan(Math.abs(neutral.signedCoCDiameterMm));
    expect(Math.abs(corrected.signedCoCDiameterMm)).toBeLessThan(Math.abs(opposite.signedCoCDiameterMm));
    expect(Math.abs(legacy.signedCoCDiameterMm)).toBeGreaterThan(Math.abs(corrected.signedCoCDiameterMm) * 5);
  });
});

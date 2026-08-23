import { describe, expect, it } from "vitest";
import { vec } from "../../core/math/vec";
import { calculateFiniteFocusFilmPlane } from "../../core/optics/calculateFiniteFocusFilmPlane";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { imageDistanceMm } from "../../core/optics/thinLensModel";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import { obliqueArchitectureScene } from "../../scenes/definitions/oblique-architecture";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import understandingGeometry from "../../scenes/understandingCameraMovementsGeometry";
import type { CameraState } from "../../types/camera";
import type { SceneFiniteFocusStrategy } from "../../types/scene";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const rearStandardStrategy = (
  filmDepthReference?: SceneFiniteFocusStrategy["filmDepthReference"],
): SceneFiniteFocusStrategy => ({
  kind: "rear-standard-thin-lens",
  lensDatum: "baseline-origin",
  focusDistanceReference: "lens-to-focus-plane",
  ...(filmDepthReference ? { filmDepthReference } : {}),
});

describe("finite-focus film-depth strategy", () => {
  const focalLengthMm = 150;
  const focusDistanceMm = 3400;
  const lensNormalLocal = vec(0, 0.6, 0.8);
  const imageDistance = imageDistanceMm(focalLengthMm, focusDistanceMm);

  it("preserves rear-standard Z semantics when the mode is absent", () => {
    const result = calculateFiniteFocusFilmPlane({
      focalLengthMm,
      focusDistanceMm,
      lensNormalLocal,
      strategy: rearStandardStrategy(),
    });

    expect(result.filmCenterWorld.z).toBeCloseTo(-imageDistance, 12);
    expect(result.rawImageDistanceMm).toBeCloseTo(imageDistance, 12);
    expect(result.imageDistanceMm).toBeCloseTo(imageDistance, 12);
    expect(result.fallbackApplied).toBe(false);
  });

  it("uses projected optical-axis depth only when explicitly requested", () => {
    const result = calculateFiniteFocusFilmPlane({
      focalLengthMm,
      focusDistanceMm,
      lensNormalLocal,
      strategy: rearStandardStrategy("optical-axis-conjugate"),
    });

    expect(result.filmCenterWorld.z).toBeCloseTo(-imageDistance * lensNormalLocal.z, 12);
    expect(result.rawImageDistanceMm).toBeCloseTo(imageDistance, 12);
    expect(result.imageDistanceMm).toBeCloseTo(imageDistance, 12);
    expect(result.fallbackApplied).toBe(false);
  });

  it("makes both modes equivalent for a neutral lens normal", () => {
    const rearZ = calculateFiniteFocusFilmPlane({
      focalLengthMm,
      focusDistanceMm,
      lensNormalLocal: vec(0, 0, 1),
      strategy: rearStandardStrategy("rear-standard-z"),
    });
    const conjugate = calculateFiniteFocusFilmPlane({
      focalLengthMm,
      focusDistanceMm,
      lensNormalLocal: vec(0, 0, 1),
      strategy: rearStandardStrategy("optical-axis-conjugate"),
    });

    expect(conjugate.filmCenterWorld).toEqual(rearZ.filmCenterWorld);
    expect(conjugate.imageDistanceMm).toBe(rearZ.imageDistanceMm);
    expect(conjugate.rawImageDistanceMm).toBe(rearZ.rawImageDistanceMm);
  });

  it("keeps the existing finite-focus fallback contract for U at the focal length", () => {
    const result = calculateFiniteFocusFilmPlane({
      focalLengthMm,
      focusDistanceMm: focalLengthMm,
      lensNormalLocal,
      strategy: rearStandardStrategy("rear-standard-z"),
    });

    expect(result.rawImageDistanceMm).toBe(Number.POSITIVE_INFINITY);
    expect(result.imageDistanceMm).toBe(focalLengthMm);
    expect(result.filmCenterWorld.z).toBe(-focalLengthMm);
    expect(result.fallbackApplied).toBe(true);
  });

  it("classifies finite-focus scenes explicitly", () => {
    expect(shelfSwingScene.finiteFocusStrategy?.filmDepthReference).toBe(
      "optical-axis-conjugate",
    );
    expect(tableTiltScene.finiteFocusStrategy?.filmDepthReference).toBe(
      "optical-axis-conjugate",
    );
    expect(obliqueArchitectureScene.finiteFocusStrategy?.filmDepthReference).toBe(
      "optical-axis-conjugate",
    );
    expect(understandingCameraMovementsScene.finiteFocusStrategy?.filmDepthReference).toBe(
      "rear-standard-z",
    );
    expect(architectureForegroundScene.finiteFocusStrategy?.filmDepthReference).toBe(
      "optical-axis-conjugate",
    );
  });
});

describe("Understanding Camera Movements finite-focus datum", () => {
  const cameraAt = (frontTiltDeg: number): CameraState => ({
    ...DEFAULT_CAMERA_STATE,
    ...understandingCameraMovementsScene.cameraPreset,
    activeSceneId: understandingCameraMovementsScene.id,
    viewpointAnchor: "mid",
    cameraRigPlacement: understandingGeometry.cameraRig.defaultViewpoint,
    frontTiltDeg,
  });

  it("keeps the rear film datum fixed when Front Tilt changes", () => {
    const neutralCamera = cameraAt(0);
    const tiltedCamera = cameraAt(5);
    const neutral = deriveOpticsState(neutralCamera, understandingCameraMovementsScene);
    const tilted = deriveOpticsState(tiltedCamera, understandingCameraMovementsScene);
    const expectedImageDistance = imageDistanceMm(
      neutralCamera.focalLengthMm,
      neutralCamera.focusDistanceMm,
    );

    expect(tilted.lensNormalWorld).not.toEqual(neutral.lensNormalWorld);
    expect(tilted.lensCenterWorld).toEqual(neutral.lensCenterWorld);
    expect(tilted.filmCenterWorld).toEqual(neutral.filmCenterWorld);
    expect(tilted.filmNormalWorld).toEqual(neutral.filmNormalWorld);
    expect(tilted.rearStandardFrame.centerWorld).toEqual(
      neutral.rearStandardFrame.centerWorld,
    );
    expect(-neutral.filmCenterWorld.z).toBeCloseTo(expectedImageDistance, 10);
    expect(-tilted.filmCenterWorld.z).toBeCloseTo(expectedImageDistance, 10);
  });
});

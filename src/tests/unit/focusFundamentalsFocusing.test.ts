import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  resolveFocusFundamentalsFocusing,
  resolveSceneRelativeSelectableFocus,
} from "../../core/optics/focusFundamentalsFocusing";
import {
  imageDistanceMm,
  solveLensExtensionForRearDatumFocusDepth,
} from "../../core/optics/thinLensModel";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { viewCameraAnatomyScene } from "../../scenes/definitions/view-camera-anatomy";
import {
  focusFundamentalsFocalLengthMm,
  focusFundamentalsFarFocusDepthMm,
  focusFundamentalsNearFocusDepthMm,
  focusFundamentalsReferenceFocusDepthMm,
} from "../../scenes/focusFundamentalsTargets";
import type { CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { selectDerivedOpticsState } from "../../state/selectors";

const cameraFor = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...focusFundamentalsTwoTargets.cameraPreset,
  activeSceneId: focusFundamentalsTwoTargets.id,
  ...overrides,
});

const expectFiniteGeometry = (optics: ReturnType<typeof deriveOpticsState>) => {
  const points = [
    optics.lensCenterWorld,
    optics.filmCenterWorld,
    optics.focusPointWorld,
    optics.lensPlane.point,
    optics.filmPlane.point,
  ];
  for (const point of points) {
    expect(Object.values(point).every(Number.isFinite)).toBe(true);
  }
};

describe("Focus Fundamentals selectable focus standard geometry", () => {
  const f = focusFundamentalsFocalLengthMm;
  const reference = focusFundamentalsReferenceFocusDepthMm;
  const nearDepth = focusFundamentalsNearFocusDepthMm;
  const farDepth = focusFundamentalsFarFocusDepthMm;

  it("makes front and rear geometry identical at the reference depth", () => {
    const front = deriveOpticsState(cameraFor({ focusDistanceMm: reference, focusStandard: "front" }), focusFundamentalsTwoTargets);
    const rear = deriveOpticsState(cameraFor({ focusDistanceMm: reference, focusStandard: "rear" }), focusFundamentalsTwoTargets);

    expect(rear.lensCenterWorld.z).toBeCloseTo(front.lensCenterWorld.z, 12);
    expect(rear.filmCenterWorld.z).toBeCloseTo(front.filmCenterWorld.z, 12);
    expect(rear.focusPointWorld.z).toBe(reference);
    expect(rear.focusPlane).toEqual(front.focusPlane);
    expect(rear.offAxisProjectionInput).toEqual(front.offAxisProjectionInput);
    expect(rear.offAxisProjectionMatrix).toEqual(front.offAxisProjectionMatrix);
    expect(rear.diagnostics.fallbackApplied).toBe(false);
  });

  it.each([nearDepth, farDepth])("resolves rear finite focus at S=%i with actual U", (S) => {
    const front = deriveOpticsState(cameraFor({ focusDistanceMm: S, focusStandard: "front" }), focusFundamentalsTwoTargets);
    const rearCamera = cameraFor({ focusDistanceMm: S, focusStandard: "rear" });
    const rear = deriveOpticsState(rearCamera, focusFundamentalsTwoTargets);
    const referenceSolution = solveLensExtensionForRearDatumFocusDepth(reference, f);
    const U = S - referenceSolution.v;
    const v = imageDistanceMm(f, U);

    expect(front.filmCenterWorld.z).toBeCloseTo(0, 12);
    expect(front.lensCenterWorld.z).toBeCloseTo(solveLensExtensionForRearDatumFocusDepth(S, f).v, 12);
    expect(rear.lensCenterWorld.z).toBeCloseTo(referenceSolution.v, 12);
    expect(rear.filmCenterWorld.z).toBeCloseTo(referenceSolution.v - v, 12);
    expect(rear.focusPointWorld.z).toBe(S);
    expect(rear.diagnostics.focusObjectDistanceMm).toBeCloseTo(U, 12);
    expect(rear.diagnostics.imageDistanceMm).toBeCloseTo(v, 12);
    expect(rear.diagnostics.nearU).not.toBeNull();

    const H = (f * f) / (rearCamera.aperture * 0.1) + f;
    expect(rear.diagnostics.nearU).toBeCloseTo((H * U) / (H + (U - f)), 10);
    expectFiniteGeometry(rear);
  });

  it("keeps the front film datum fixed while moving the lens across Near and Far", () => {
    const near = deriveOpticsState(
      cameraFor({ focusDistanceMm: nearDepth, focusStandard: "front" }),
      focusFundamentalsTwoTargets,
    );
    const far = deriveOpticsState(
      cameraFor({ focusDistanceMm: farDepth, focusStandard: "front" }),
      focusFundamentalsTwoTargets,
    );

    expect(near.filmCenterWorld.z).toBe(0);
    expect(far.filmCenterWorld.z).toBe(0);
    expect(near.lensCenterWorld.z).not.toBeCloseTo(far.lensCenterWorld.z, 12);
    const frontLensTravelMm = Math.abs(near.lensCenterWorld.z - far.lensCenterWorld.z);
    // The selected scene calibration is intentionally well above the previous
    // roughly 4 mm Near/Far travel while remaining physically modest.
    expect(frontLensTravelMm).toBeGreaterThan(12);
    expect(frontLensTravelMm / reference).toBeGreaterThan(0.01);
    expect(near.focusPointWorld.z).toBe(nearDepth);
    expect(far.focusPointWorld.z).toBe(farDepth);
    expectFiniteGeometry(near);
    expectFiniteGeometry(far);
  });

  it("invalidates the derived-optics selector when the focus standard changes", () => {
    const front = selectDerivedOpticsState(
      cameraFor({ focusDistanceMm: nearDepth, focusStandard: "front" }),
    );
    const rear = selectDerivedOpticsState(
      cameraFor({ focusDistanceMm: nearDepth, focusStandard: "rear" }),
    );

    expect(rear).not.toBe(front);
    expect(rear.lensCenterWorld.z).not.toBeCloseTo(front.lensCenterWorld.z, 12);
  });

  it("changes rear film continuously around the reference while keeping the lens fixed", () => {
    const before = deriveOpticsState(cameraFor({ focusDistanceMm: reference - 10, focusStandard: "rear" }), focusFundamentalsTwoTargets);
    const atReference = deriveOpticsState(cameraFor({ focusDistanceMm: reference, focusStandard: "rear" }), focusFundamentalsTwoTargets);
    const after = deriveOpticsState(cameraFor({ focusDistanceMm: reference + 10, focusStandard: "rear" }), focusFundamentalsTwoTargets);

    expect(before.lensCenterWorld.z).toBeCloseTo(atReference.lensCenterWorld.z, 12);
    expect(after.lensCenterWorld.z).toBeCloseTo(atReference.lensCenterWorld.z, 12);
    expect(before.filmCenterWorld.z).toBeLessThan(atReference.filmCenterWorld.z);
    expect(atReference.filmCenterWorld.z).toBeLessThan(after.filmCenterWorld.z);
  });

  it("keeps the Lesson 0 lens datum while preserving reference optical conjugacy", () => {
    const anatomyCamera: CameraState = {
      ...DEFAULT_CAMERA_STATE,
      ...viewCameraAnatomyScene.cameraPreset,
      activeSceneId: viewCameraAnatomyScene.id,
      focusStandard: "front",
      focusDistanceMm: viewCameraAnatomyScene.cameraPreset.focusDistanceMm,
    };
    const referenceFocusDepthMm =
      viewCameraAnatomyScene.focusStandardCapability!.referenceFocusDepthMm;
    const focalLengthMm = anatomyCamera.focalLengthMm;
    const referenceSolution = resolveFocusFundamentalsFocusing({
      standard: "front",
      focusMode: "finite",
      focusDepthMm: referenceFocusDepthMm,
      focalLengthMm,
      referenceFocusDepthMm,
    });
    const sceneRelativeReference = resolveSceneRelativeSelectableFocus({
      standard: "front",
      focusMode: "finite",
      focusDepthMm: referenceFocusDepthMm,
      focalLengthMm,
      referenceFocusDepthMm,
      sceneLensDatumZMm: 0,
    });
    const optics = deriveOpticsState(anatomyCamera, viewCameraAnatomyScene);

    expect(referenceSolution.fallbackApplied).toBe(false);
    expect(optics.diagnostics.fallbackApplied).toBe(false);
    expect(optics.lensCenterWorld).toEqual({ x: 0, y: 0, z: 0 });
    expect(sceneRelativeReference.sceneOffsetZMm).toBeCloseTo(-referenceSolution.lensZMm, 12);
    expect(optics.filmCenterWorld.z).toBeCloseTo(sceneRelativeReference.filmZMm, 12);
    expect(optics.filmCenterWorld.z).toBeCloseTo(-referenceSolution.imageDistanceVMm, 12);
    expect(Math.abs(optics.lensCenterWorld.z - optics.filmCenterWorld.z)).toBeCloseTo(
      referenceSolution.imageDistanceVMm,
      12,
    );
    expect(optics.focusPointWorld.z).toBeCloseTo(
      referenceFocusDepthMm + sceneRelativeReference.sceneOffsetZMm,
      12,
    );
    expect(optics.rearStandardFrame.centerWorld).toEqual(optics.filmCenterWorld);
    expect(optics.cameraBodyLocalGeometry.lensCenterLocal).toEqual(optics.lensCenterWorld);
    expect(optics.cameraBodyLocalGeometry.filmCenterLocal).toEqual(optics.filmCenterWorld);
  });

  it("keeps Lesson 0 front and rear focus optically conjugate after translation", () => {
    const anatomyCamera = (overrides: Partial<CameraState> = {}): CameraState => ({
      ...DEFAULT_CAMERA_STATE,
      ...viewCameraAnatomyScene.cameraPreset,
      activeSceneId: viewCameraAnatomyScene.id,
      ...overrides,
    });
    const referenceFocusDepthMm =
      viewCameraAnatomyScene.focusStandardCapability!.referenceFocusDepthMm;
    const focalLengthMm = anatomyCamera().focalLengthMm;
    const referenceSolution = resolveFocusFundamentalsFocusing({
      standard: "front",
      focusMode: "finite",
      focusDepthMm: referenceFocusDepthMm,
      focalLengthMm,
      referenceFocusDepthMm,
    });
    const frontSolution = resolveFocusFundamentalsFocusing({
      standard: "front",
      focusMode: "finite",
      focusDepthMm: 2200,
      focalLengthMm,
      referenceFocusDepthMm,
    });
    const rearSolution = resolveFocusFundamentalsFocusing({
      standard: "rear",
      focusMode: "finite",
      focusDepthMm: 2200,
      focalLengthMm,
      referenceFocusDepthMm,
    });
    const translatedFront = resolveSceneRelativeSelectableFocus({
      standard: "front",
      focusMode: "finite",
      focusDepthMm: 2200,
      focalLengthMm,
      referenceFocusDepthMm,
      sceneLensDatumZMm: 0,
    });
    const translatedRear = resolveSceneRelativeSelectableFocus({
      standard: "rear",
      focusMode: "finite",
      focusDepthMm: 2200,
      focalLengthMm,
      referenceFocusDepthMm,
      sceneLensDatumZMm: 0,
    });
    const referenceFront = deriveOpticsState(
      anatomyCamera({ focusStandard: "front", focusDistanceMm: referenceFocusDepthMm }),
      viewCameraAnatomyScene,
    );
    const movedFront = deriveOpticsState(
      anatomyCamera({ focusStandard: "front", focusDistanceMm: 2200 }),
      viewCameraAnatomyScene,
    );
    const movedRear = deriveOpticsState(
      anatomyCamera({ focusStandard: "rear", focusDistanceMm: 2200 }),
      viewCameraAnatomyScene,
    );

    expect(referenceSolution.fallbackApplied).toBe(false);
    expect(frontSolution.fallbackApplied).toBe(false);
    expect(rearSolution.fallbackApplied).toBe(false);
    expect(translatedFront.sceneOffsetZMm).toBeCloseTo(-referenceSolution.lensZMm, 12);
    expect(translatedRear.sceneOffsetZMm).toBeCloseTo(-referenceSolution.lensZMm, 12);
    expect(translatedFront.sceneOffsetZMm).toBeCloseTo(
      translatedRear.sceneOffsetZMm,
      12,
    );
    expect(referenceFront.lensCenterWorld.z).toBeCloseTo(0, 12);
    expect(referenceFront.filmCenterWorld.z).toBeCloseTo(-referenceSolution.imageDistanceVMm, 12);
    expect(Math.abs(referenceFront.lensCenterWorld.z - referenceFront.filmCenterWorld.z)).toBeCloseTo(
      referenceSolution.imageDistanceVMm,
      12,
    );
    expect(movedFront.filmCenterWorld.z).toBeCloseTo(referenceFront.filmCenterWorld.z, 12);
    expect(movedFront.rearStandardFrame.centerWorld).toEqual(
      referenceFront.rearStandardFrame.centerWorld,
    );
    expect(movedFront.lensCenterWorld.z).toBeCloseTo(
      frontSolution.lensZMm - referenceSolution.lensZMm,
      12,
    );
    expect(Math.abs(movedFront.lensCenterWorld.z - movedFront.filmCenterWorld.z)).toBeCloseTo(
      frontSolution.imageDistanceVMm,
      12,
    );
    expect(movedRear.lensCenterWorld.z).toBeCloseTo(referenceFront.lensCenterWorld.z, 12);
    expect(movedRear.lensCenterWorld).toEqual(referenceFront.lensCenterWorld);
    expect(movedRear.filmCenterWorld.z).toBeCloseTo(
      rearSolution.filmZMm - referenceSolution.lensZMm,
      12,
    );
    expect(Math.abs(movedRear.lensCenterWorld.z - movedRear.filmCenterWorld.z)).toBeCloseTo(
      rearSolution.imageDistanceVMm,
      12,
    );
    expect(movedFront.focusPointWorld.z).toBeCloseTo(
      2200 - referenceSolution.lensZMm,
      12,
    );
    expect(movedRear.focusPointWorld.z).toBeCloseTo(
      2200 - referenceSolution.lensZMm,
      12,
    );
    expect(movedFront.diagnostics.imageDistanceMm).toBeCloseTo(
      frontSolution.imageDistanceVMm,
      12,
    );
    expect(movedRear.diagnostics.imageDistanceMm).toBeCloseTo(
      rearSolution.imageDistanceVMm,
      12,
    );
    expect(movedFront.diagnostics.fallbackApplied).toBe(false);
    expect(movedRear.diagnostics.fallbackApplied).toBe(false);
  });

  it("preserves infinity semantics with a calibrated rear placement", () => {
    const front = deriveOpticsState(cameraFor({ focusMode: "infinity", focusStandard: "front" }), focusFundamentalsTwoTargets);
    const rear = deriveOpticsState(cameraFor({ focusMode: "infinity", focusStandard: "rear" }), focusFundamentalsTwoTargets);
    const referenceLensZ = solveLensExtensionForRearDatumFocusDepth(reference, f).v;

    expect(front.lensCenterWorld.z).toBeCloseTo(f, 12);
    expect(front.filmCenterWorld.z).toBeCloseTo(0, 12);
    expect(rear.lensCenterWorld.z).toBeCloseTo(referenceLensZ, 12);
    expect(rear.filmCenterWorld.z).toBeCloseTo(referenceLensZ - f, 12);
    expect(front.focusPlane).toBeNull();
    expect(rear.focusPlane).toBeNull();
    expectFiniteGeometry(rear);
  });

  it("falls back safely for an invalid rear finite input", () => {
    const optics = deriveOpticsState(cameraFor({ focusDistanceMm: 200, focusStandard: "rear" }), focusFundamentalsTwoTargets);

    expect(optics.diagnostics.fallbackApplied).toBe(true);
    expect(optics.diagnostics.fallbackReason).toMatch(/rear-standard|finite front-standard/i);
    expectFiniteGeometry(optics);
    expect(optics.focusPointWorld.z).toBe(200);
    expect(
      optics.diagnostics.nearU === undefined ||
        optics.diagnostics.nearU === null ||
        Number.isFinite(optics.diagnostics.nearU),
    ).toBe(true);
    expect(
      optics.diagnostics.farU === undefined ||
        optics.diagnostics.farU === null ||
        Number.isFinite(optics.diagnostics.farU),
    ).toBe(true);
  });

  it("ignores focus-standard selection for scenes without the capability", () => {
    const front = deriveOpticsState(
      { ...DEFAULT_CAMERA_STATE, activeSceneId: architectureRiseScene.id, focusStandard: "front" },
      architectureRiseScene,
    );
    const rear = deriveOpticsState(
      { ...DEFAULT_CAMERA_STATE, activeSceneId: architectureRiseScene.id, focusStandard: "rear" },
      architectureRiseScene,
    );

    expect(rear.lensCenterWorld).toEqual(front.lensCenterWorld);
    expect(rear.filmCenterWorld).toEqual(front.filmCenterWorld);
  });
});

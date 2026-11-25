import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  computePhaseJKnownPointFootprint,
  createPhaseJOpticalState,
  getPhaseJOpticalCase,
  projectPhaseJKnownPointToSourcePixel,
} from "../e2e/fixtures/ground-glass-webgpu-optical-state-cases";
import { MACRO_DEPTH_FOCUS_ZONE_SPECS } from "../../scenes/macroDepthOfFieldGeometry";

const createState = (caseId: Parameters<typeof createPhaseJOpticalState>[0]) =>
  createPhaseJOpticalState(caseId, new THREE.PerspectiveCamera(45, 4 / 3, 0.01, 100), 512, 384, 60);

describe("Phase J canonical optical-state adapter", () => {
  it("uses canonical Macro conjugate geometry and projects the actual focus stations", () => {
    const state = createState("macro-focus-middle-f5_6");
    expect(state.opticsState.diagnostics.fallbackApplied).toBe(false);
    expect(state.cameraState.focalLengthMm).toBe(150);
    expect(state.cameraState.focusDistanceMm).toBe(400);
    expect(state.renderState.optics.imageDistanceMm).toBeCloseTo(240, 8);
    expect(state.renderState.lens.centerWorldM).toEqual({ x: 0, y: 0, z: 0 });
    expect(state.renderState.film.planePointWorldM.z).toBeCloseTo(-0.24, 8);
    expect(state.renderState.film.widthMm).toBe(127);
    expect(state.renderState.film.heightMm).toBe(101.6);
    expect(state.renderState.camera.worldMatrixElements).toEqual(state.canonicalCameraFingerprint.worldMatrixElements);

    for (const zone of MACRO_DEPTH_FOCUS_ZONE_SPECS) {
      const projection = projectPhaseJKnownPointToSourcePixel(state, zone.centerMm, 512, 384);
      expect(projection.inBounds, zone.id).toBe(true);
      expect(projection.ndc[2]).toBeGreaterThan(0);
      expect(projection.ndc[2]).toBeLessThan(1);
    }

    const near = computePhaseJKnownPointFootprint(state, MACRO_DEPTH_FOCUS_ZONE_SPECS[0]!.centerMm);
    const focus = computePhaseJKnownPointFootprint(state, MACRO_DEPTH_FOCUS_ZONE_SPECS[1]!.centerMm);
    const far = computePhaseJKnownPointFootprint(state, MACRO_DEPTH_FOCUS_ZONE_SPECS[2]!.centerMm);
    expect(near.valid).toBe(true);
    expect(focus.valid).toBe(true);
    expect(far.valid).toBe(true);
    expect(near.signedCoCDiameterMm).toBeLessThan(0);
    expect(focus.signedCoCDiameterMm).toBeCloseTo(0, 8);
    expect(far.signedCoCDiameterMm).toBeGreaterThan(0);
    expect(near.majorRadiusMm).toBeGreaterThan(0);
    expect(far.majorRadiusMm).toBeGreaterThan(0);
  });

  it("moves the canonical Macro focus plane and scales physical CoC with aperture", () => {
    const nearFocus = createState("macro-focus-near-f5_6");
    const middleFocus = createState("macro-focus-middle-f5_6");
    const farFocus = createState("macro-focus-far-f5_6");
    const nearTarget = MACRO_DEPTH_FOCUS_ZONE_SPECS[0]!.centerMm;
    const middleTarget = MACRO_DEPTH_FOCUS_ZONE_SPECS[1]!.centerMm;
    const farTarget = MACRO_DEPTH_FOCUS_ZONE_SPECS[2]!.centerMm;
    expect(computePhaseJKnownPointFootprint(nearFocus, nearTarget).signedCoCDiameterMm).toBeCloseTo(0, 8);
    expect(computePhaseJKnownPointFootprint(middleFocus, middleTarget).signedCoCDiameterMm).toBeCloseTo(0, 8);
    expect(computePhaseJKnownPointFootprint(farFocus, farTarget).signedCoCDiameterMm).toBeCloseTo(0, 8);
    expect(nearFocus.renderState.film.planePointWorldM.z).toBeLessThan(middleFocus.renderState.film.planePointWorldM.z);
    expect(farFocus.renderState.film.planePointWorldM.z).toBeGreaterThan(middleFocus.renderState.film.planePointWorldM.z);

    const f5_6 = computePhaseJKnownPointFootprint(middleFocus, farTarget);
    const f16 = computePhaseJKnownPointFootprint(createState("macro-focus-middle-f16"), farTarget);
    expect(f5_6.signedCoCDiameterMm).toBeGreaterThan(0);
    expect(f16.signedCoCDiameterMm).toBeGreaterThan(0);
    expect(f16.signedCoCDiameterMm / f5_6.signedCoCDiameterMm).toBeCloseTo(5.6 / 16, 5);
  });

  it("keeps the capture camera distinct from the Observer and applies real movements", () => {
    const interiorCase = getPhaseJOpticalCase("interior-rise-swing");
    const interior = createState("interior-rise-swing");
    expect(interior.opticsState.diagnostics.fallbackApplied).toBe(false);
    expect(interior.cameraState.frontRiseMm).toBe(12);
    expect(interior.cameraState.frontSwingDeg).toBe(5);
    expect(interior.renderState.lens.planeNormal.x).not.toBeCloseTo(0, 4);
    expect(interior.renderState.lens.centerWorldM.y).toBeCloseTo(0.012, 8);
    expect(interior.captureCameraPose.positionWorldM).toEqual([0, 0.012, 0]);
    expect(Math.abs(interiorCase.scene.cameraPlacement?.position.x ?? 0)).toBeGreaterThan(1);
    expect(Math.abs(interior.captureCameraPose.positionWorldM[0])).toBeLessThan(1);
    for (const sample of interiorCase.pointSamples) {
      expect(projectPhaseJKnownPointToSourcePixel(interior, sample.pointMm, 512, 384).inBounds).toBe(true);
    }

    const architecture = createState("architecture-rise");
    const architectureCase = getPhaseJOpticalCase("architecture-rise");
    expect(architecture.opticsState.diagnostics.fallbackApplied).toBe(false);
    expect(architecture.cameraState.frontRiseMm).toBe(20);
    expect(architecture.renderState.lens.centerWorldM.y).toBeCloseTo(0.02, 8);
    expect(architecture.captureCameraPose.positionWorldM).toEqual([0, 0.02, 0]);
    expect(Math.abs(architectureCase.scene.cameraPlacement?.position.x ?? 0)).toBeGreaterThan(1);
    for (const sample of architectureCase.pointSamples) {
      expect(projectPhaseJKnownPointToSourcePixel(architecture, sample.pointMm, 512, 384).inBounds).toBe(true);
    }
  });

  it("keeps Interior and Architecture initial, movement, and focus states distinct", () => {
    const interiorInitial = createState("interior-initial");
    const interiorSwing = createState("interior-front-swing");
    const interiorSwingFocus = createState("interior-front-swing-focus");
    const interiorRiseSwing = createState("interior-rise-swing");

    expect(interiorInitial.cameraState.frontSwingDeg).toBe(0);
    expect(interiorSwing.cameraState.frontSwingDeg).toBe(5);
    expect(interiorSwing.cameraState.focusDistanceMm).toBe(interiorInitial.cameraState.focusDistanceMm);
    expect(interiorSwingFocus.cameraState.frontSwingDeg).toBe(5);
    expect(interiorSwingFocus.cameraState.focusDistanceMm).toBe(8500);
    expect(interiorRiseSwing.cameraState.frontRiseMm).toBe(12);
    expect(interiorRiseSwing.cameraState.frontSwingDeg).toBe(5);

    const swingNormal = interiorSwing.renderState.lens.planeNormal;
    expect(swingNormal.x).toBeCloseTo(Math.sin(5 * Math.PI / 180), 8);
    expect(swingNormal.y).toBeCloseTo(0, 8);
    expect(swingNormal.z).toBeCloseTo(Math.cos(5 * Math.PI / 180), 8);
    expect(interiorSwing.renderState.film.planeNormal).toEqual({ x: 0, y: 0, z: 1 });
    expect(interiorSwing.renderState.lens.centerWorldM.y).toBeCloseTo(0, 8);
    expect(interiorRiseSwing.renderState.lens.centerWorldM.y).toBeCloseTo(0.012, 8);
    expect(interiorSwingFocus.renderState.focus.plane).not.toBeNull();
    expect(interiorSwing.renderState.focus.plane).not.toBeNull();
    expect(interiorSwingFocus.renderState.focus.plane!.pointWorldM)
      .not.toEqual(interiorSwing.renderState.focus.plane!.pointWorldM);

    const architectureInitial = createState("architecture-initial");
    const architectureRise = createState("architecture-rise");
    const architectureRiseFocus = createState("architecture-rise-focus");
    expect(architectureInitial.cameraState.frontRiseMm).toBe(0);
    expect(architectureInitial.cameraState.focusDistanceMm).toBe(8890);
    expect(architectureRise.cameraState.frontRiseMm).toBe(20);
    expect(architectureRiseFocus.cameraState.frontRiseMm).toBe(20);
    expect(architectureRiseFocus.cameraState.focusDistanceMm).toBe(9500);
    expect(architectureRise.renderState.lens.centerWorldM.y).toBeCloseTo(0.02, 8);
    expect(architectureRise.renderState.film.planeNormal).toEqual({ x: 0, y: 0, z: 1 });

    for (const state of [
      interiorInitial,
      interiorSwing,
      interiorSwingFocus,
      interiorRiseSwing,
      architectureInitial,
      architectureRise,
      architectureRiseFocus,
    ]) {
      expect(state.opticsState.diagnostics.fallbackApplied, state.caseId).toBe(false);
      for (const sample of getPhaseJOpticalCase(state.caseId).pointSamples) {
        expect(projectPhaseJKnownPointToSourcePixel(state, sample.pointMm, 512, 384).inBounds)
          .toBe(true);
      }
    }
  });
});

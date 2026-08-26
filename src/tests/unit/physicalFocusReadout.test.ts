import { describe, expect, it } from "vitest";
import { calculateSharpness } from "../../core/optics/calculateSharpness";
import { computePhysicalBlurFootprint } from "../../core/optics/computePhysicalBlurFootprint";
import {
  ACCEPTABLE_COC_DIAMETER_MM,
  calculatePhysicalSharpnessFromEquivalentCoCDiameterMm,
} from "../../core/optics/physicalSharpness";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { evaluateFocusTargets } from "../../core/tasks/evaluateFocusTargets";
import {
  createFocusAssistPass,
  resolvePhysicalFocusTargetPresentationMetric,
} from "../../render/postprocessing/FocusAssistPass";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { obliqueArchitectureScene } from "../../scenes/definitions/oblique-architecture";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import shelfGeometry from "../../scenes/shelfSwingGeometry";
import type { CameraState, ApertureValue } from "../../types/camera";
import type { DerivedOpticsState, FocusTargetSharpness, Vec3 } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const cameraFor = (
  scene: SceneDefinition,
  overrides: Partial<CameraState> = {},
): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...scene.cameraPreset,
  activeSceneId: scene.id,
  ...overrides,
});

const directPointFootprint = (
  optics: DerivedOpticsState,
  worldPosition: Vec3,
  focalLengthMm: number,
  aperture: number,
) =>
  computePhysicalBlurFootprint({
    objectPoint: worldPosition,
    lensCenter: optics.lensCenterWorld,
    lensPlaneNormal: optics.lensPlane.normal,
    lensPlaneBasisX: optics.rearStandardFrame.rightWorld,
    lensPlaneBasisY: optics.rearStandardFrame.upWorld,
    filmPlane: optics.filmPlane,
    filmPlaneBasisX: optics.rearStandardFrame.rightWorld,
    filmPlaneBasisY: optics.rearStandardFrame.upWorld,
    focalLengthMm,
    apertureFNumber: aperture,
  });

const representativeScenes = [
  [architectureRiseScene, cameraFor(architectureRiseScene)] as const,
  [tableTiltScene, cameraFor(tableTiltScene)] as const,
  [
    shelfSwingScene,
    cameraFor(shelfSwingScene, {
      frontRiseMm: shelfGeometry.shelfSwingCalibration.frontRiseMm,
      frontTiltDeg: shelfGeometry.shelfSwingCalibration.frontTiltDeg,
      frontSwingDeg: shelfGeometry.shelfSwingCalibration.frontSwingDeg,
      focusDistanceMm: shelfGeometry.shelfSwingCalibration.focusDistanceMm,
      aperture: shelfGeometry.shelfSwingCalibration.aperture,
    }),
  ] as const,
  [architectureForegroundScene, cameraFor(architectureForegroundScene)] as const,
];

describe("physical focus readout", () => {
  it("normalizes the acceptable physical CoC boundary", () => {
    expect(ACCEPTABLE_COC_DIAMETER_MM).toBe(0.1);
    expect(calculatePhysicalSharpnessFromEquivalentCoCDiameterMm(0)).toBe(1);
    expect(calculatePhysicalSharpnessFromEquivalentCoCDiameterMm(0.05)).toBeCloseTo(0.5, 12);
    expect(calculatePhysicalSharpnessFromEquivalentCoCDiameterMm(0.1)).toBe(0);
    expect(calculatePhysicalSharpnessFromEquivalentCoCDiameterMm(0.2)).toBe(0);
    expect(calculatePhysicalSharpnessFromEquivalentCoCDiameterMm(null)).toBe(0);
  });

  it("approaches 100% at an exactly conjugate physical target", () => {
    const camera = cameraFor(architectureRiseScene);
    const base = deriveOpticsState(camera, architectureRiseScene);
    const scene: SceneDefinition = {
      ...architectureRiseScene,
      focusTargets: [{
        id: "exact-conjugate-target",
        label: "Exact conjugate target",
        worldPosition: base.focusPointWorld,
        weight: 1,
      }],
    };
    const optics = deriveOpticsState(camera, scene);
    const target = optics.focusTargets[0];

    expect(target.pointEquivalentCoCDiameterMm).toBeCloseTo(0, 8);
    expect(target.physicalPointSharpness).toBeCloseTo(1, 8);
    expect(target.physicalPointStatus).toBe("sharp");
  });

  it("populates physical CoC metrics that match the shared footprint kernel", () => {
    representativeScenes.forEach(([scene, camera]) => {
      const optics = deriveOpticsState(camera, scene);
      optics.focusTargets.forEach((target) => {
        expect(typeof target.physicalPointSharpness).toBe("number");
        expect(typeof target.physicalPatchSharpness).toBe("number");
        const definition = scene.focusTargets.find((entry) => entry.id === target.id)!;
        const direct = directPointFootprint(
          optics,
          definition.worldPosition,
          camera.focalLengthMm,
          camera.aperture as number,
        );
        const expected = direct.valid ? Math.abs(direct.signedCoCDiameterMm) : null;
        if (expected === null) {
          expect(target.pointEquivalentCoCDiameterMm).toBeNull();
        } else {
          expect(target.pointEquivalentCoCDiameterMm).toEqual(expect.any(Number));
        }
        if (expected !== null) {
          expect(target.pointEquivalentCoCDiameterMm).toBeCloseTo(expected, 8);
          expect(target.physicalPointSharpness).toBeCloseTo(
            calculatePhysicalSharpnessFromEquivalentCoCDiameterMm(expected),
            8,
          );
        }

        const patchPositions = definition.sampleWorldPositions?.length
          ? definition.sampleWorldPositions
          : [definition.worldPosition];
        const patchFootprints = patchPositions.map((position) =>
          directPointFootprint(optics, position, camera.focalLengthMm, camera.aperture as number),
        );
        const expectedPatch = patchFootprints.every((footprint) => footprint.valid)
          ? Math.max(...patchFootprints.map((footprint) => Math.abs(footprint.signedCoCDiameterMm)))
          : null;
        if (expectedPatch === null) {
          expect(target.patchEquivalentCoCDiameterMm).toBeNull();
        } else {
          expect(target.patchEquivalentCoCDiameterMm).toBeCloseTo(expectedPatch, 8);
        }
      });
    });
  });

  it("makes presentation sharpness respond monotonically to aperture", () => {
    const focusTarget = architectureForegroundScene.focusTargets.find(
      (target) => target.id === "foreground-middle",
    )!;
    const scoreAt = (aperture: ApertureValue) => {
      const optics = deriveOpticsState(
        cameraFor(architectureForegroundScene, { aperture }),
        architectureForegroundScene,
      );
      return optics.focusTargets.find((target) => target.id === focusTarget.id)!.physicalPointSharpness!;
    };

    expect(scoreAt(5.6)).toBeLessThan(scoreAt(11));
    expect(scoreAt(11)).toBeLessThan(scoreAt(22));
  });

  it("uses the worst physical sample for patch presentation", () => {
    const optics = deriveOpticsState(cameraFor(tableTiltScene), tableTiltScene);
    const target = optics.focusTargets.find((entry) => entry.id === "mid-notebook")!;

    expect(target.physicalPatchSharpness).toBeLessThanOrEqual(target.physicalPointSharpness!);
    expect(target.physicalPatchStatus).toBeDefined();
  });

  it("fails closed when physical geometry is invalid", () => {
    const scene: SceneDefinition = {
      ...architectureRiseScene,
      focusTargets: [{
        id: "invalid-physical-target",
        label: "Invalid physical target",
        worldPosition: { x: 0, y: 0, z: 1000 },
        weight: 1,
      }],
    };
    const target = calculateSharpness(
      scene,
      { point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, distance: 0 },
      11,
      { x: 0, y: 0, z: 0 },
      null,
      null,
      {
        lensCenterWorld: { x: 0, y: 0, z: 0 },
        lensPlaneNormal: { x: 0, y: 0, z: 0 },
        lensPlaneBasisX: { x: 1, y: 0, z: 0 },
        lensPlaneBasisY: { x: 0, y: 1, z: 0 },
        filmPlane: { point: { x: 0, y: 0, z: -150 }, normal: { x: 0, y: 0, z: 1 }, distance: -150 },
        filmPlaneBasisX: { x: 1, y: 0, z: 0 },
        filmPlaneBasisY: { x: 0, y: 1, z: 0 },
        focalLengthMm: 150,
        apertureFNumber: 11,
      },
    )[0];

    expect(target.physicalPointSharpness).toBe(0);
    expect(target.physicalPointStatus).toBe("soft");
    expect(target.pointEquivalentCoCDiameterMm).toBeNull();
    expect(target.physicalPatchSharpness).toBe(0);
    expect(target.patchEquivalentCoCDiameterMm).toBeNull();
  });

  it("prefers physical presentation metrics over contradictory legacy values", () => {
    const target: FocusTargetSharpness = {
      id: "physical-preferred",
      distanceToFocusPlaneMm: 0,
      sharpness: 0.9,
      status: "sharp",
      pointSharpness: 0.9,
      pointStatus: "sharp",
      patchSharpness: 0.9,
      patchStatus: "sharp",
      physicalPointSharpness: 0.35,
      physicalPointStatus: "soft",
      physicalPatchSharpness: 0.35,
      physicalPatchStatus: "soft",
      pointEquivalentCoCDiameterMm: 0.065,
      patchEquivalentCoCDiameterMm: 0.065,
    };
    const pass = createFocusAssistPass({ enabled: true, targets: [target], metric: "patch" });
    expect(pass.targets[0]).toMatchObject({ sharpnessPercent: 35, status: "soft" });
    expect(createFocusAssistPass({ enabled: true, targets: [target], metric: "point" }).targets[0]).toMatchObject({
      sharpnessPercent: 35,
      status: "soft",
    });
    expect(resolvePhysicalFocusTargetPresentationMetric(target, "patch").sharpness).toBe(0.35);
  });

  it("fails closed for legacy-only presentation fixtures", () => {
    const target: FocusTargetSharpness = {
      id: "legacy-only",
      distanceToFocusPlaneMm: 0,
      sharpness: 0.9,
      status: "sharp",
      patchSharpness: 0.9,
      patchStatus: "sharp",
    };
    expect(createFocusAssistPass({ enabled: true, targets: [target] }).targets[0]).toMatchObject({
      sharpnessPercent: 0,
      status: "soft",
    });
    expect(resolvePhysicalFocusTargetPresentationMetric(target)).toEqual({
      sharpness: 0,
      status: "soft",
      equivalentCoCDiameterMm: null,
    });
  });

  it("uses physical patch sharpness instead of contradictory legacy task values", () => {
    const legacyPassingPhysicalFailing: FocusTargetSharpness = {
      id: "physical-task-metric",
      distanceToFocusPlaneMm: 999,
      sharpness: 0.9,
      status: "sharp",
      physicalPatchSharpness: 0.2,
      physicalPatchStatus: "soft",
      patchEquivalentCoCDiameterMm: 0.08,
    };
    const legacyFailingPhysicalPassing: FocusTargetSharpness = {
      ...legacyPassingPhysicalFailing,
      sharpness: 0.2,
      status: "soft",
      physicalPatchSharpness: 0.9,
      physicalPatchStatus: "sharp",
      patchEquivalentCoCDiameterMm: 0.01,
    };

    expect(
      evaluateFocusTargets(
        [legacyPassingPhysicalFailing],
        [legacyPassingPhysicalFailing.id],
        0.8,
      ),
    ).toBe(false);
    expect(
      evaluateFocusTargets(
        [legacyFailingPhysicalPassing],
        [legacyFailingPhysicalPassing.id],
        0.8,
      ),
    ).toBe(true);
  });

  it("populates physical metrics for Focus Fundamentals without changing its controls", () => {
    const optics = deriveOpticsState(
      cameraFor(focusFundamentalsTwoTargets),
      focusFundamentalsTwoTargets,
    );
    expect(optics.focusTargets.length).toBeGreaterThan(0);
    expect(optics.focusTargets.every((target) => typeof target.physicalPointSharpness === "number")).toBe(true);
    expect(optics.diagnostics.focusStandard).toBe("front");
  });

  it("keeps Oblique Architecture on the physical presentation path", () => {
    const optics = deriveOpticsState(cameraFor(obliqueArchitectureScene), obliqueArchitectureScene);
    expect(optics.focusTargets.length).toBeGreaterThan(0);
    expect(optics.focusTargets.every((target) => target.physicalPatchSharpness !== undefined)).toBe(true);
  });
});

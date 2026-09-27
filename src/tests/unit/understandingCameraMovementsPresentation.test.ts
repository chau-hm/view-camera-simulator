import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { calculateCameraMovementProjectionDiagnostics } from "../../scenes/cameraMovementProjectionDiagnostics";
import {
  CAMERA_MOVEMENT_CALIBRATION_BASELINE,
  resolveEffectiveCameraMovementCalibration,
} from "../../scenes/cameraMovementEffectiveCalibration";
import { CAMERA_MOVEMENT_LATTICE } from "../../scenes/cameraMovementLatticeGeometry";
import {
  DEFAULT_CAMERA_MOVEMENT_LESSON_STATE,
  resolveCameraMovementLessonState,
} from "../../scenes/cameraMovementLessonState";
import { CAMERA_MOVEMENT_SCENE_CALIBRATION } from "../../scenes/cameraMovementSceneCalibration";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import geometry from "../../scenes/understandingCameraMovementsGeometry";
import {
  CAMERA_MOVEMENT_BASELINE_PRESENTATION,
  resolveCameraMovementLatticePresentation,
  type CameraMovementLatticePresentation,
} from "../../scenes/presentation/understandingCameraMovements";
import * as cameraMovementLatticeAsset from "../../render/assets/CameraMovementLatticeAsset";
import {
  cameraMovementsGroupOptionsFromPresentation,
  disposeCameraMovementsGroup,
  type CameraMovementsGroupOptions,
} from "../../render/assets/CameraMovementLatticeAsset";
import { createCameraMovementLatticeAsset } from "../../render/cameraMovementLatticeAssetConsumer";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import type { CameraMovementTargetRegion } from "../../scenes/cameraMovementSceneCalibration";

const targetCentreFor = (
  lattice: typeof CAMERA_MOVEMENT_LATTICE,
  region: CameraMovementTargetRegion,
) => {
  const levelIndex = lattice.targetLevelByRegion[region];
  const bounds = lattice.perLevelBounds.find(
    (level) => level.levelIndex === levelIndex,
  )!.bounds;
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  };
};

const sceneSemanticResults = () => {
  const effectiveCalibration = resolveEffectiveCameraMovementCalibration(
    CAMERA_MOVEMENT_CALIBRATION_BASELINE,
  );
  const lesson = resolveCameraMovementLessonState(
    DEFAULT_CAMERA_MOVEMENT_LESSON_STATE,
    effectiveCalibration.cameraRig,
  );
  const camera = {
    ...DEFAULT_CAMERA_STATE,
    ...understandingCameraMovementsScene.cameraPreset,
    activeSceneId: understandingCameraMovementsScene.id,
    viewpointAnchor: lesson.viewpointAnchor,
    cameraRigPlacement: lesson.cameraRigPlacement,
    cameraBodyPitchDeg: lesson.cameraBodyPitchDeg,
    frontRiseMm: lesson.frontRiseMm,
    frontTiltDeg: lesson.frontTiltDeg,
    rearRiseMm: lesson.rearRiseMm,
    rearTiltDeg: lesson.rearTiltDeg,
    cameraMovementLessonState: lesson.lessonState,
  };
  const opticsState = deriveOpticsState(camera, understandingCameraMovementsScene);
  const presentation = resolveCameraMovementLatticePresentation(effectiveCalibration);
  const projection = calculateCameraMovementProjectionDiagnostics({
    effectiveCalibration,
    lattice: presentation.lattice,
    calibrationIdentity: {
      sessionActive: false,
      revision: 0,
      geometryId: presentation.geometryId,
    },
    currentAnchor: lesson.viewpointAnchor,
    targetRegion: lesson.targetRegion,
    opticsState,
  });

  return {
    sceneId: understandingCameraMovementsScene.id,
    cameraPreset: understandingCameraMovementsScene.cameraPreset,
    movementCapabilities: understandingCameraMovementsScene.movementCapabilities,
    lesson: {
      state: lesson.lessonState,
      study: lesson.lessonState.study,
      targetRegion: lesson.targetRegion,
      presentationTargetRegion: lesson.presentationTargetRegion,
    },
    lattice: {
      units: CAMERA_MOVEMENT_LATTICE.units,
      dimensions: CAMERA_MOVEMENT_LATTICE.dimensions,
      bounds: CAMERA_MOVEMENT_LATTICE.bounds,
      targets: {
        upper: targetCentreFor(CAMERA_MOVEMENT_LATTICE, "upper"),
        middle: targetCentreFor(CAMERA_MOVEMENT_LATTICE, "middle"),
        lower: targetCentreFor(CAMERA_MOVEMENT_LATTICE, "lower"),
      },
    },
    focusReferenceWorld: geometry.focusReferenceWorld,
    presentationSemantics: {
      object: presentation.object,
      geometryKey: presentation.geometryKey,
      presentationKey: presentation.presentationKey,
      geometryId: presentation.geometryId,
      subjectBoundsWorldMm: presentation.subjectBoundsWorldMm,
      referenceGrid: presentation.referenceGrid,
      calibration: presentation.presentation,
      lightingTargetWorldMm: presentation.lightingTargetWorldMm,
      showReferenceCamera: presentation.showReferenceCamera,
    },
    optics: {
      lensCenterWorld: opticsState.lensCenterWorld,
      filmCenterWorld: opticsState.filmCenterWorld,
      focusPlane: opticsState.focusPlane,
      selectedTargetWorld:
        projection.selectedTarget.centreWorld.status === "available"
          ? projection.selectedTarget.centreWorld.value
          : null,
    },
  };
};

describe("Understanding Camera Movements presentation boundary", () => {
  it("keeps the contract tied to canonical world-space semantic geometry", () => {
    const presentation = CAMERA_MOVEMENT_BASELINE_PRESENTATION;
    const { subject } = CAMERA_MOVEMENT_SCENE_CALIBRATION;

    expect(presentation.sceneId).toBe("understanding-camera-movements");
    expect(presentation.object).toEqual({
      id: "camera-movement-lattice",
      role: "camera-movement-target-lattice",
    });
    expect(presentation.lattice.units).toBe("millimetres");
    expect(presentation.lattice.dimensions).toEqual({ columns: 3, rows: 3, levels: 5 });
    expect(presentation.lattice.bounds).toEqual(understandingCameraMovementsScene.bounds);
    expect(presentation.lattice.bounds).toEqual(CAMERA_MOVEMENT_LATTICE.bounds);
    expect(presentation.lattice.targetLevelByRegion).toEqual({
      upper: subject.upperTargetLevel,
      middle: subject.middleTargetLevel,
      lower: subject.lowerTargetLevel,
    });
    expect(presentation.lattice.targetLevelByRegion).toEqual({
      upper: 4,
      middle: 2,
      lower: 0,
    });
    expect(presentation.subjectBoundsWorldMm).toBe(presentation.lattice.bounds);
    expect(presentation.referenceGrid.centerWorldMm).toEqual(geometry.grid.center);
    expect(presentation.referenceGrid.cellSizeMm).toBe(subject.cubeSizeMm);
    expect(presentation.lightingTargetWorldMm).toEqual(subject.originWorld);
    expect(targetCentreFor(presentation.lattice, "upper")).toEqual({
      x: 0,
      y: 520,
      z: 2000,
    });
    expect(targetCentreFor(presentation.lattice, "middle")).toEqual({
      x: 0,
      y: 0,
      z: 2000,
    });
    expect(targetCentreFor(presentation.lattice, "lower")).toEqual({
      x: 0,
      y: -520,
      z: 2000,
    });
  });

  it("does not import Three.js or asset implementation into the semantic scene definition", () => {
    const definitionSource = readFileSync(
      resolve(process.cwd(), "src/scenes/definitions/understanding-camera-movements.ts"),
      "utf8",
    );
    const presentationSource = readFileSync(
      resolve(process.cwd(), "src/scenes/presentation/understandingCameraMovements.ts"),
      "utf8",
    );

    expect(definitionSource).not.toMatch(/from\s+["']three(?:\/|["'])/);
    expect(definitionSource).not.toMatch(/from\s+["'][^"']*assets\//);
    expect(presentationSource).not.toMatch(/from\s+["']three(?:\/|["'])/);
    expect(presentationSource).not.toMatch(/from\s+["'][^"']*assets\//);
  });

  it("uses the same consumer seam for production and substitute assets without changing semantic results", () => {
    const presentation: CameraMovementLatticePresentation =
      CAMERA_MOVEMENT_BASELINE_PRESENTATION;
    const options: CameraMovementsGroupOptions =
      cameraMovementsGroupOptionsFromPresentation(presentation, "middle");
    const resultsBeforeReplacement = sceneSemanticResults();
    const productionFactorySpy = vi.spyOn(
      cameraMovementLatticeAsset,
      "createCameraMovementsGroup",
    );
    let productionAsset: THREE.Group | null = null;
    let substituteAsset: THREE.Group | null = null;
    const scene = new THREE.Scene();

    try {
      productionAsset = createCameraMovementLatticeAsset(options);
      expect(productionFactorySpy).toHaveBeenCalledTimes(1);
      const productionFactoryOptions = productionFactorySpy.mock.calls[0]?.[0];
      expect(productionFactoryOptions).toBe(options);
      if (
        !productionFactoryOptions ||
        typeof productionFactoryOptions !== "object"
      ) {
        throw new Error("The default asset factory did not receive presentation options");
      }
      expect(productionFactoryOptions.presentation).toBe(presentation);
      expect(productionAsset.userData.canonicalEdgeCount).toBe(
        presentation.lattice.edges.length,
      );
      const productionAssetReference = productionAsset;
      disposeCameraMovementsGroup(productionAsset);
      productionAsset = null;

      const substituteGroup = new THREE.Group();
      substituteGroup.name = "substitute:" + presentation.object.id;
      substituteGroup.userData.semanticObjectId = presentation.object.id;
      substituteGroup.position.set(3, -2, 5);
      substituteGroup.add(new THREE.Object3D());
      const substituteFactory = vi.fn(
        (receivedOptions: CameraMovementsGroupOptions) => {
          expect(receivedOptions.presentation).toBe(presentation);
          return substituteGroup;
        },
      );

      substituteAsset = createCameraMovementLatticeAsset(
        options,
        substituteFactory,
      );

      expect(substituteFactory).toHaveBeenCalledTimes(1);
      expect(substituteFactory.mock.calls[0][0]).toBe(options);
      expect(substituteAsset).toBe(substituteGroup);
      expect(substituteAsset).not.toBe(productionAssetReference);
      expect(substituteAsset.position.toArray()).toEqual([3, -2, 5]);
      expect(substituteAsset.userData.canonicalEdgeCount).toBeUndefined();
      expect(substituteAsset.children).toHaveLength(1);
      expect(productionFactorySpy).toHaveBeenCalledTimes(1);

      scene.add(substituteAsset);
      expect(substituteAsset.parent).toBe(scene);
      expect(sceneSemanticResults()).toEqual(resultsBeforeReplacement);
      expect(sceneSemanticResults().optics.selectedTargetWorld).toEqual({
        x: 0,
        y: 0,
        z: 2000,
      });
      expect(sceneSemanticResults().lattice.targets.middle).toEqual({
        x: 0,
        y: 0,
        z: 2000,
      });
    } finally {
      if (productionAsset) disposeCameraMovementsGroup(productionAsset);
      if (substituteAsset?.parent) substituteAsset.parent.remove(substituteAsset);
      substituteAsset?.clear();
      productionFactorySpy.mockRestore();
    }
  });
});

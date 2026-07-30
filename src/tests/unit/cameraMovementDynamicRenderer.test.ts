import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  cameraMovementsGroupOptionsFromRenderModel,
  createCameraMovementsGroup,
  disposeCameraMovementsGroup,
} from "../../render/CameraMovementsSubjectFactory";
import {
  CAMERA_MOVEMENT_BASELINE_RENDER_MODEL,
  resolveCameraMovementLatticeRenderModel,
} from "../../render/cameraMovementLatticeRenderModel";
import {
  mountCameraMovementRttSubject,
  unmountCameraMovementRttSubject,
} from "../../render/cameraMovementRttSubjectLifecycle";
import {
  createRegisteredRttSubject,
  disposeRegisteredRttSubject,
  getSceneSubjectRegistration,
} from "../../render/sceneSubjectRegistry";
import {
  CAMERA_MOVEMENT_CALIBRATION_BASELINE,
  resolveEffectiveCameraMovementCalibration,
} from "../../scenes/cameraMovementEffectiveCalibration";
import {
  CAMERA_MOVEMENT_SELECTED_TEACHING_CALIBRATION,
  CAMERA_MOVEMENT_TEACHING_CASE_IDS,
  createCameraMovementTeachingCases,
} from "../../scenes/cameraMovementTeachingCalibration";

const resolveModel = (
  overrides: Parameters<typeof resolveEffectiveCameraMovementCalibration>[1] = {},
) =>
  resolveCameraMovementLatticeRenderModel(
    resolveEffectiveCameraMovementCalibration(
      CAMERA_MOVEMENT_CALIBRATION_BASELINE,
      overrides,
    ),
  );

const collectOwnedResources = (group: THREE.Group) => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    if (
      !(object instanceof THREE.Mesh) &&
      !(object instanceof THREE.LineSegments)
    ) {
      return;
    }
    geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    objectMaterials.forEach((material) => materials.add(material));
  });
  return { geometries, materials };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dynamic camera-movement lattice render model", () => {
  it("changes geometry identity only for geometry-affecting calibration", () => {
    const baseline = resolveModel();
    const presentation = resolveModel({
      presentation: { inactiveColour: "#123456" },
    });
    const optics = resolveModel({
      optics: { provisionalFocalLengthMm: 120 },
    });
    const rig = resolveModel({
      rig: { arcAngleDeg: 22 },
    });
    const geometry = resolveModel({
      geometry: { columns: 4 },
    });

    expect(presentation.geometryId).toBe(baseline.geometryId);
    expect(optics.geometryId).toBe(baseline.geometryId);
    expect(rig.geometryId).toBe(baseline.geometryId);
    expect(geometry.geometryId).not.toBe(baseline.geometryId);
    expect(presentation.presentationKey).not.toBe(baseline.presentationKey);
    expect(optics.presentationKey).toBe(baseline.presentationKey);
    expect(rig.presentationKey).toBe(baseline.presentationKey);
  });

  it("reuses one canonical lattice object for presentation, optics, and rig edits", () => {
    const baseline = resolveModel();
    const presentation = resolveModel({
      presentation: { internalEdgeOpacity: 0.7 },
    });
    const optics = resolveModel({
      optics: { provisionalFocusDistanceMm: 2400 },
    });
    const rig = resolveModel({
      rig: { provisionalBasePitchDeg: 3 },
    });

    expect(presentation.lattice).toBe(baseline.lattice);
    expect(optics.lattice).toBe(baseline.lattice);
    expect(rig.lattice).toBe(baseline.lattice);
  });

  it("publishes deterministic unique edge IDs and exact finite bounds", () => {
    const model = resolveModel({
      geometry: {
        columns: 4,
        rows: 2,
        levels: 4,
        cubeSizeMm: 180,
        horizontalGapMm: 12,
        verticalGapMm: 20,
        subjectDistanceMm: 2300,
      },
    });
    const edgeIds = model.lattice.edges.map(({ id }) => id);
    const allPoints = model.lattice.vertices.flatMap(({ positionWorld }) => [
      positionWorld.x,
      positionWorld.y,
      positionWorld.z,
    ]);

    expect(edgeIds.length).toBeGreaterThan(0);
    expect(new Set(edgeIds).size).toBe(edgeIds.length);
    expect(allPoints.every(Number.isFinite)).toBe(true);
    expect(model.subjectBounds).toBe(model.lattice.bounds);
    expect(model.subjectBounds.min.x).toBeLessThan(model.subjectBounds.max.x);
    expect(model.subjectBounds.min.y).toBeLessThan(model.subjectBounds.max.y);
    expect(model.subjectBounds.min.z).toBeLessThan(model.subjectBounds.max.z);
  });

  it("feeds the same effective lattice and identity to interactive and RTT groups", () => {
    const model = resolveModel({
      geometry: { columns: 4, levels: 4 },
      presentation: { internalEdgeOpacity: 0.6 },
    });
    const interactive = createCameraMovementsGroup(
      cameraMovementsGroupOptionsFromRenderModel(model, "upper"),
    );
    const rtt = createRegisteredRttSubject(
      "understanding-camera-movements",
      {
        targetRegion: "upper",
        cameraMovementRenderModel: model,
      },
    )!;
    try {
      expect(interactive.userData.canonicalGeometryId).toBe(model.geometryId);
      expect(rtt.userData.canonicalGeometryId).toBe(model.geometryId);
      expect(interactive.userData.canonicalEdgeIds).toEqual(
        model.lattice.edges.map(({ id }) => id),
      );
      expect(rtt.userData.canonicalEdgeIds).toEqual(
        interactive.userData.canonicalEdgeIds,
      );
      expect(rtt.userData.canonicalBounds).toBe(model.lattice.bounds);
    } finally {
      disposeCameraMovementsGroup(interactive);
      disposeRegisteredRttSubject(
        "understanding-camera-movements",
        rtt,
      );
    }
  });

  it("keeps canonical R3F and RTT geometry stable across every selected teaching case", () => {
    const model = resolveModel();
    const teachingCases = createCameraMovementTeachingCases(
      CAMERA_MOVEMENT_SELECTED_TEACHING_CALIBRATION,
    );

    for (const caseId of CAMERA_MOVEMENT_TEACHING_CASE_IDS) {
      const teachingCase = teachingCases[caseId];
      const interactive = createCameraMovementsGroup(
        cameraMovementsGroupOptionsFromRenderModel(
          model,
          teachingCase.targetRegion,
        ),
      );
      const rtt = createRegisteredRttSubject(
        "understanding-camera-movements",
        {
          targetRegion: teachingCase.targetRegion,
          cameraMovementRenderModel: model,
        },
      )!;
      try {
        expect(interactive.userData.canonicalGeometryId, caseId).toBe(
          model.geometryId,
        );
        expect(rtt.userData.canonicalGeometryId, caseId).toBe(
          model.geometryId,
        );
        expect(interactive.userData.canonicalEdgeCount, caseId).toBe(
          model.lattice.edges.length,
        );
        expect(rtt.userData.canonicalEdgeCount, caseId).toBe(
          model.lattice.edges.length,
        );
        expect(rtt.userData.canonicalEdgeIds, caseId).toEqual(
          interactive.userData.canonicalEdgeIds,
        );
        expect(rtt.userData.targetRegion, caseId).toBe(
          teachingCase.targetRegion,
        );
      } finally {
        disposeCameraMovementsGroup(interactive);
        disposeRegisteredRttSubject(
          "understanding-camera-movements",
          rtt,
        );
      }
    }
  });

  it("derives grid, lighting, bounds, and registry diagnostics from the same model", () => {
    const model = resolveModel({
      geometry: {
        columns: 4,
        cubeSizeMm: 200,
        subjectDistanceMm: 2500,
      },
    });
    const registration = getSceneSubjectRegistration(
      "understanding-camera-movements",
    )!;
    const options = { cameraMovementRenderModel: model };
    const diagnostics = registration.resolveCanonicalLattice?.(options);
    const lighting = registration.resolveRttLighting?.(options);
    const group = createCameraMovementsGroup(
      cameraMovementsGroupOptionsFromRenderModel(model),
    );
    try {
      const grid = group.getObjectByName(
        "camera-movements-reference-grid",
      ) as THREE.GridHelper;
      expect(diagnostics).toMatchObject({
        geometryId: model.geometryId,
        geometryKey: model.geometryKey,
        presentationKey: model.presentationKey,
        edgeCount: model.lattice.edges.length,
      });
      expect(diagnostics?.bounds).toBe(model.subjectBounds);
      expect(lighting?.targetMm).toEqual(model.lightingTargetMm);
      expect(grid.userData.geometryKey).toBe(model.geometryKey);
      expect(grid.userData.cellSizeMm).toBe(model.grid.cellSizeMm);
      expect(grid.userData.halfExtentMm).toBe(model.grid.halfExtentMm);
    } finally {
      disposeCameraMovementsGroup(group);
    }
  });
});

describe("camera-movement RTT subject lifecycle", () => {
  it("replaces presentation resources without changing physical geometry or RTT graph resources", () => {
    const scene = new THREE.Scene();
    const colorTarget = new THREE.WebGLRenderTarget(8, 8);
    const postTarget = new THREE.WebGLRenderTarget(8, 8);
    const disposeColorTarget = vi.spyOn(colorTarget, "dispose");
    const disposePostTarget = vi.spyOn(postTarget, "dispose");
    const baseline = CAMERA_MOVEMENT_BASELINE_RENDER_MODEL;
    const first = mountCameraMovementRttSubject(scene, baseline, "middle");
    const firstResources = collectOwnedResources(first.group);
    const firstGeometryDispose = [
      ...firstResources.geometries,
    ].map((resource) => vi.spyOn(resource, "dispose"));
    const presentation = resolveModel({
      presentation: {
        inactiveColour: "#334455",
        internalEdgeOpacity: 0.7,
      },
    });

    unmountCameraMovementRttSubject(first);
    const replacement = mountCameraMovementRttSubject(
      scene,
      presentation,
      "middle",
    );

    expect(first.group.parent).toBeNull();
    expect(first.group.userData.resourcesDisposed).toBe(true);
    firstGeometryDispose.forEach((spy) =>
      expect(spy).toHaveBeenCalledTimes(1),
    );
    expect(replacement.runtimeInfo.geometryId).toBe(
      first.runtimeInfo.geometryId,
    );
    expect(replacement.runtimeInfo.presentationKey).not.toBe(
      first.runtimeInfo.presentationKey,
    );
    expect(replacement.runtimeInfo.generation).toBeGreaterThan(
      first.runtimeInfo.generation,
    );
    expect(scene.children.filter((child) =>
      child.name === "camera-movements-lattice-subject",
    )).toEqual([replacement.group]);
    expect(disposeColorTarget).not.toHaveBeenCalled();
    expect(disposePostTarget).not.toHaveBeenCalled();

    unmountCameraMovementRttSubject(replacement);
    colorTarget.dispose();
    postTarget.dispose();
  });

  it("removes stale groups and disposes every owned resource exactly once across repeated cleanup", () => {
    const scene = new THREE.Scene();
    const mounted = mountCameraMovementRttSubject(
      scene,
      CAMERA_MOVEMENT_BASELINE_RENDER_MODEL,
      "lower",
    );
    const resources = collectOwnedResources(mounted.group);
    const spies = [
      ...[...resources.geometries].map((resource) =>
        vi.spyOn(resource, "dispose"),
      ),
      ...[...resources.materials].map((resource) =>
        vi.spyOn(resource, "dispose"),
      ),
    ];

    unmountCameraMovementRttSubject(mounted);
    unmountCameraMovementRttSubject(mounted);

    expect(mounted.group.parent).toBeNull();
    expect(scene.getObjectByName("camera-movements-lattice-subject")).toBeUndefined();
    spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    expect(mounted.group.userData.disposedGeometryCount).toBe(
      resources.geometries.size,
    );
    expect(mounted.group.userData.disposedMaterialCount).toBe(
      resources.materials.size,
    );
  });
});

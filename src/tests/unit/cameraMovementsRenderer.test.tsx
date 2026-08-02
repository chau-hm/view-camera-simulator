import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  CAMERA_MOVEMENT_LATTICE_GEOMETRY_ID,
  CameraMovementsSubject,
  clearInteractiveLatticeRuntime,
  createCameraMovementsGroup,
  disposeCameraMovementsGroup,
  applyCameraMovementsGroupStyle,
  publishAttachedInteractiveLatticeRuntime,
  updateAttachedInteractiveLatticeRuntime,
} from "../../render/CameraMovementsSubjectFactory";
import {
  mountCameraMovementRttSubject,
  unmountCameraMovementRttSubject,
  updateCameraMovementRttSubjectTarget,
} from "../../render/cameraMovementRttSubjectLifecycle";
import { CAMERA_MOVEMENT_BASELINE_RENDER_MODEL } from "../../render/cameraMovementLatticeRenderModel";
import { CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES } from "../../scenes/cameraMovementPublicTeaching";
import { CAMERA_MOVEMENT_LATTICE } from "../../scenes/cameraMovementLatticeGeometry";
import { CAMERA_MOVEMENT_SCENE_CALIBRATION } from "../../scenes/cameraMovementSceneCalibration";
import { getSceneSubjectRegistration } from "../../render/sceneSubjectRegistry";

const fiberTestState = vi.hoisted(() => ({ scene: undefined as unknown }));

vi.mock("@react-three/fiber", () => ({
  useThree: <T,>(
    selector: (state: { scene: THREE.Scene }) => T,
  ): T => selector({ scene: fiberTestState.scene as THREE.Scene }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Camera Movements subject factory", () => {
  it("does not publish mounted runtime state from registry metadata or factory creation", () => {
    useAppStore.getState().setInteractiveLatticeRuntimeInfo(null);
    expect(
      getSceneSubjectRegistration("understanding-camera-movements")
        ?.canonicalLattice?.edgeCount,
    ).toBe(CAMERA_MOVEMENT_LATTICE.edges.length);
    const group = createCameraMovementsGroup("middle");
    try {
      expect(useAppStore.getState().interactiveLatticeRuntimeInfo).toBeNull();
    } finally {
      disposeCameraMovementsGroup(group);
    }
  });

  it("publishes only scene-attached groups and advances generation across replacements", () => {
    useAppStore.getState().setInteractiveLatticeRuntimeInfo(null);
    const scene = new THREE.Scene();
    const unattached = createCameraMovementsGroup("upper");
    expect(
      publishAttachedInteractiveLatticeRuntime(unattached, scene),
    ).toBeNull();
    expect(useAppStore.getState().interactiveLatticeRuntimeInfo).toBeNull();

    scene.add(unattached);
    const first = publishAttachedInteractiveLatticeRuntime(unattached, scene);
    expect(first).toEqual({
      mounted: true,
      geometryId: unattached.userData.canonicalGeometryId,
      geometryKey: unattached.userData.canonicalGeometryKey,
      presentationKey: unattached.userData.presentationKey,
      resourceKey: unattached.userData.resourceKey,
      edgeCount: unattached.userData.canonicalEdgeCount,
      targetRegion: "upper",
      generation: unattached.userData.interactiveMountGeneration,
    });

    const firstGeneration = first!.generation;
    const firstResourceKey = first!.resourceKey;
    const updated = updateAttachedInteractiveLatticeRuntime(unattached, "lower");
    expect(updated?.targetRegion).toBe("lower");
    expect(updated?.generation).toBe(firstGeneration);
    expect(updated?.resourceKey).toBe(firstResourceKey);
    expect(unattached.userData.resourceKey).toBe(firstResourceKey);

    scene.remove(unattached);
    clearInteractiveLatticeRuntime(first);
    disposeCameraMovementsGroup(unattached);
    expect(useAppStore.getState().interactiveLatticeRuntimeInfo).toBeNull();

    const replacement = createCameraMovementsGroup("middle");
    scene.add(replacement);
    const second = publishAttachedInteractiveLatticeRuntime(
      replacement,
      scene,
    );
    expect(second?.targetRegion).toBe("middle");
    expect(second?.generation).toBeGreaterThan(first!.generation);
    scene.remove(replacement);
    clearInteractiveLatticeRuntime(second);
    disposeCameraMovementsGroup(replacement);

    const remount = createCameraMovementsGroup("middle");
    scene.add(remount);
    const third = publishAttachedInteractiveLatticeRuntime(remount, scene);
    expect(third?.generation).toBeGreaterThan(second!.generation);
    scene.remove(remount);
    clearInteractiveLatticeRuntime(third);
    disposeCameraMovementsGroup(remount);
    expect(useAppStore.getState().interactiveLatticeRuntimeInfo).toBeNull();
  });

  it.each(["upper", "middle", "lower"] as const)(
    "renders every canonical edge exactly once for the %s target region",
    (targetRegion) => {
      const group = createCameraMovementsGroup(targetRegion);
      try {
        const renderedEdgeIds = group.children.flatMap(
          (child) => child.userData.canonicalEdgeIds as string[],
        );
        expect(group.userData.targetRegion).toBe(targetRegion);
        expect(group.userData.canonicalGeometryId).toBe(
          CAMERA_MOVEMENT_LATTICE_GEOMETRY_ID,
        );
        expect(group.userData.canonicalEdgeCount).toBe(
          CAMERA_MOVEMENT_LATTICE.edges.length,
        );
        expect(renderedEdgeIds).toHaveLength(CAMERA_MOVEMENT_LATTICE.edges.length);
        expect(new Set(renderedEdgeIds).size).toBe(renderedEdgeIds.length);
        expect([...renderedEdgeIds].sort()).toEqual(
          CAMERA_MOVEMENT_LATTICE.edges.map(({ id }) => id).sort(),
        );
      } finally {
        disposeCameraMovementsGroup(group);
      }
    },
  );

  it("uses calibrated role weights, internal opacity, and selected-region colour", () => {
    const group = createCameraMovementsGroup("middle");
    try {
      const roleWeights = new Map<string, Set<number>>();
      group.children.forEach((child) => {
        const role = child.userData.edgeRole as string;
        const weights = roleWeights.get(role) ?? new Set<number>();
        weights.add(child.userData.lineWeight as number);
        roleWeights.set(role, weights);
        if (role === "internal") {
          expect(child.userData.lineOpacity).toBe(
            CAMERA_MOVEMENT_SCENE_CALIBRATION.presentation.internalEdgeOpacity,
          );
        }
      });
      expect([...roleWeights.get("outer-vertical")!]).toEqual([
        CAMERA_MOVEMENT_SCENE_CALIBRATION.presentation.outerVerticalWeight,
      ]);
      expect([...roleWeights.get("outer-horizontal")!]).toEqual([
        CAMERA_MOVEMENT_SCENE_CALIBRATION.presentation.outerHorizontalWeight,
      ]);
      expect([...roleWeights.get("internal")!]).toEqual([
        CAMERA_MOVEMENT_SCENE_CALIBRATION.presentation.internalEdgeWeight,
      ]);
      expect(
        CAMERA_MOVEMENT_SCENE_CALIBRATION.presentation.outerVerticalWeight,
      ).toBeGreaterThan(
        CAMERA_MOVEMENT_SCENE_CALIBRATION.presentation.outerHorizontalWeight,
      );
      expect(
        CAMERA_MOVEMENT_SCENE_CALIBRATION.presentation.outerHorizontalWeight,
      ).toBeGreaterThan(
        CAMERA_MOVEMENT_SCENE_CALIBRATION.presentation.internalEdgeWeight,
      );
    } finally {
      disposeCameraMovementsGroup(group);
    }
  });

  it("owns fresh resource sets and disposes every unique resource exactly once", () => {
    const first = createCameraMovementsGroup("middle");
    const second = createCameraMovementsGroup("middle");
    const collect = (group: THREE.Group) => {
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      group.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          geometries.add(object.geometry);
          const objectMaterials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          objectMaterials.forEach((material) => materials.add(material));
        }
      });
      return { geometries, materials };
    };
    const firstResources = collect(first);
    const secondResources = collect(second);
    firstResources.geometries.forEach((resource) =>
      expect(secondResources.geometries.has(resource)).toBe(false),
    );
    firstResources.materials.forEach((resource) =>
      expect(secondResources.materials.has(resource)).toBe(false),
    );
    const disposeSpies = [
      ...[...firstResources.geometries].map((resource) => vi.spyOn(resource, "dispose")),
      ...[...firstResources.materials].map((resource) => vi.spyOn(resource, "dispose")),
    ];

    disposeCameraMovementsGroup(first);
    disposeCameraMovementsGroup(first);

    disposeSpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    disposeCameraMovementsGroup(second);
  });

  it("replaces a region-specific group with a fresh owned generation", () => {
    const scene = new THREE.Scene();
    const first = createCameraMovementsGroup("upper");
    scene.add(first);
    scene.remove(first);
    disposeCameraMovementsGroup(first);
    const replacement = createCameraMovementsGroup("middle");
    scene.add(replacement);

    expect(first.parent).toBeNull();
    expect(first.userData.resourcesDisposed).toBe(true);
    expect(replacement).not.toBe(first);
    expect(replacement.parent).toBe(scene);
    expect(replacement.userData.targetRegion).toBe("middle");
    expect(replacement.userData.canonicalEdgeIds).toEqual(
      first.userData.canonicalEdgeIds,
    );
    scene.remove(replacement);
    disposeCameraMovementsGroup(replacement);
  });

  it("updates target presentation in place without replacing owned resources", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: understandingCameraMovementsScene.id,
    });
    useAppStore.setState((state) => ({
      scene: { ...state.scene, targetRegion: "upper" },
    }));
    fiberTestState.scene = new THREE.Scene();
    const mountedGroups: THREE.Group[] = [];
    const onGroupChange = vi.fn((group: THREE.Group | null) => {
      if (group) mountedGroups.push(group);
    });
    const view = render(<CameraMovementsSubject onGroupChange={onGroupChange} />);

    const assertCanonicalGroup = (
      group: THREE.Group,
      targetRegion: "upper" | "middle" | "lower",
    ) => {
      expect(group.userData.targetRegion).toBe(targetRegion);
      expect(group.userData.canonicalEdgeIds).toEqual(
        CAMERA_MOVEMENT_LATTICE.edges.map(({ id }) => id),
      );
    };
    const first = mountedGroups[0];
    assertCanonicalGroup(first, "upper");
    expect(useAppStore.getState().interactiveLatticeRuntimeInfo).toBeNull();
    const firstGeometry = (first.children[0] as THREE.Mesh).geometry;
    const firstMaterial = (first.children[0] as THREE.Mesh).material;
    const disposeFirstGeometry = vi.spyOn(firstGeometry!, "dispose");

    act(() =>
      useAppStore.setState((state) => ({
        scene: { ...state.scene, targetRegion: "middle" },
      })),
    );

    const second = mountedGroups[0];
    expect(second).toBe(first);
    expect(first.userData.resourcesDisposed).not.toBe(true);
    expect(disposeFirstGeometry).not.toHaveBeenCalled();
    expect((first.children[0] as THREE.Mesh).geometry).toBe(firstGeometry);
    expect((first.children[0] as THREE.Mesh).material).toBe(firstMaterial);
    assertCanonicalGroup(second, "middle");
    expect(useAppStore.getState().interactiveLatticeRuntimeInfo).toBeNull();

    act(() =>
      useAppStore.setState((state) => ({
        scene: { ...state.scene, targetRegion: "lower" },
      })),
    );

    const third = mountedGroups[0];
    expect(third).toBe(second);
    expect(second.userData.resourcesDisposed).not.toBe(true);
    expect(disposeFirstGeometry).not.toHaveBeenCalled();
    assertCanonicalGroup(third, "lower");
    expect(useAppStore.getState().interactiveLatticeRuntimeInfo).toBeNull();

    view.unmount();
    expect(third.userData.resourcesDisposed).toBe(true);
    expect(disposeFirstGeometry).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().interactiveLatticeRuntimeInfo).toBeNull();
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(String(consoleError.mock.calls[0]?.[0])).toContain(
      "The tag <%s> is unrecognized",
    );
    expect(consoleError.mock.calls[0]?.[1]).toBe("primitive");
    consoleError.mockRestore();
  });

  it("keeps both subjects stable across the complete public teaching transition sequence", () => {
    useAppStore.getState().setInteractiveLatticeRuntimeInfo(null);
    const scene = new THREE.Scene();
    const interactive = createCameraMovementsGroup("middle");
    scene.add(interactive);
    const initialInteractive = publishAttachedInteractiveLatticeRuntime(
      interactive,
      scene,
    );
    expect(initialInteractive).not.toBeNull();

    const rtt = mountCameraMovementRttSubject(
      scene,
      CAMERA_MOVEMENT_BASELINE_RENDER_MODEL,
      "middle",
    );
    const initialGeometryId = interactive.userData.canonicalGeometryId;
    const initialEdgeCount = interactive.userData.canonicalEdgeCount;
    const initialResourceKey = interactive.userData.resourceKey;
    const initialInteractiveGeneration = initialInteractive!.generation;
    const initialRttGeneration = rtt.runtimeInfo.generation;
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    for (const group of [interactive, rtt.group]) {
      group.traverse((object) => {
        const candidate = object as THREE.Mesh;
        if (candidate.geometry) geometries.add(candidate.geometry);
        const objectMaterials = Array.isArray(candidate.material)
          ? candidate.material
          : candidate.material
            ? [candidate.material]
            : [];
        objectMaterials.forEach((material) => materials.add(material));
      });
    }
    const geometryDisposals = [...geometries].map((geometry) =>
      vi.spyOn(geometry, "dispose"),
    );
    const materialDisposals = [...materials].map((material) =>
      vi.spyOn(material, "dispose"),
    );
    const sequence = [
      "neutral",
      "A-front-tilt",
      "B-rear-tilt",
      "C1-front-rise",
      "C2-rear-rise",
      "C3-high-viewpoint",
      "D1-front-fall",
      "D2-rear-fall",
      "D3-low-viewpoint",
      "neutral",
    ] as const;

    for (const caseId of sequence) {
      const targetRegion = CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES[caseId].targetRegion;
      applyCameraMovementsGroupStyle(
        interactive,
        CAMERA_MOVEMENT_BASELINE_RENDER_MODEL.presentation,
        targetRegion,
      );
      updateAttachedInteractiveLatticeRuntime(interactive, targetRegion);
      updateCameraMovementRttSubjectTarget(
        rtt,
        CAMERA_MOVEMENT_BASELINE_RENDER_MODEL,
        targetRegion,
      );

      const interactiveRuntime = useAppStore.getState().interactiveLatticeRuntimeInfo;
      expect(interactive.userData.canonicalGeometryId, caseId).toBe(initialGeometryId);
      expect(rtt.group.userData.canonicalGeometryId, caseId).toBe(initialGeometryId);
      expect(interactive.userData.canonicalEdgeCount, caseId).toBe(initialEdgeCount);
      expect(rtt.group.userData.canonicalEdgeCount, caseId).toBe(initialEdgeCount);
      expect(interactive.userData.resourceKey, caseId).toBe(initialResourceKey);
      expect(rtt.group.userData.resourceKey, caseId).toBe(initialResourceKey);
      expect(interactive.userData.targetRegion, caseId).toBe(targetRegion);
      expect(rtt.group.userData.targetRegion, caseId).toBe(targetRegion);
      expect(interactiveRuntime?.targetRegion, caseId).toBe(targetRegion);
      expect(interactiveRuntime?.generation, caseId).toBe(initialInteractiveGeneration);
      expect(rtt.runtimeInfo.generation, caseId).toBe(initialRttGeneration);
      expect(
        interactive.getObjectByName(`camera-movements-lattice-outer-vertical-${targetRegion}`)
          ?.userData.selectedTarget,
        caseId,
      ).toBe(true);
      geometryDisposals.forEach((spy) => expect(spy, caseId).not.toHaveBeenCalled());
      materialDisposals.forEach((spy) => expect(spy, caseId).not.toHaveBeenCalled());
    }

    unmountCameraMovementRttSubject(rtt);
    scene.remove(interactive);
    clearInteractiveLatticeRuntime(initialInteractive);
    disposeCameraMovementsGroup(interactive);
    geometryDisposals.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    materialDisposals.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    expect(useAppStore.getState().interactiveLatticeRuntimeInfo).toBeNull();
  });

  it("replaces mounted resources on presentation and geometry calibration keys", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: understandingCameraMovementsScene.id,
      calibrationEnabled: true,
    });
    fiberTestState.scene = new THREE.Scene();
    const mountedGroups: THREE.Group[] = [];
    const view = render(
      <CameraMovementsSubject
        onGroupChange={(group) => {
          if (group) mountedGroups.push(group);
        }}
      />,
    );
    const baseline = mountedGroups[0];
    const baselineGeometryId = baseline.userData.canonicalGeometryId;
    const baselinePresentationKey = baseline.userData.presentationKey;
    const disposeBaseline = vi.spyOn(
      (baseline.children[0] as THREE.LineSegments).geometry,
      "dispose",
    );

    act(() => {
      expect(
        useAppStore.getState().updateCameraMovementCalibration({
          presentation: { inactiveColour: "#334455" },
        }),
      ).toBe(true);
    });

    const presentationReplacement = mountedGroups[1];
    expect(presentationReplacement).not.toBe(baseline);
    expect(presentationReplacement.userData.canonicalGeometryId).toBe(
      baselineGeometryId,
    );
    expect(presentationReplacement.userData.presentationKey).not.toBe(
      baselinePresentationKey,
    );
    expect(disposeBaseline).toHaveBeenCalledTimes(1);
    const disposePresentation = vi.spyOn(
      (presentationReplacement.children[0] as THREE.LineSegments).geometry,
      "dispose",
    );

    act(() => {
      expect(
        useAppStore.getState().updateCameraMovementCalibration({
          geometry: { columns: 4 },
        }),
      ).toBe(true);
    });

    const geometryReplacement = mountedGroups[2];
    expect(geometryReplacement.userData.canonicalGeometryId).not.toBe(
      baselineGeometryId,
    );
    expect(geometryReplacement.userData.canonicalEdgeCount).not.toBe(
      baseline.userData.canonicalEdgeCount,
    );
    expect(disposePresentation).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(geometryReplacement.userData.resourcesDisposed).toBe(true);
    consoleError.mockRestore();
  });

  it("keeps the mounted lattice stable across effective optics and rig edits", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: understandingCameraMovementsScene.id,
      calibrationEnabled: true,
    });
    fiberTestState.scene = new THREE.Scene();
    const mountedGroups: THREE.Group[] = [];
    const view = render(
      <CameraMovementsSubject
        onGroupChange={(group) => {
          if (group) mountedGroups.push(group);
        }}
      />,
    );
    const initialGroup = mountedGroups[0];

    act(() => {
      expect(
        useAppStore.getState().updateCameraMovementCalibration({
          optics: { provisionalFocusDistanceMm: 2400 },
          rig: { arcAngleDeg: 22 },
        }),
      ).toBe(true);
    });

    expect(mountedGroups).toEqual([initialGroup]);
    expect(initialGroup.userData.resourcesDisposed).not.toBe(true);
    view.unmount();
    consoleError.mockRestore();
  });

  it("keeps the mounted lattice group stable across viewpoint and body-pitch optics changes", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: understandingCameraMovementsScene.id,
    });
    fiberTestState.scene = new THREE.Scene();
    const mountedGroups: THREE.Group[] = [];
    const view = render(
      <CameraMovementsSubject
        onGroupChange={(group) => {
          if (group) mountedGroups.push(group);
        }}
      />,
    );
    const initialGroup = mountedGroups[0];
    const initialGeneration = initialGroup.userData.interactiveMountGeneration;
    const initialGeometryId = initialGroup.userData.canonicalGeometryId;
    const initialGeometry = (initialGroup.children[0] as THREE.Mesh).geometry;
    const disposeGeometry = vi.spyOn(initialGeometry, "dispose");

    act(() => {
      useAppStore.getState().setCameraMovementViewpointAnchor("high");
      useAppStore.getState().setCameraBodyPitchDeg(8);
    });

    expect(mountedGroups).toEqual([initialGroup]);
    expect(initialGroup.userData.interactiveMountGeneration).toBe(
      initialGeneration,
    );
    expect(initialGroup.userData.canonicalGeometryId).toBe(initialGeometryId);
    expect(initialGroup.userData.resourcesDisposed).not.toBe(true);
    expect(disposeGeometry).not.toHaveBeenCalled();

    view.unmount();
    expect(disposeGeometry).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it("does not publish when React mounts the component without R3F attachment", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fiberTestState.scene = new THREE.Scene();
    const first = render(<CameraMovementsSubject />);
    expect(useAppStore.getState().interactiveLatticeRuntimeInfo).toBeNull();
    first.unmount();
    expect(useAppStore.getState().interactiveLatticeRuntimeInfo).toBeNull();
    consoleError.mockRestore();
  });

  it("renders the subject component without errors", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fiberTestState.scene = new THREE.Scene();
    const view = render(<CameraMovementsSubject />);
    consoleError.mockRestore();
    expect(view.container).toBeDefined();
  });
});

import { useAppStore } from "../../state/appStore";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";

describe("Camera Movements optics derivation", () => {
  beforeAll(() => {
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: "understanding-camera-movements",
    });
  });

  function buildCamera(overrides: Partial<ReturnType<typeof useAppStore.getState>["camera"]> = {}) {
    const base = useAppStore.getState().camera;
    return { ...base, ...overrides } as ReturnType<typeof useAppStore.getState>["camera"];
  }

  it("produces zero original and current overlap at rest", () => {
    const current = buildCamera();
    const currentOptics = deriveOpticsState(current, understandingCameraMovementsScene);

    const original = buildCamera({
      frontRiseMm: 0,
      rearRiseMm: 0,
      frontTiltDeg: 0,
      rearTiltDeg: 0,
      frontSwingDeg: 0,
    });
    const originalOptics = deriveOpticsState(original, understandingCameraMovementsScene);

    expect(currentOptics.lensCenterWorld).toEqual(originalOptics.lensCenterWorld);
    expect(currentOptics.filmCenterWorld).toEqual(originalOptics.filmCenterWorld);
  });

  it("front rise moves current lens but not original", () => {
    const original = buildCamera({
      frontRiseMm: 0,
      rearRiseMm: 0,
      frontTiltDeg: 0,
      rearTiltDeg: 0,
      frontSwingDeg: 0,
    });
    const originalOptics = deriveOpticsState(original, understandingCameraMovementsScene);

    const current = buildCamera({ frontRiseMm: 25 });
    const currentOptics = deriveOpticsState(current, understandingCameraMovementsScene);

    expect(currentOptics.lensCenterWorld.y).toBeGreaterThan(originalOptics.lensCenterWorld.y);
    expect(currentOptics.filmCenterWorld).toEqual(originalOptics.filmCenterWorld);
  });

  it("rear rise moves current film but not original", () => {
    const original = buildCamera({
      frontRiseMm: 0,
      rearRiseMm: 0,
      frontTiltDeg: 0,
      rearTiltDeg: 0,
      frontSwingDeg: 0,
    });
    const originalOptics = deriveOpticsState(original, understandingCameraMovementsScene);

    const current = buildCamera({ rearRiseMm: 20 });
    const currentOptics = deriveOpticsState(current, understandingCameraMovementsScene);

    expect(currentOptics.filmCenterWorld.y).toBeGreaterThan(originalOptics.filmCenterWorld.y);
    expect(currentOptics.lensCenterWorld).toEqual(originalOptics.lensCenterWorld);
  });

  it("front tilt changes lens normal but not original", () => {
    const original = buildCamera({
      frontRiseMm: 0,
      rearRiseMm: 0,
      frontTiltDeg: 0,
      rearTiltDeg: 0,
      frontSwingDeg: 0,
    });
    const originalOptics = deriveOpticsState(original, understandingCameraMovementsScene);

    const current = buildCamera({ frontTiltDeg: 5 });
    const currentOptics = deriveOpticsState(current, understandingCameraMovementsScene);

    expect(currentOptics.lensNormalWorld.y).not.toEqual(originalOptics.lensNormalWorld.y);
    expect(currentOptics.lensCenterWorld).toEqual(originalOptics.lensCenterWorld);
  });

  it("rear tilt changes film normal but not original", () => {
    const original = buildCamera({
      frontRiseMm: 0,
      rearRiseMm: 0,
      frontTiltDeg: 0,
      rearTiltDeg: 0,
      frontSwingDeg: 0,
    });
    const originalOptics = deriveOpticsState(original, understandingCameraMovementsScene);

    const current = buildCamera({ rearTiltDeg: 5 });
    const currentOptics = deriveOpticsState(current, understandingCameraMovementsScene);

    expect(currentOptics.filmNormalWorld.y).not.toEqual(originalOptics.filmNormalWorld.y);
  });

  it("cameraInspectionPlacement is present", () => {
    expect(understandingCameraMovementsScene.cameraInspectionPlacement).toBeDefined();
  });
});

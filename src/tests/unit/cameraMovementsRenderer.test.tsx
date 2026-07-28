import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  CAMERA_MOVEMENT_LATTICE_GEOMETRY_ID,
  CameraMovementsSubject,
  createCameraMovementsGroup,
  disposeCameraMovementsGroup,
} from "../../render/CameraMovementsSubjectFactory";
import { CAMERA_MOVEMENT_LATTICE } from "../../scenes/cameraMovementLatticeGeometry";
import { CAMERA_MOVEMENT_SCENE_CALIBRATION } from "../../scenes/cameraMovementSceneCalibration";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Camera Movements subject factory", () => {
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

  it("replaces the mounted subject group for a store-driven target-region change", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: understandingCameraMovementsScene.id,
    });
    useAppStore.setState((state) => ({
      scene: { ...state.scene, targetRegion: "upper" },
    }));
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
    const firstGeometry = (first.children[0] as THREE.Mesh).geometry;
    const disposeFirstGeometry = vi.spyOn(firstGeometry!, "dispose");

    act(() =>
      useAppStore.setState((state) => ({
        scene: { ...state.scene, targetRegion: "middle" },
      })),
    );

    const second = mountedGroups[1];
    expect(second).not.toBe(first);
    expect(first.userData.resourcesDisposed).toBe(true);
    expect(disposeFirstGeometry).toHaveBeenCalledTimes(1);
    assertCanonicalGroup(second, "middle");
    const secondGeometry = (second.children[0] as THREE.Mesh).geometry;
    const disposeSecondGeometry = vi.spyOn(secondGeometry!, "dispose");

    act(() =>
      useAppStore.setState((state) => ({
        scene: { ...state.scene, targetRegion: "lower" },
      })),
    );

    const third = mountedGroups[2];
    expect(third).not.toBe(second);
    expect(second.userData.resourcesDisposed).toBe(true);
    expect(disposeSecondGeometry).toHaveBeenCalledTimes(1);
    assertCanonicalGroup(third, "lower");

    const thirdGeometry = (third.children[0] as THREE.Mesh).geometry;
    const disposeThirdGeometry = vi.spyOn(thirdGeometry!, "dispose");
    view.unmount();
    expect(third.userData.resourcesDisposed).toBe(true);
    expect(disposeThirdGeometry).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(String(consoleError.mock.calls[0]?.[0])).toContain(
      "The tag <%s> is unrecognized",
    );
    expect(consoleError.mock.calls[0]?.[1]).toBe("primitive");
    consoleError.mockRestore();
  });

  it("renders the subject component without errors", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
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

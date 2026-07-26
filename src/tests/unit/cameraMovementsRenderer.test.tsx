import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  CameraMovementsSubject,
  createCameraMovementsGroup,
  disposeCameraMovementsGroup,
} from "../../render/CameraMovementsSubjectFactory";
import { getSubjectLayout } from "../../scenes/understandingCameraMovementsGeometry";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Camera Movements subject factory", () => {
  it.each([1, 2, 3] as const)("creates the canonical %i-cube layout", (count) => {
    const countedGroup = createCameraMovementsGroup(count);
    try {
      const layout = getSubjectLayout(count);
      expect(countedGroup.userData.subjectCount).toBe(count);
      expect(countedGroup.getObjectByName("camera-movements-grid")).not.toBeNull();
      layout.cubes.forEach((cube) => {
        const renderedCube = countedGroup.getObjectByName(cube.id) as THREE.Group;
        expect(renderedCube).toBeInstanceOf(THREE.Group);
        expect(renderedCube.children.filter((child) => child instanceof THREE.LineSegments)).toHaveLength(12);
        expect(
          renderedCube.children.filter(
            (child) => child instanceof THREE.Mesh && child.geometry.type === "SphereGeometry",
          ),
        ).toHaveLength(8);
      });
    } finally {
      disposeCameraMovementsGroup(countedGroup);
    }
  });

  it("owns fresh resource sets and disposes every unique resource exactly once", () => {
    const first = createCameraMovementsGroup(3);
    const second = createCameraMovementsGroup(3);
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

  it("replaces a count-specific group with a fresh owned generation", () => {
    const scene = new THREE.Scene();
    const first = createCameraMovementsGroup(1);
    scene.add(first);
    scene.remove(first);
    disposeCameraMovementsGroup(first);
    const replacement = createCameraMovementsGroup(3);
    scene.add(replacement);

    expect(first.parent).toBeNull();
    expect(first.userData.resourcesDisposed).toBe(true);
    expect(replacement).not.toBe(first);
    expect(replacement.parent).toBe(scene);
    expect(replacement.userData.subjectCount).toBe(3);
    expect(
      getSubjectLayout(3).cubes.filter((cube) => replacement.getObjectByName(cube.id)),
    ).toHaveLength(3);
    scene.remove(replacement);
    disposeCameraMovementsGroup(replacement);
  });

  it("replaces the mounted subject group for each store-driven count change", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: understandingCameraMovementsScene.id,
    });
    useAppStore.getState().setSubjectCount(1);
    const mountedGroups: THREE.Group[] = [];
    const onGroupChange = vi.fn((group: THREE.Group | null) => {
      if (group) mountedGroups.push(group);
    });
    const view = render(<CameraMovementsSubject onGroupChange={onGroupChange} />);

    const assertCanonicalGroup = (group: THREE.Group, count: 1 | 2 | 3) => {
      expect(group.userData.subjectCount).toBe(count);
      expect(
        getSubjectLayout(count).cubes.filter((cube) => group.getObjectByName(cube.id)),
      ).toHaveLength(count);
    };
    const first = mountedGroups[0];
    assertCanonicalGroup(first, 1);
    const firstGeometry = (
      first.getObjectByName("camera-movements-cube-middle") as THREE.Group
    ).children.find((child) => child instanceof THREE.Mesh)?.geometry;
    const disposeFirstGeometry = vi.spyOn(firstGeometry!, "dispose");

    act(() => useAppStore.getState().setSubjectCount(2));

    const second = mountedGroups[1];
    expect(second).not.toBe(first);
    expect(first.userData.resourcesDisposed).toBe(true);
    expect(disposeFirstGeometry).toHaveBeenCalledTimes(1);
    assertCanonicalGroup(second, 2);
    const secondGeometry = (
      second.getObjectByName("camera-movements-cube-upper") as THREE.Group
    ).children.find((child) => child instanceof THREE.Mesh)?.geometry;
    const disposeSecondGeometry = vi.spyOn(secondGeometry!, "dispose");

    act(() => useAppStore.getState().setSubjectCount(3));

    const third = mountedGroups[2];
    expect(third).not.toBe(second);
    expect(second.userData.resourcesDisposed).toBe(true);
    expect(disposeSecondGeometry).toHaveBeenCalledTimes(1);
    assertCanonicalGroup(third, 3);

    const thirdGeometry = (
      third.getObjectByName("camera-movements-cube-middle") as THREE.Group
    ).children.find((child) => child instanceof THREE.Mesh)?.geometry;
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

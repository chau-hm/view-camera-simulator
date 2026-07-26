import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  CameraMovementsSubject,
  createCameraMovementsGroup,
  disposeCameraMovementsGroup,
} from "../../render/CameraMovementsSubjectFactory";
import { getSubjectLayout } from "../../scenes/understandingCameraMovementsGeometry";

afterEach(cleanup);

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

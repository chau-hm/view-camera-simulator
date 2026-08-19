import { cleanup, render } from "@testing-library/react";
import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShelfSwingSubject } from "../../render/ShelfSwingSubjectFactory";
import {
  ArchitectureRiseRegisteredSubject,
  createRegisteredRttSubject,
  disposeRegisteredRttSubject,
  getRegisteredSceneSubject,
  getSceneSubjectRegistration,
  sceneSubjectRegistry,
} from "../../render/sceneSubjectRegistry";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import geometry from "../../scenes/shelfSwingGeometry";
import { CAMERA_MOVEMENT_LATTICE } from "../../scenes/cameraMovementLatticeGeometry";
import { CAMERA_MOVEMENT_SCENE_CALIBRATION } from "../../scenes/cameraMovementSceneCalibration";
import { CAMERA_MOVEMENT_LATTICE_GEOMETRY_ID } from "../../render/CameraMovementsSubjectFactory";

afterEach(cleanup);

const collectDisposableSpies = (group: THREE.Group) => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach((material) => materials.add(material));
  });
  return [
    ...[...geometries].map((resource) => vi.spyOn(resource, "dispose")),
    ...[...materials].map((resource) => vi.spyOn(resource, "dispose")),
  ];
};

describe("scene subject registry", () => {
  it("registers every canonical rendered scene and rejects unknown IDs", () => {
    expect(Object.keys(sceneSubjectRegistry)).toEqual([
      "understanding-camera-movements",
      "focus-fundamentals-two-targets",
      "architecture-rise",
      "oblique-architecture",
      "table-tilt",
      "shelf-swing",
      "mirror-shift",
    ]);
    Object.keys(sceneSubjectRegistry).forEach((sceneId) => {
      expect(getSceneSubjectRegistration(sceneId)).toBeDefined();
      expect(getRegisteredSceneSubject(sceneId)).toBeDefined();
    });
    expect(getSceneSubjectRegistration("not-a-scene")).toBeUndefined();
    expect(getRegisteredSceneSubject("not-a-scene")).toBeUndefined();
    expect(createRegisteredRttSubject("not-a-scene")).toBeNull();
  });

  it("resolves Shelf Swing to its shared React subject and canonical RTT factory", () => {
    expect(getRegisteredSceneSubject("shelf-swing")).toBe(ShelfSwingSubject);
    const group = createRegisteredRttSubject("shelf-swing");
    expect(group).not.toBeNull();
    expect(group?.name).toBe("shelf-swing-subject");
    expect(group?.getObjectByName("shelf-swing-floor")).toBeInstanceOf(THREE.Mesh);
    geometry.subjects.forEach((subject) => {
      expect(group?.getObjectByName(subject.semanticName)).toBeInstanceOf(THREE.Group);
      expect(group?.getObjectByName(subject.focusChart.semanticName)).toBeInstanceOf(THREE.Group);
    });
    disposeRegisteredRttSubject("shelf-swing", group!);
  });

  it("resolves Mirror Shift to the shared static reflection subject and RTT factory", () => {
    const registration = getSceneSubjectRegistration("mirror-shift");
    expect(registration).toBeDefined();
    expect(getRegisteredSceneSubject("mirror-shift")).toBe(registration?.SceneSubject);

    const group = createRegisteredRttSubject("mirror-shift");
    expect(group?.name).toBe("mirror-shift-subject");
    expect(group?.getObjectByName("mirror-shift-mirror-surface")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("mirror-shift-camera-reflection")).toBeInstanceOf(THREE.Group);
    disposeRegisteredRttSubject("mirror-shift", group!);
  });

  it("resolves Oblique Architecture to one shared static subject for 3D and RTT", () => {
    const registration = getSceneSubjectRegistration("oblique-architecture");
    expect(registration).toBeDefined();
    const group = createRegisteredRttSubject("oblique-architecture");
    expect(group?.name).toBe("oblique-architecture-subject");
    expect(group?.getObjectByName("oblique-architecture-building")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("oblique-architecture-corner")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("oblique-architecture-target-facade")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("oblique-architecture-side-window-2-1")).toBeInstanceOf(THREE.Group);
    expect(group?.getObjectByName("oblique-architecture-side-window-2-7")).toBeInstanceOf(THREE.Group);
    expect(group?.getObjectByName("oblique-architecture-focus-facade-middle")).toBeInstanceOf(THREE.Object3D);
    const spies = collectDisposableSpies(group!);
    disposeRegisteredRttSubject("oblique-architecture", group!);
    spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  });

  it("registers canonical lattice identity and calibration-driven ghost policy", () => {
    const registration = getSceneSubjectRegistration(
      "understanding-camera-movements",
    );
    expect(registration?.canonicalLattice).toEqual({
      geometryId: CAMERA_MOVEMENT_LATTICE_GEOMETRY_ID,
      edgeCount: CAMERA_MOVEMENT_LATTICE.edges.length,
    });
    expect(registration?.showReferenceCamera).toBe(
      CAMERA_MOVEMENT_SCENE_CALIBRATION.presentation.showReferenceCamera,
    );
    expect(registration?.showReferenceCamera).toBe(false);
  });

  it.each(["shelf-swing", "table-tilt", "oblique-architecture"])(
    "uses the explicit unique-resource disposer for %s",
    (sceneId) => {
      const group = createRegisteredRttSubject(sceneId)!;
      const spies = collectDisposableSpies(group);
      expect(spies.length).toBeGreaterThan(0);

      disposeRegisteredRttSubject(sceneId, group);

      spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    },
  );

  it.each(["focus-fundamentals-two-targets", "architecture-rise"])(
    "does not generically dispose shared factory resources for %s",
    (sceneId) => {
      expect(getSceneSubjectRegistration(sceneId)?.disposeRttGroup).toBeUndefined();
    },
  );

  it("keeps Architecture Rise canonical focus markers in registered rendering", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = render(<ArchitectureRiseRegisteredSubject scene={architectureRiseScene} />);
    consoleError.mockRestore();

    architectureRiseScene.focusTargets.forEach((target) => {
      expect(
        view.container.querySelector(
          `[name="architecture-focus-target-${target.id}"]`,
        ),
      ).not.toBeNull();
    });
  });

  it("derives Shelf Swing RTT lighting from the middle canonical focus chart", () => {
    const lighting = getSceneSubjectRegistration("shelf-swing")?.rttLighting;
    expect(lighting?.targetMm).toEqual(geometry.middleSubject.focusDetailProbeWorld);
    expect(lighting?.keyOffsetWorld).toEqual({ x: -2.5, y: 3.5, z: -2.5 });
    expect(lighting?.fillOffsetWorld).toEqual({ x: 2.5, y: 1.5, z: -1.5 });
  });
});

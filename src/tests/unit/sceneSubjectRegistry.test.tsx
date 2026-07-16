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
      "focus-fundamentals-two-targets",
      "architecture-rise",
      "table-tilt",
      "shelf-swing",
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

  it.each(["shelf-swing", "table-tilt"])(
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

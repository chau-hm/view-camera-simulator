import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  createRegisteredRttSubject,
  disposeRegisteredRttSubject,
  getSceneSubjectRegistration,
} from "../../render/sceneSubjectRegistry";
import geometry from "../../scenes/shelfSwingGeometry";

describe("GroundGlassRTT registered Shelf Swing lifecycle", () => {
  it("creates the canonical charts without the generic fallback subject", () => {
    const group = createRegisteredRttSubject("shelf-swing")!;
    try {
      expect(group.name).toBe("shelf-swing-subject");
      expect(group.getObjectByName("shelf-swing-floor")).toBeInstanceOf(THREE.Mesh);
      geometry.subjects.forEach((subject) => {
        expect(group.getObjectByName(subject.focusChart.semanticName)).toBeInstanceOf(THREE.Group);
      });
      expect(group.children.some((child) => child.name === "ground-glass-fallback-floor")).toBe(false);
    } finally {
      disposeRegisteredRttSubject("shelf-swing", group);
    }
  });

  it("disposes a Shelf Swing group exactly once during teardown", () => {
    const group = createRegisteredRttSubject("shelf-swing")!;
    const geometryResource = (group.getObjectByName("shelf-swing-floor") as THREE.Mesh).geometry;
    const dispose = vi.spyOn(geometryResource, "dispose");

    disposeRegisteredRttSubject("shelf-swing", group);

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("recreates independent groups and retains Table Tilt explicit disposal", () => {
    const first = createRegisteredRttSubject("shelf-swing")!;
    const second = createRegisteredRttSubject("shelf-swing")!;
    expect(second).not.toBe(first);
    expect(second.parent).toBeNull();
    disposeRegisteredRttSubject("shelf-swing", first);
    disposeRegisteredRttSubject("shelf-swing", second);

    expect(getSceneSubjectRegistration("table-tilt")?.disposeRttGroup).toBeDefined();
    expect(getSceneSubjectRegistration("architecture-rise")?.disposeRttGroup).toBeUndefined();
  });

  it("removes and disposes a Shelf group before creating a fresh replacement", () => {
    const scene = new THREE.Scene();
    const first = createRegisteredRttSubject("shelf-swing")!;
    const firstFloor = first.getObjectByName("shelf-swing-floor") as THREE.Mesh;
    const disposeFirstFloor = vi.spyOn(firstFloor.geometry, "dispose");
    scene.add(first);

    scene.remove(first);
    disposeRegisteredRttSubject("shelf-swing", first);
    const replacement = createRegisteredRttSubject("shelf-swing")!;
    scene.add(replacement);

    expect(first.parent).toBeNull();
    expect(disposeFirstFloor).toHaveBeenCalledTimes(1);
    expect(replacement).not.toBe(first);
    expect(replacement.parent).toBe(scene);
    expect(replacement.getObjectByName("shelf-swing-floor")).toBeInstanceOf(THREE.Mesh);

    scene.remove(replacement);
    disposeRegisteredRttSubject("shelf-swing", replacement);
  });
});

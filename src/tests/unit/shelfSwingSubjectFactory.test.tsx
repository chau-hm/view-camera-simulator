import { render } from "@testing-library/react";
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  createShelfSwingGroup,
  disposeShelfSwingGroup,
  ShelfSwingSubject,
} from "../../render/ShelfSwingSubjectFactory";
import { toWorld } from "../../render/rttUtils";
import geometry from "../../scenes/shelfSwingGeometry";

describe("Shelf Swing subject factory", () => {
  it("creates stable floor, station, probe, and sample semantics from canonical geometry", () => {
    const group = createShelfSwingGroup();
    try {
      expect(group.name).toBe("shelf-swing-subject");
      expect(group.getObjectByName("shelf-swing-floor")).toBeInstanceOf(THREE.Mesh);
      group.updateMatrixWorld(true);

      geometry.subjects.forEach((subject) => {
        expect(group.getObjectByName(subject.semanticName)).toBeInstanceOf(THREE.Group);
        const chart = group.getObjectByName(subject.focusChart.semanticName);
        expect(chart).toBeInstanceOf(THREE.Group);
        const chartTile = chart?.children.find((child) => child instanceof THREE.Mesh);
        expect(chartTile).toBeInstanceOf(THREE.Mesh);
        const chartNormal = new THREE.Vector3(0, 0, 1).transformDirection(chartTile!.matrixWorld);
        const chartWorld = new THREE.Vector3();
        chart!.getWorldPosition(chartWorld);
        expect(chartNormal.dot(chartWorld.clone().negate().normalize())).toBeGreaterThan(0);
        const probe = group.getObjectByName(subject.focusProbeSemanticName);
        expect(probe).toBeInstanceOf(THREE.Object3D);
        expect(probe?.userData).toEqual({
          focusTargetId: subject.id,
          focusProbeWorldMm: subject.focusDetailProbeWorld,
        });

        const probeWorld = new THREE.Vector3();
        probe!.getWorldPosition(probeWorld);
        expect(probeWorld.x).toBeCloseTo(toWorld(subject.focusDetailProbeWorld.x), 10);
        expect(probeWorld.y).toBeCloseTo(toWorld(subject.focusDetailProbeWorld.y), 10);
        expect(probeWorld.z).toBeCloseTo(toWorld(subject.focusDetailProbeWorld.z), 10);

        subject.focusSamples.forEach((sample) => {
          const node = group.getObjectByName(`${subject.semanticName}-focus-sample-${sample.id}`);
          expect(node).toBeInstanceOf(THREE.Object3D);
          expect(node?.userData).toEqual({
            focusTargetId: subject.id,
            focusSampleId: sample.id,
            focusSampleWorldMm: sample.worldPosition,
          });
          const sampleWorld = new THREE.Vector3();
          node!.getWorldPosition(sampleWorld);
          expect(sampleWorld.x).toBeCloseTo(toWorld(sample.worldPosition.x), 10);
          expect(sampleWorld.y).toBeCloseTo(toWorld(sample.worldPosition.y), 10);
          expect(sampleWorld.z).toBeCloseTo(toWorld(sample.worldPosition.z), 10);
        });
      });
    } finally {
      disposeShelfSwingGroup(group);
    }
  });

  it("disposes each unique geometry and material exactly once", () => {
    const group = createShelfSwingGroup();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
      meshMaterials.forEach((material) => materials.add(material));
    });
    const geometrySpies = [...geometries].map((resource) => vi.spyOn(resource, "dispose"));
    const materialSpies = [...materials].map((resource) => vi.spyOn(resource, "dispose"));

    disposeShelfSwingGroup(group);

    geometrySpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    materialSpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  });

  it("mounts the React wrapper as one primitive and disposes its factory output on unmount", () => {
    const geometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
    const materialDispose = vi.spyOn(THREE.Material.prototype, "dispose");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = render(<ShelfSwingSubject />);
    consoleError.mockRestore();

    expect(view.container.querySelectorAll("primitive")).toHaveLength(1);
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(materialDispose).not.toHaveBeenCalled();

    view.unmount();
    expect(geometryDispose).toHaveBeenCalled();
    expect(materialDispose).toHaveBeenCalled();
    geometryDispose.mockRestore();
    materialDispose.mockRestore();
  });
});

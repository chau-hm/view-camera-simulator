import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  MaterialAwareBasicNodeMaterial,
  MaterialAwareLineNodeMaterial,
  MaterialAwareStandardNodeMaterial,
  adaptObserverMaterialForOutput,
} from "../../render/backend/materialAwareNodeMaterials";
import { observerOutputSourceMaterial } from "../../render/backend/observerMaterialOutputIdentity";
import { disposeTeachingSubjectResources } from "../../render/TeachingMaterials";

const texture = (colorSpace: THREE.ColorSpace): THREE.DataTexture => {
  const value = new THREE.DataTexture(new Uint8Array([120, 140, 160, 255]), 1, 1);
  value.colorSpace = colorSpace;
  value.repeat.set(3, 5);
  value.wrapS = THREE.RepeatWrapping;
  value.wrapT = THREE.RepeatWrapping;
  value.needsUpdate = true;
  return value;
};

describe("material-aware Observer NodeMaterial adaptation", () => {
  it("preserves Standard material maps, PBR values, and authored render policy", () => {
    const albedo = texture(THREE.SRGBColorSpace);
    const roughnessMap = texture(THREE.NoColorSpace);
    const normalMap = texture(THREE.NoColorSpace);
    const source = new THREE.MeshStandardMaterial({
      color: "#d7c19c",
      map: albedo,
      roughnessMap,
      normalMap,
      roughness: 0.94,
      metalness: 0.08,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      toneMapped: false,
    });
    source.normalScale.set(0.3, 0.3);

    const adapted = adaptObserverMaterialForOutput(source) as MaterialAwareStandardNodeMaterial | null;

    expect(adapted).toBeInstanceOf(MaterialAwareStandardNodeMaterial);
    expect(adapted?.map).toBe(albedo);
    expect(adapted?.roughnessMap).toBe(roughnessMap);
    expect(adapted?.normalMap).toBe(normalMap);
    expect(adapted?.color.getHexString()).toBe(source.color.getHexString());
    expect(adapted?.roughness).toBe(0.94);
    expect(adapted?.metalness).toBe(0.08);
    expect(adapted?.normalScale.toArray()).toEqual([0.3, 0.3]);
    expect(adapted?.map?.repeat.toArray()).toEqual([3, 5]);
    expect(adapted?.map?.wrapS).toBe(THREE.RepeatWrapping);
    expect(adapted?.map?.wrapT).toBe(THREE.RepeatWrapping);
    expect(adapted?.map?.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(adapted?.roughnessMap?.colorSpace).toBe(THREE.NoColorSpace);
    expect(adapted?.normalMap?.colorSpace).toBe(THREE.NoColorSpace);
    expect(adapted).toMatchObject({
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      toneMapped: false,
    });
    expect((adapted as typeof adapted & { [observerOutputSourceMaterial]?: THREE.Material })[
      observerOutputSourceMaterial
    ]).toBe(source);

    adapted?.dispose();
    source.dispose();
    albedo.dispose();
    roughnessMap.dispose();
    normalMap.dispose();
  });

  it("uses the unlit NodeMaterial equivalents for Basic and line families", () => {
    const basic = new THREE.MeshBasicMaterial({
      color: "#16a34a",
      transparent: true,
      opacity: 0.42,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const line = new THREE.LineBasicMaterial({
      color: "#60a5fa",
      transparent: true,
      opacity: 0.69,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });

    const adaptedBasic = adaptObserverMaterialForOutput(basic);
    const adaptedLine = adaptObserverMaterialForOutput(line);

    expect(adaptedBasic).toBeInstanceOf(MaterialAwareBasicNodeMaterial);
    expect(adaptedLine).toBeInstanceOf(MaterialAwareLineNodeMaterial);
    expect(adaptedBasic).toMatchObject({
      color: basic.color,
      transparent: true,
      opacity: 0.42,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    expect(adaptedLine).toMatchObject({
      transparent: true,
      opacity: 0.69,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });

    adaptedBasic?.dispose();
    adaptedLine?.dispose();
    basic.dispose();
    line.dispose();
  });

  it("fails closed for a material family outside the audited set", () => {
    const unsupported = new THREE.MeshPhysicalMaterial({ clearcoat: 0.5 });
    expect(adaptObserverMaterialForOutput(unsupported)).toBeNull();
    unsupported.dispose();
  });

  it("lets the registered subject owner dispose the source, NodeMaterial, texture, and geometry once", () => {
    const albedo = texture(THREE.SRGBColorSpace);
    const source = new THREE.MeshStandardMaterial({ map: albedo });
    const adapted = adaptObserverMaterialForOutput(source);
    if (!adapted) throw new Error("Expected an adapted standard material");
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const root = new THREE.Group();
    root.name = "architecture-rise-subject";
    root.userData.resources = { source, geometry, albedo };
    root.add(new THREE.Mesh(geometry, adapted));
    const sourceDispose = vi.spyOn(source, "dispose");
    const adaptedDispose = vi.spyOn(adapted, "dispose");
    const textureDispose = vi.spyOn(albedo, "dispose");
    const geometryDispose = vi.spyOn(geometry, "dispose");

    disposeTeachingSubjectResources(root);

    expect(sourceDispose).toHaveBeenCalledTimes(1);
    expect(adaptedDispose).toHaveBeenCalledTimes(1);
    expect(textureDispose).toHaveBeenCalledTimes(1);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
  });
});

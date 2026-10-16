import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  MaterialAwareMaterialTracker,
  createObserverControllerMaterialOutputOwner,
  type MaterialOutputOwner,
} from "../../render/backend/materialAwareMaterialTracker";
import { resolveArchitectureRiseMaterialOutputOwner } from "../../render/backend/architectureRiseMaterialOutputAdapter";
import {
  MaterialAwareBasicNodeMaterial,
  MaterialAwareLineNodeMaterial,
  MaterialAwareStandardNodeMaterial,
} from "../../render/backend/materialAwareNodeMaterials";
import {
  getObserverMaterialSignatures,
} from "../../render/backend/observerMaterialSignatures";
import {
  observerOutputOwnerIdentity,
  observerOutputTrackerIdentity,
} from "../../render/backend/observerMaterialOutputIdentity";
import { disposeTeachingSubjectResources } from "../../render/TeachingMaterials";

const reconcile = (
  tracker: MaterialAwareMaterialTracker,
  mesh: THREE.Mesh,
  owner: MaterialOutputOwner = tracker.controllerOwner,
  frame = 1,
): ReturnType<MaterialAwareMaterialTracker["reconcileRenderable"]> => {
  const result = tracker.reconcileRenderable(mesh, owner, frame, getObserverMaterialSignatures);
  if (result.materials.some((material, index) => material !== (
    Array.isArray(mesh.material) ? mesh.material[index] : mesh.material
  ))) {
    mesh.material = Array.isArray(mesh.material) ? result.materials : result.materials[0]!;
  }
  return result;
};

const outputMaterial = (mesh: THREE.Mesh): THREE.Material => {
  if (Array.isArray(mesh.material)) throw new Error("Expected a single attached material");
  return mesh.material;
};

const createOwner = (
  kind: MaterialOutputOwner["kind"],
  identity: object = {},
) => {
  const outputs = new Set<THREE.Material>();
  const dispose = vi.fn((output: THREE.Material) => {
    if (outputs.delete(output)) output.dispose();
  });
  const owner: MaterialOutputOwner = {
    identity,
    kind,
    retain: (output) => { outputs.add(output); },
    release: dispose,
  };
  return { owner, outputs, dispose };
};

describe("material-aware Observer output tracking", () => {
  it("separates uniform property changes from shader-relevant changes", () => {
    const source = new THREE.MeshStandardMaterial({ color: "#334455" });
    const initial = getObserverMaterialSignatures(source);

    source.color.set("#ddeeff");
    const colorChanged = getObserverMaterialSignatures(source);
    expect(colorChanged.signature).not.toBe(initial.signature);
    expect(colorChanged.shaderSignature).toBe(initial.shaderSignature);

    source.side = THREE.DoubleSide;
    const sideChanged = getObserverMaterialSignatures(source);
    expect(sideChanged.signature).not.toBe(colorChanged.signature);
    expect(sideChanged.shaderSignature).not.toBe(colorChanged.shaderSignature);
    source.dispose();
  });

  it("updates in-place source properties and recompiles only for shader changes", () => {
    const source = new THREE.MeshStandardMaterial({ color: "#334455" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const tracker = new MaterialAwareMaterialTracker(7);
    const first = reconcile(tracker, mesh).materials[0]!;
    const firstVersion = first.version;

    source.color.set("#ddeeff");
    source.opacity = 0.42;
    reconcile(tracker, mesh, tracker.controllerOwner, 2);
    expect(outputMaterial(mesh)).toBe(first);
    expect((first as THREE.MeshStandardMaterial).color.getHexString()).toBe("ddeeff");
    expect(first.opacity).toBe(0.42);
    expect(first.version).toBe(firstVersion);

    source.transparent = true;
    const versionBeforeTransparencyChange = first.version;
    reconcile(tracker, mesh, tracker.controllerOwner, 3);
    expect(first.transparent).toBe(true);
    expect(first.version).toBeGreaterThan(versionBeforeTransparencyChange);

    source.side = THREE.DoubleSide;
    const versionBeforeShaderChange = first.version;
    reconcile(tracker, mesh, tracker.controllerOwner, 4);
    expect(first.side).toBe(THREE.DoubleSide);
    expect(first.version).toBeGreaterThan(versionBeforeShaderChange);

    tracker.dispose();
    expect(mesh.material).toBe(source);
    source.dispose();
    mesh.geometry.dispose();
  });

  it("adapts supported families and reports an unsupported family without replacing it", () => {
    const standard = new THREE.MeshStandardMaterial();
    const basic = new THREE.MeshBasicMaterial();
    const line = new THREE.LineBasicMaterial();
    const unsupported = new THREE.MeshPhysicalMaterial({ clearcoat: 0.5 });
    const tracker = new MaterialAwareMaterialTracker(1);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), standard);
    const standardOutput = reconcile(tracker, mesh).materials[0]!;
    const basicMesh = new THREE.Mesh(new THREE.BoxGeometry(), basic);
    const basicOutput = reconcile(tracker, basicMesh).materials[0]!;
    const lineMesh = new THREE.Line(new THREE.BufferGeometry(), line);
    const lineOutput = tracker.reconcileRenderable(
      lineMesh as THREE.Line & { material: THREE.Material | THREE.Material[] },
      tracker.controllerOwner,
      1,
      getObserverMaterialSignatures,
    ).materials[0]!;
    lineMesh.material = lineOutput as THREE.LineBasicMaterial;
    const unsupportedMesh = new THREE.Mesh(new THREE.BoxGeometry(), unsupported);
    const unsupportedResult = reconcile(tracker, unsupportedMesh);

    expect(standardOutput).toBeInstanceOf(MaterialAwareStandardNodeMaterial);
    expect(basicOutput).toBeInstanceOf(MaterialAwareBasicNodeMaterial);
    expect(lineOutput).toBeInstanceOf(MaterialAwareLineNodeMaterial);
    expect(unsupportedResult.unsupported).toEqual([
      { objectName: "Mesh", materialFamily: "MeshPhysicalMaterial" },
    ]);
    expect(unsupportedResult.materials[0]).toBe(unsupported);
    expect(unsupportedMesh.material).toBe(unsupported);

    tracker.dispose();
    standard.dispose();
    basic.dispose();
    line.dispose();
    unsupported.dispose();
    mesh.geometry.dispose();
    basicMesh.geometry.dispose();
    lineMesh.geometry.dispose();
    unsupportedMesh.geometry.dispose();
  });

  it("adapts a replacement source and releases the old copy after its stale window", () => {
    const sourceA = new THREE.MeshStandardMaterial({ color: "#223344" });
    const sourceB = new THREE.MeshStandardMaterial({ color: "#aa8844" });
    const sourceADispose = vi.spyOn(sourceA, "dispose");
    const sourceBDispose = vi.spyOn(sourceB, "dispose");
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), sourceA);
    const tracker = new MaterialAwareMaterialTracker(2);
    const outputA = reconcile(tracker, mesh).materials[0]!;
    const outputADispose = vi.spyOn(outputA, "dispose");

    mesh.material = sourceB;
    const outputB = reconcile(tracker, mesh, tracker.controllerOwner, 2).materials[0]!;
    const outputBDispose = vi.spyOn(outputB, "dispose");
    expect(outputB).not.toBe(outputA);
    expect(mesh.material).toBe(outputB);
    expect(tracker.releaseStaleMaterials(2)).toBe(0);
    expect(tracker.releaseStaleMaterials(3)).toBe(1);
    expect(outputADispose).toHaveBeenCalledTimes(1);
    expect(sourceADispose).not.toHaveBeenCalled();

    tracker.dispose();
    expect(mesh.material).toBe(sourceB);
    expect(outputBDispose).toHaveBeenCalledTimes(1);
    expect(sourceBDispose).not.toHaveBeenCalled();
    sourceA.dispose();
    sourceB.dispose();
    mesh.geometry.dispose();
  });

  it("reuses one output for same-owner mesh assignments and keeps it until the final reference leaves", () => {
    const source = new THREE.MeshStandardMaterial();
    const firstMesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const secondMesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const tracker = new MaterialAwareMaterialTracker(3);
    const firstOutput = reconcile(tracker, firstMesh).materials[0]!;
    const secondOutput = reconcile(tracker, secondMesh).materials[0]!;
    const outputDispose = vi.spyOn(firstOutput, "dispose");

    expect(secondOutput).toBe(firstOutput);
    const secondReplacement = new THREE.MeshPhysicalMaterial();
    secondMesh.material = secondReplacement;
    reconcile(tracker, secondMesh, tracker.controllerOwner, 2);
    reconcile(tracker, firstMesh, tracker.controllerOwner, 2);
    expect(tracker.releaseStaleMaterials(2)).toBe(0);
    expect(outputDispose).not.toHaveBeenCalled();

    const firstReplacement = new THREE.MeshPhysicalMaterial();
    firstMesh.material = firstReplacement;
    reconcile(tracker, firstMesh, tracker.controllerOwner, 3);
    expect(tracker.releaseStaleMaterials(3)).toBe(0);
    expect(tracker.releaseStaleMaterials(4)).toBe(1);
    expect(outputDispose).toHaveBeenCalledTimes(1);

    tracker.dispose();
    source.dispose();
    firstMesh.geometry.dispose();
    secondMesh.geometry.dispose();
    firstReplacement.dispose();
    secondReplacement.dispose();
  });

  it("keeps different owner domains separate and rejects conflicting reuse of one owner identity", () => {
    const source = new THREE.MeshStandardMaterial();
    const firstMesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const secondMesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const tracker = new MaterialAwareMaterialTracker(4);
    const registered = createOwner("registered-subject");
    const controller = createOwner("observer-controller");

    const registeredOutput = reconcile(tracker, firstMesh, registered.owner).materials[0]!;
    const controllerOutput = reconcile(tracker, secondMesh, controller.owner).materials[0]!;
    expect(controllerOutput).not.toBe(registeredOutput);
    expect(registered.outputs.has(registeredOutput)).toBe(true);
    expect(controller.outputs.has(controllerOutput)).toBe(true);

    const conflictingOwner = createOwner("observer-controller", registered.owner.identity);
    const conflictingMesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
    expect(() => reconcile(tracker, conflictingMesh, conflictingOwner.owner, 2)).toThrow(
      "Conflicting material-output ownership policies share one owner identity",
    );

    tracker.dispose();
    expect(registered.dispose).toHaveBeenCalledWith(registeredOutput);
    expect(controller.dispose).toHaveBeenCalledWith(controllerOutput);
    source.dispose();
    firstMesh.geometry.dispose();
    secondMesh.geometry.dispose();
    conflictingMesh.geometry.dispose();
  });

  it("lets the Architecture Rise subject disposer own adapted copies without double disposal", () => {
    const source = new THREE.MeshStandardMaterial({ color: "#8899aa" });
    const geometry = new THREE.BoxGeometry();
    const root = new THREE.Group();
    root.name = "architecture-rise-subject";
    const adaptedOutputMaterials = new Set<THREE.Material>();
    root.userData.resources = { source, adaptedOutputMaterials };
    const mesh = new THREE.Mesh(geometry, source);
    root.add(mesh);
    const tracker = new MaterialAwareMaterialTracker(8);
    const owner = resolveArchitectureRiseMaterialOutputOwner(mesh, tracker.controllerOwner);
    const output = tracker.reconcileRenderable(mesh, owner, 1, getObserverMaterialSignatures).materials[0]!;
    const outputDispose = vi.spyOn(output, "dispose");
    const sourceDispose = vi.spyOn(source, "dispose");
    const geometryDispose = vi.spyOn(geometry, "dispose");

    expect(owner.kind).toBe("registered-subject");
    expect(adaptedOutputMaterials.has(output)).toBe(true);
    disposeTeachingSubjectResources(root, adaptedOutputMaterials);
    adaptedOutputMaterials.clear();
    tracker.dispose();

    expect(outputDispose).toHaveBeenCalledTimes(1);
    expect(sourceDispose).toHaveBeenCalledTimes(1);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(adaptedOutputMaterials.size).toBe(0);
  });

  it("restores only still-attached copies and isolates tracker generations", () => {
    const source = new THREE.MeshStandardMaterial({ color: "#445566" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const firstTracker = new MaterialAwareMaterialTracker(11);
    const firstOutput = reconcile(firstTracker, mesh).materials[0]!;
    const firstOutputDispose = vi.spyOn(firstOutput, "dispose");
    const firstTrackerIdentity = (firstOutput as THREE.Material & {
      [observerOutputTrackerIdentity]?: object;
    })[observerOutputTrackerIdentity];
    const firstOwnerIdentity = (firstOutput as THREE.Material & {
      [observerOutputOwnerIdentity]?: object;
    })[observerOutputOwnerIdentity];

    const secondTracker = new MaterialAwareMaterialTracker(12);
    const secondOutput = reconcile(secondTracker, mesh).materials[0]!;
    const secondOutputDispose = vi.spyOn(secondOutput, "dispose");
    expect(secondOutput).not.toBe(firstOutput);
    expect(firstTrackerIdentity).toBe(firstTracker.identity);
    expect(firstOwnerIdentity).toBe(firstTracker.controllerOwner.identity);
    expect((secondOutput as THREE.Material & {
      [observerOutputTrackerIdentity]?: object;
    })[observerOutputTrackerIdentity]).toBe(secondTracker.identity);

    firstTracker.dispose();
    expect(firstOutputDispose).toHaveBeenCalledTimes(1);
    expect(mesh.material).toBe(secondOutput);
    secondTracker.dispose();
    expect(secondOutputDispose).toHaveBeenCalledTimes(1);
    expect(mesh.material).toBe(source);
    source.dispose();
    mesh.geometry.dispose();
  });

  it("does not dispose source textures or source resources with a controller-owned copy", () => {
    const texture = new THREE.DataTexture(new Uint8Array([1, 2, 3, 255]), 1, 1);
    const source = new THREE.MeshStandardMaterial({ map: texture });
    const geometry = new THREE.BoxGeometry();
    const mesh = new THREE.Mesh(geometry, source);
    const sourceDispose = vi.spyOn(source, "dispose");
    const textureDispose = vi.spyOn(texture, "dispose");
    const geometryDispose = vi.spyOn(geometry, "dispose");
    const tracker = new MaterialAwareMaterialTracker(5);
    const output = reconcile(tracker, mesh).materials[0]!;

    tracker.dispose();
    expect(mesh.material).toBe(source);
    expect((output as THREE.MeshStandardMaterial).map).toBe(texture);
    expect(sourceDispose).not.toHaveBeenCalled();
    expect(textureDispose).not.toHaveBeenCalled();
    expect(geometryDispose).not.toHaveBeenCalled();

    output.dispose();
    source.dispose();
    texture.dispose();
    geometry.dispose();
  });

  it("uses a fresh owner token for every controller tracker", () => {
    const first = createObserverControllerMaterialOutputOwner();
    const second = createObserverControllerMaterialOutputOwner();
    expect(first.identity).not.toBe(second.identity);
  });
});
